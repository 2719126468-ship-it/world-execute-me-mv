#!/usr/bin/env python3
# check_sync.py — 人声频段起音检测 vs cues.js 时间表
#
# 用法:
#   python tools/check_sync.py <audio.wav> --cues src/scenes/cues.js [--json out.json] [--preroll 5]
#
# 链路: ffmpeg -i audio.wav -ac 1 -ar 22050 -f s16le -  ->  biquad 带通 1100-2900Hz
#       -> 10ms 帧 / 5ms hop RMS -> 20log10 -> 正向差分(flux) -> 阈值 中位数+3*MAD
#       -> 峰值检测（最小间隔 80ms）
# cues.js 时间是歌曲时间，wav 也从 0 开始，故无 preroll 偏移；--preroll 只用于报成片时间。
# 退出码: 有 FAIL(|偏差|>120ms) -> 1，否则 0；参数/解码错误 -> 2。

import argparse
import array
import json
import math
import os
import re
import subprocess
import sys

FS = 22050
FRAME = 220          # 10 ms
HOP = 110            # 5 ms
BAND_LO, BAND_HI = 1100.0, 2900.0
MIN_GAP = 0.080      # 80 ms
WARN_MS, FAIL_MS = 60.0, 120.0
ONSET_FLOOR_DB = 1.5     # 阈值下限（dB）：压掉稳态音的能量纹波
LOCK_FRAMES = 4          # 峰值需为 ±20ms 内的局部极大


# ---------------------------------------------------------------- 音频解码

def decode_mono(path):
    """流式解码 s16le 单声道 22050Hz，逐块 yield array('h')。"""
    cmd = ["ffmpeg", "-v", "error", "-i", path,
           "-ac", "1", "-ar", str(FS), "-f", "s16le", "-"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    chunk = HOP * 2 * 2048
    try:
        while True:
            raw = proc.stdout.read(chunk)
            if not raw:
                break
            if len(raw) & 1:
                raw = raw[:-1]
            arr = array.array("h")
            arr.frombytes(raw)
            if sys.byteorder == "big":
                arr.byteswap()
            yield arr
    finally:
        try:
            proc.stdout.close()
        except Exception:
            pass
        err = proc.stderr.read().decode("utf-8", "replace")
        proc.stderr.close()
        rc = proc.wait()
    if rc != 0:
        sys.stderr.write("ffmpeg 解码音频失败: " + err.strip() + "\n")
        sys.exit(2)


# ---------------------------------------------------------------- biquad 带通

def bandpass_coeffs(fs, f0, q):
    w0 = 2.0 * math.pi * f0 / fs
    alpha = math.sin(w0) / (2.0 * q)
    a0 = 1.0 + alpha
    return (alpha / a0, 0.0, -alpha / a0,
            -2.0 * math.cos(w0) / a0, (1.0 - alpha) / a0)


def rms_envelope(samples_iter):
    """单次遍历：带通滤波 + 10ms 帧 RMS（5ms hop）。"""
    f0 = math.sqrt(BAND_LO * BAND_HI)
    q = f0 / (BAND_HI - BAND_LO)
    b0, b1, b2, a1, a2 = bandpass_coeffs(FS, f0, q)
    z1 = z2 = 0.0
    ring = [0.0] * FRAME
    idx = 0
    tot = 0.0
    count = 0
    frames = []
    for chunk in samples_iter:
        for x in chunk:
            y = b0 * x + z1
            z1 = b1 * x - a1 * y + z2
            z2 = b2 * x - a2 * y
            q2 = y * y
            tot += q2 - ring[idx]
            ring[idx] = q2
            idx += 1
            if idx == FRAME:
                idx = 0
            count += 1
            if count % HOP == 0:
                if count % (HOP * 2000) == 0:      # 周期性校正浮点累计误差
                    tot = sum(ring)
                frames.append(math.sqrt(max(tot, 0.0) / FRAME))
    if not frames:
        sys.stderr.write("没有解码到音频样本\n")
        sys.exit(2)
    return frames


def flux_of(frames):
    db = [20.0 * math.log10(r + 1e-7) for r in frames]
    fl = [0.0] * len(db)
    for i in range(1, len(db)):
        d = db[i] - db[i - 1]
        fl[i] = d if d > 0 else 0.0
    return db, fl


def median(v):
    s = sorted(v)
    n = len(s)
    if n == 0:
        return 0.0
    return s[n // 2] if n & 1 else 0.5 * (s[n // 2 - 1] + s[n // 2])


def detect_onsets(flux, db):
    """阈值 max(中位数 + 3*MAD, 中位数 + ONSET_FLOOR_DB)，局部极大 + 最小间隔 80ms。"""
    med = median(flux)
    mad = median([abs(v - med) for v in flux])
    thr = max(med + 3.0 * mad, med + ONSET_FLOOR_DB)
    if mad <= 1e-9 and max(flux, default=0.0) <= thr:   # 全静音/全恒定
        return [], thr
    cand = []
    n = len(flux)
    for i in range(n):
        v = flux[i]
        if v <= thr:
            continue
        lo, hi = max(0, i - LOCK_FRAMES), min(n, i + LOCK_FRAMES + 1)
        if v < max(flux[lo:hi]):        # 只要局部极大，取平台首点
            continue
        cand.append(i)
    cand.sort(key=lambda i: (-flux[i], i))
    min_gap_frames = int(round(MIN_GAP * FS / HOP))
    chosen = []
    for i in cand:
        ok = True
        for j in chosen:
            if abs(i - j) < min_gap_frames:
                ok = False
                break
        if ok:
            chosen.append(i)
    chosen.sort()
    # 时间取帧中心
    times = [(i * HOP + FRAME / 2.0) / FS for i in chosen]
    return times, thr


# ---------------------------------------------------------------- cues.js 解析

OBJ_RE = re.compile(r"\{([^{}]*)\}")
KEY_RE = re.compile(r"""['"]([A-Za-z0-9_.\-]+)['"]\s*:\s*\{([^{}]*)\}""")
NAME_RE = re.compile(r"""name\s*:\s*['"]([^'"]*)['"]""")
T_RE = re.compile(r"""\bt\s*:\s*(-?\d+(?:\.\d+)?)""")
SRC_RE = re.compile(r"""src\s*:\s*['"]([^'"]*)['"]""")


def parse_cues(path):
    if not os.path.exists(path):
        sys.stderr.write(f"找不到 cues 文件: {path}\n")
        sys.exit(2)
    text = open(path, encoding="utf-8", errors="replace").read()
    cues = []
    seen = set()
    # 形式 A：{ name: 'x', t: 1.0, src: 'analysis' }
    for m in OBJ_RE.finditer(text):
        body = m.group(1)
        mn = NAME_RE.search(body)
        mt = T_RE.search(body)
        if not (mn and mt):
            continue
        ms = SRC_RE.search(body)
        name = mn.group(1)
        if name in seen:
            continue
        seen.add(name)
        cues.append({"name": name, "t": float(mt.group(1)),
                     "src": ms.group(1) if ms else ""})
    # 形式 B：'name': { t: 1.0, src: 'analysis' }
    for m in KEY_RE.finditer(text):
        name, body = m.group(1), m.group(2)
        mt = T_RE.search(body)
        if not mt or name in seen:
            continue
        ms = SRC_RE.search(body)
        seen.add(name)
        cues.append({"name": name, "t": float(mt.group(1)),
                     "src": ms.group(1) if ms else ""})
    if not cues:
        sys.stderr.write(f"{path} 里没有解析到 cue（需要 name/t/src 形式）\n")
        sys.exit(2)
    return cues


# ---------------------------------------------------------------- 主流程

def main(argv=None):
    ap = argparse.ArgumentParser(description="起音 vs cues.js 时间表比对")
    ap.add_argument("audio")
    ap.add_argument("--cues", default="src/scenes/cues.js")
    ap.add_argument("--json", default=None)
    ap.add_argument("--preroll", type=float, default=5.0,
                    help="只用于把歌曲时间换算成成片时间（默认 5）")
    ap.add_argument("--band", default=None, metavar="LO-HI",
                    help="覆盖带通频段，例如 1100-2900")
    a = ap.parse_args(argv)

    global BAND_LO, BAND_HI
    if a.band:
        try:
            lo, hi = a.band.split("-")
            BAND_LO, BAND_HI = float(lo), float(hi)
        except Exception:
            sys.stderr.write("--band 格式应为 LO-HI\n")
            return 2

    if not os.path.exists(a.audio):
        sys.stderr.write(f"找不到音频: {a.audio}\n")
        return 2

    frames = rms_envelope(decode_mono(a.audio))
    db, flux = flux_of(frames)
    onsets, thr = detect_onsets(flux, db)

    cues = parse_cues(a.cues)
    rows = []
    nf = nw = 0
    for c in cues:
        if onsets:
            best = min(onsets, key=lambda t: abs(t - c["t"]))
            dev = (best - c["t"]) * 1000.0
        else:
            best, dev = None, None
        if dev is None:
            st = "FAIL"
        elif abs(dev) > FAIL_MS:
            st = "FAIL"
        elif abs(dev) > WARN_MS:
            st = "WARN"
        else:
            st = "ok"
        if st == "FAIL":
            nf += 1
        elif st == "WARN":
            nw += 1
        note = ""
        if dev is None:
            note = "音频里没有起音"
        elif abs(dev) > 250.0:
            note = "附近 250ms 内无起音"
        rows.append({"name": c["name"], "src": c["src"], "cue_t": c["t"],
                     "onset_t": None if best is None else round(best, 4),
                     "dev_ms": None if dev is None else round(dev, 1),
                     "film_t": round(c["t"] + a.preroll, 3),
                     "note": note, "status": st})

    print(f"{a.audio}  {len(frames)*HOP/FS:.2f}s  {len(onsets)} 个起音"
          f"  阈值 {thr:.2f}dB  cues {len(cues)} 条（{a.cues}）")
    print(f"{'cue':<22}{'src':<9}{'song t':>9}{'onset':>9}{'dev ms':>9}  status")
    for r in rows:
        if r["status"] == "ok":
            continue
        on = "-" if r["onset_t"] is None else f"{r['onset_t']:.3f}"
        dv = "-" if r["dev_ms"] is None else f"{r['dev_ms']:+.1f}"
        tail = f"  {r['status']}"
        if r["note"]:
            tail += f"  ({r['note']})"
        print(f"{r['name']:<22}{r['src']:<9}{r['cue_t']:>9.3f}{on:>9}{dv:>9}{tail}")

    print("\n最需要人耳确认的十处（src=init 优先，其次 |偏差|）:")
    order = sorted(rows, key=lambda r: (0 if r["src"] == "init" else 1,
                                        -abs(r["dev_ms"] or 0.0), r["cue_t"]))
    for r in order[:10]:
        dv = "无起音" if r["dev_ms"] is None else f"{r['dev_ms']:+.1f}ms"
        print(f"  {r['name']:<22} song {r['cue_t']:>8.3f}s / film {r['film_t']:>8.3f}s"
              f"  {dv:<10} {r['status']}")

    verdict = "FAIL" if nf else ("WARN" if nw else "PASS")
    print(f"\nFAIL {nf} / WARN {nw} / ok {len(rows)-nf-nw} / 共 {len(rows)} -> {verdict}")

    if a.json:
        d = os.path.dirname(os.path.abspath(a.json))
        if d:
            os.makedirs(d, exist_ok=True)
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump({"audio": os.path.abspath(a.audio), "cues_file": a.cues,
                       "preroll": a.preroll, "fs": FS, "frame_ms": 10, "hop_ms": 5,
                       "band": [BAND_LO, BAND_HI], "threshold_db": round(thr, 3),
                       "onsets": [round(t, 4) for t in onsets],
                       "cues": rows, "verdict": verdict,
                       "fail": nf, "warn": nw}, f, ensure_ascii=False, indent=1)
    return 1 if nf else 0


if __name__ == "__main__":
    sys.exit(main())
