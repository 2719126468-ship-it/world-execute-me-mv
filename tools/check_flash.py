#!/usr/bin/env python3
# check_flash.py — 按秒检查「大面积亮度往返」是否超预算（PSE / flash 预算）
#
# 用法:
#   python tools/check_flash.py <video> [--start S] [--end E] [--preroll 5] [--json out.json]
#
# 解码链路（不落盘，流式读取）:
#   ffmpeg -v error [-ss S -to E] -i <video> \
#          -vf "scale=160:90:flags=area,format=gray" -fps_mode passthrough -f rawvideo -
#
# 往返次数定义（每 1 秒窗口内独立统计，取 L 与 P 两路的最大值）:
#   L(t) = 全画面平均亮度(0..1); P(t) = 与上一帧相比 |Δblock| > 0.18 的块占比。
#   1) 对序列做死区符号化: Δ > deadband -> 上升(+1)，Δ < -deadband -> 下降(-1)，
#      其余（含首帧）为「平」，不产生符号；只保留非零符号的序列。
#   2) 相邻两个非零符号方向不同 = 一次「方向翻转」。同一方向连续多次（含跨秒）不算。
#      单帧 |Δ| >= step（L:0.15 / P:0.40）的翻转标记为「阶跃翻转」（切点/硬切）。
#   3) 往返次数 = 翻转数 / 2（一上一下 = 1 次往返）；
#      若该秒内翻转数为奇数，剩下那一次：阶跃翻转按 1 次计（硬切视为一次完整闪），
#      平滑翻转按 0.5 次计。
#   4) 判定: 任一秒 > 3 次 FAIL；== 3 次 WARN；否则 ok。
#   注: P 是「与上一帧的绝对差」，方向不敏感，所以同一次正弦式闪烁在 P 上
#       会产生约 2 倍于 L 的翻转数（亮起与变暗各贡献一个方波脉冲）；取最大值即偏严一侧。
# 退出码: 有 FAIL -> 1，否则 0。参数/解码错误 -> 2。

import argparse
import json
import math
import os
import subprocess
import sys

W, H = 160, 90
BS = 8                                  # 块尺寸 8x8
COLS, ROWS = W // BS, H // BS           # 20 x 11（覆盖 160x88，底部 2 行不参与块指标）
FRAME_BYTES = W * H
MAX_BLOCKS = COLS * ROWS

# 阈值（默认值即需求里给的数字）
L_DEADBAND = 0.015      # L(t) 死区
L_STEP = 0.15           # L 单帧阶跃（切点）判定
P_DEADBAND = 0.12       # P(t) 死区
P_STEP = 0.40           # P 单帧阶跃判定
BLOCK_DELTA = 0.18      # 单块 |Δ| 阈值
TRIP_WARN = 3.0
TRIP_FAIL = 3.0         # > 3 -> FAIL, == 3 -> WARN


# ---------------------------------------------------------------- ffprobe / ffmpeg

def ffprobe_fps(path):
    cmd = ["ffprobe", "-v", "error", "-select_streams", "v:0",
           "-show_entries", "stream=avg_frame_rate,r_frame_rate,nb_frames",
           "-of", "json", path]
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        sys.stderr.write(out.stderr.strip() + "\n")
        sys.exit(2)
    try:
        st = json.loads(out.stdout)["streams"][0]
    except Exception:
        sys.stderr.write("ffprobe: 没有视频流\n")
        sys.exit(2)
    for key in ("avg_frame_rate", "r_frame_rate"):
        v = st.get(key) or ""
        if "/" in v:
            n, d = v.split("/")
            try:
                if float(d) > 0 and float(n) > 0:
                    return float(n) / float(d)
            except ValueError:
                pass
    return 30.0


def ffmpeg_frames(path, start, end):
    """生成器：逐帧产出 14400 字节的 160x90 灰度帧。"""
    cmd = ["ffmpeg", "-v", "error"]
    if start and start > 0:
        cmd += ["-ss", f"{start:.6f}"]
    if end is not None:
        cmd += ["-to", f"{end:.6f}"]
    cmd += ["-i", path]
    cmd += ["-vf", f"scale={W}:{H}:flags=area,format=gray",
            "-fps_mode", "passthrough", "-f", "rawvideo", "-"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        while True:
            buf = proc.stdout.read(FRAME_BYTES)
            if not buf or len(buf) < FRAME_BYTES:
                break
            yield buf
    finally:
        try:
            proc.stdout.close()
        except Exception:
            pass
        err = proc.stderr.read().decode("utf-8", "replace")
        proc.stderr.close()
        rc = proc.wait()
    if rc != 0:
        sys.stderr.write("ffmpeg 解码失败: " + err.strip() + "\n")
        sys.exit(2)


# ---------------------------------------------------------------- 帧指标

def frame_stats(buf):
    """返回 (全局平均亮度 0..1, 每块均值 list[220])。"""
    total = 0
    blocks = [0.0] * MAX_BLOCKS
    for by in range(ROWS):
        base = by * BS * W
        row_off = base
        acc = [0] * COLS
        for _ in range(BS):
            row = buf[row_off:row_off + W]
            total += sum(row)
            for bx in range(COLS):
                acc[bx] += sum(row[bx * BS:(bx + 1) * BS])
            row_off += W
        k = by * COLS
        for bx in range(COLS):
            blocks[k + bx] = acc[bx] / (BS * BS * 255.0)
    return total / (W * H * 255.0), blocks


class DirTracker:
    """把标量序列符号化（死区），记录方向翻转；翻转若来自单帧阶跃则标记 is_step。"""

    __slots__ = ("eps", "step", "prev", "flips")

    def __init__(self, eps, step):
        self.eps = eps
        self.step = step
        self.prev = 0
        self.flips = {}     # second -> [(is_step, magnitude), ...]

    def feed(self, delta, second):
        if delta > self.eps:
            s = 1
        elif delta < -self.eps:
            s = -1
        else:
            return
        if self.prev and s != self.prev:
            self.flips.setdefault(second, []).append((abs(delta) >= self.step, abs(delta)))
        self.prev = s

    def trips(self, second):
        """往返次数 = 翻转数 / 2；若余下 1 次翻转是「切点阶跃」，按 1 次计，否则按 0.5 次。"""
        fl = self.flips.get(second, ())
        n = len(fl)
        t = n // 2
        if n % 2:
            t += 1.0 if fl[-1][0] else 0.5
        return float(t)


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="按秒检查大面积亮度往返（flash 预算）。",
        epilog="往返次数 = 每秒窗口内方向翻转数/2（阶跃翻转单独按 1 次计），"
               "取亮度 L(t) 与块变化率 P(t) 两路的最大值。")
    ap.add_argument("video")
    ap.add_argument("--start", type=float, default=0.0,
                    help="成片时间起点（秒，输入侧 -ss）")
    ap.add_argument("--end", type=float, default=None,
                    help="成片时间终点（秒，输入侧 -to）")
    ap.add_argument("--preroll", type=float, default=5.0,
                    help="成片开头不属于歌曲的秒数（默认 5）")
    ap.add_argument("--json", default=None, help="输出完整数据到 JSON")
    ap.add_argument("--quiet", action="store_true", help="只打印结论行")
    a = ap.parse_args(argv)

    if not os.path.exists(a.video):
        sys.stderr.write(f"找不到文件: {a.video}\n")
        return 2

    fps = ffprobe_fps(a.video)
    start = max(0.0, a.start)
    preroll = a.preroll

    luma_mean = {}
    frame_n = {}
    luma_track = DirTracker(L_DEADBAND, L_STEP)
    block_track = DirTracker(P_DEADBAND, P_STEP)
    block_ratio_sum = {}
    block_ratio_max = {}

    prev_blocks = None
    prev_l = None
    idx = 0
    for buf in ffmpeg_frames(a.video, start, a.end):
        t = start + idx / fps
        sec = int(math.floor(t + 1e-9))
        L, blocks = frame_stats(buf)

        luma_mean[sec] = luma_mean.get(sec, 0.0) + L
        frame_n[sec] = frame_n.get(sec, 0) + 1

        if prev_blocks is not None:
            # 逐块比较，统计 |Δ| > 0.18 的块占比 P(t)
            cnt = 0
            for i in range(MAX_BLOCKS):
                d = blocks[i] - prev_blocks[i]
                if d < 0:
                    d = -d
                if d > BLOCK_DELTA:
                    cnt += 1
            p = cnt / MAX_BLOCKS
            block_ratio_sum[sec] = block_ratio_sum.get(sec, 0.0) + p
            if p > block_ratio_max.get(sec, -1.0):
                block_ratio_max[sec] = p
            block_track.feed(p - prev_p, sec)
            prev_p = p
            luma_track.feed(L - prev_l, sec)
        else:
            prev_p = 0.0
        prev_blocks = blocks
        prev_l = L
        idx += 1

    if idx == 0:
        sys.stderr.write("没有解码到任何帧（检查 --start/--end 或文件）\n")
        return 2

    seconds = []
    fails = warns = 0
    for sec in sorted(luma_mean):
        n = frame_n[sec]
        lm = luma_mean[sec] / n
        pmean = (block_ratio_sum.get(sec, 0.0) / n) if n else 0.0
        lt = luma_track.trips(sec)
        bt = block_track.trips(sec)
        trips = max(lt, bt)
        if trips > TRIP_FAIL:
            status, fails = "FAIL", fails + 1
        elif trips >= TRIP_WARN:
            status, warns = "WARN", warns + 1
        else:
            status = "ok"
        seconds.append({
            "sec": sec,
            "film_t": float(sec),
            "song_t": float(sec) - preroll,
            "frames": n,
            "luma_mean": round(lm, 5),
            "luma_trips": round(lt, 2),
            "block_change_mean": round(pmean, 4),
            "block_change_max": round(block_ratio_max.get(sec, 0.0), 4),
            "block_trips": round(bt, 2),
            "trips": round(trips, 2),
            "status": status,
        })

    worst = max(seconds, key=lambda s: (s["trips"], -s["sec"]))
    verdict = "FAIL" if fails else ("WARN" if warns else "PASS")

    if a.json:
        payload = {
            "video": os.path.abspath(a.video),
            "start": start, "end": a.end, "preroll": preroll, "fps": round(fps, 6),
            "frames": idx, "size": [W, H], "blocks": [COLS, ROWS],
            "thresholds": {
                "luma_deadband": L_DEADBAND, "luma_step": L_STEP,
                "block_deadband": P_DEADBAND, "block_step": P_STEP,
                "block_delta": BLOCK_DELTA,
                "trip_warn": TRIP_WARN, "trip_fail": TRIP_FAIL,
            },
            "verdict": verdict, "fail_seconds": fails, "warn_seconds": warns,
            "worst": worst, "seconds": seconds,
        }
        d = os.path.dirname(os.path.abspath(a.json))
        if d:
            os.makedirs(d, exist_ok=True)
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=1)

    # ---- 打印 ----
    def line(s):
        return ("{film:>8.1f}s  song {song:>8.2f}s  trips {trips:>4.1f}"
                "  luma {luma:.3f}  block {blk:.3f}  {st}").format(
            film=s["film_t"], song=s["song_t"], trips=s["trips"],
            luma=s["luma_mean"], blk=s["block_change_mean"], st=s["status"])

    head = (f"{a.video}  {idx} 帧 @ {fps:.3f}fps   preroll {preroll:g}s"
            f"   {'whole' if start == 0 and a.end is None else f'{start:g}-{a.end if a.end is not None else 'end'}s'}")
    if not a.quiet:
        print(head)
        print(f"{'film':>9}  {'song':>13}  {'trips':>9}  {'luma':>9}  {'block':>9}")

    flagged = [s for s in seconds if s["status"] != "ok"]
    worst10 = sorted(seconds, key=lambda s: (-s["trips"], s["sec"]))[:10]
    shown = {s["sec"] for s in flagged}
    if not a.quiet:
        for s in flagged:
            print(line(s))
        rest = [s for s in worst10 if s["sec"] not in shown]
        if rest:
            print("-- 最差 10 秒（其余）--")
            for s in rest:
                print(line(s))

    print(f"\n最差一秒: film {worst['film_t']:.1f}s / song {worst['song_t']:.2f}s"
          f"  trips {worst['trips']:.1f}  luma {worst['luma_mean']:.3f}"
          f"  (luma {worst['luma_trips']:.1f}, block {worst['block_trips']:.1f})")
    print(f"FAIL {fails} 秒 / WARN {warns} 秒 / 共 {len(seconds)} 秒 -> {verdict}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
