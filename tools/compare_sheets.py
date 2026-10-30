#!/usr/bin/env python3
# compare_sheets.py — 数值比对两套渲染结果（PNG 序列目录 / contact sheet 切格）
#
# 用法:
#   python tools/compare_sheets.py <dirA> <dirB> [--tol 2.0] [--json out.json]
#   python tools/compare_sheets.py <sheetA.png> <sheetB.png> --grid 8x4 [--tol 2.0]
#   python tools/compare_sheets.py <a.png> <b.png>            # 整图比较，等价于 --grid 1x1
#
# 全部像素运算走 ffmpeg -> rawvideo(gray, 宽 <= 160) -> Python 逐像素，内存可控。
# 退出码: 存在超过 --tol 的格子/文件 -> 1，否则 0；参数/解码错误 -> 2。

import argparse
import json
import os
import subprocess
import sys

MAXW = 160          # 默认解码宽度上限，避免大图占内存（--max-width 可放大）
HARD_DIFF = 8       # 「差异像素」判定：|Δ| > 8
IMG_EXT = (".png", ".jpg", ".jpeg", ".webp", ".bmp")


def ffprobe_size(path):
    cmd = ["ffprobe", "-v", "error", "-select_streams", "v:0",
           "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", path]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or "x" not in r.stdout:
        sys.stderr.write(f"ffprobe 失败: {path}\n{r.stderr.strip()}\n")
        sys.exit(2)
    w, h = r.stdout.strip().splitlines()[0].split("x")[:2]
    return int(w), int(h)


def decode_gray(path, w, h):
    """解码成 w*h 灰度 bytes（ffmpeg scale + format=gray）。"""
    cmd = ["ffmpeg", "-v", "error", "-i", path,
           "-vf", f"scale={w}:{h}:flags=area,format=gray",
           "-frames:v", "1", "-f", "rawvideo", "-"]
    r = subprocess.run(cmd, capture_output=True)
    buf = r.stdout
    if r.returncode != 0 or len(buf) < w * h:
        sys.stderr.write(f"解码失败: {path}\n{r.stderr.decode('utf-8', 'replace').strip()}\n")
        sys.exit(2)
    return buf[:w * h]


def load_pair(path_a, path_b, maxw=MAXW):
    """把两张图缩到同一尺寸（A 的长宽比，宽 <= maxw）后解码。"""
    wa, ha = ffprobe_size(path_a)
    wb, hb = ffprobe_size(path_b)
    w = max(8, min(maxw, wa, wb))
    h = max(8, int(round(w * ha / wa)))
    return decode_gray(path_a, w, h), decode_gray(path_b, w, h), w, h


def metrics(a, b):
    n = len(a)
    s = 0
    mx = 0
    over = 0
    for i in range(n):
        d = a[i] - b[i]
        if d < 0:
            d = -d
        s += d
        if d > mx:
            mx = d
        if d > HARD_DIFF:
            over += 1
    return {"mean": s / n, "max": float(mx), "over_pct": 100.0 * over / n,
            "pixels": n}


def cell_metrics(a, b, w, x0, y0, x1, y1):
    """在整幅数组上取矩形区域比较。"""
    n = 0
    s = 0
    mx = 0
    over = 0
    for y in range(y0, y1):
        base = y * w
        for x in range(x0, x1):
            i = base + x
            d = a[i] - b[i]
            if d < 0:
                d = -d
            s += d
            if d > mx:
                mx = d
            if d > HARD_DIFF:
                over += 1
            n += 1
    if n == 0:
        return {"mean": 0.0, "max": 0.0, "over_pct": 0.0, "pixels": 0}
    return {"mean": s / n, "max": float(mx), "over_pct": 100.0 * over / n,
            "pixels": n}


def grid_slice(w, h, cols, rows):
    """返回单元格边界 [(r, c, x0, y0, x1, y1), ...]，覆盖整幅、无重叠。"""
    xs = [int(round(c * w / cols)) for c in range(cols + 1)]
    ys = [int(round(r * h / rows)) for r in range(rows + 1)]
    out = []
    for r in range(rows):
        for c in range(cols):
            out.append((r + 1, c + 1, xs[c], ys[r], xs[c + 1], ys[r + 1]))
    return out


def list_imgs(d):
    return sorted(f for f in os.listdir(d) if f.lower().endswith(IMG_EXT))


def run_dir(a_dir, b_dir, tol, maxw=MAXW):
    fa = list_imgs(a_dir)
    fb = set(list_imgs(b_dir))
    rows = []
    for name in fa:
        pa = os.path.join(a_dir, name)
        pb = os.path.join(b_dir, name)
        if name not in fb:
            rows.append({"file": name, "status": "MISSING_B", "diff": None})
            continue
        fb.discard(name)
        A, B, w, h = load_pair(pa, pb, maxw)
        m = metrics(A, B)
        m.update({"file": name, "status": "diff" if m["mean"] > tol else "ok",
                  "w": w, "h": h})
        rows.append(m)
    for name in sorted(fb):
        rows.append({"file": name, "status": "MISSING_A", "diff": None})

    bad = [r for r in rows if r["status"] != "ok"]
    for r in bad:
        if r["status"] == "MISSING_A":
            print(f"{r['file']}  只在 B 中存在")
        elif r["status"] == "MISSING_B":
            print(f"{r['file']}  只在 A 中存在")
        else:
            print(f"{r['file']}  差异 {r['mean']:.3f}  max {r['max']:.0f}  "
                  f"超8像素 {r['over_pct']:.2f}%  ({r['w']}x{r['h']})")
    worst = max((r for r in rows if r.get("mean") is not None),
                key=lambda r: r["mean"], default=None)
    print(f"\n配对 {len(fa)} 个文件，超过 tol={tol:g} 的 {len(bad)} 个"
          + (f"，最大差异在 {worst['file']} ({worst['mean']:.3f})" if worst else ""))
    return len(bad), rows


def run_sheet(a_png, b_png, cols, rows_n, tol, maxw=MAXW):
    A, B, w, h = load_pair(a_png, b_png, maxw)
    cells = grid_slice(w, h, cols, rows_n)
    out = []
    for (r, c, x0, y0, x1, y1) in cells:
        m = cell_metrics(A, B, w, x0, y0, x1, y1)
        m.update({"row": r, "col": c, "status": "diff" if m["mean"] > tol else "ok"})
        out.append(m)
    bad = [c for c in out if c["status"] == "diff"]
    for c in bad:
        print(f"第 {c['row']} 行第 {c['col']} 列  差异 {c['mean']:.2f}"
              f"  max {c['max']:.0f}  超8像素 {c['over_pct']:.1f}%")
    worst = max(out, key=lambda c: c["mean"])
    print(f"\n{cols}x{rows_n} 网格 / {w}x{h} 解码: 超过 tol={tol:g} 的格子 {len(bad)}/"
          f"{len(out)}，最大差异 第 {worst['row']} 行第 {worst['col']} 列"
          f" ({worst['mean']:.2f})")
    return len(bad), out


def main(argv=None):
    ap = argparse.ArgumentParser(description="数值比对两套渲染结果")
    ap.add_argument("a")
    ap.add_argument("b")
    ap.add_argument("--tol", type=float, default=2.0, help="平均绝对差容忍度（0..255）")
    ap.add_argument("--grid", default=None, help="sheet 模式切格，如 8x4")
    ap.add_argument("--json", default=None)
    ap.add_argument("--max-width", type=int, default=MAXW,
                    help=f"解码宽度上限（默认 {MAXW}，越大越准也越占内存）")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args(argv)

    for p in (a.a, a.b):
        if not os.path.exists(p):
            sys.stderr.write(f"找不到: {p}\n")
            return 2

    if os.path.isdir(a.a) and os.path.isdir(a.b):
        if a.grid:
            sys.stderr.write("目录模式忽略 --grid\n")
        nbad, rows = run_dir(a.a, a.b, a.tol, a.max_width)
        payload = {"mode": "dir", "a": a.a, "b": a.b, "tol": a.tol,
                   "items": rows, "bad": nbad}
    else:
        cols, rows_n = 1, 1
        if a.grid:
            try:
                cs, rs = a.grid.lower().split("x")
                cols, rows_n = int(cs), int(rs)
            except Exception:
                sys.stderr.write("--grid 格式应为 CxR，如 8x4\n")
                return 2
        nbad, cells = run_sheet(a.a, a.b, cols, rows_n, a.tol, a.max_width)
        payload = {"mode": "sheet", "a": a.a, "b": a.b, "tol": a.tol,
                   "grid": [cols, rows_n], "items": cells, "bad": nbad}

    if a.json:
        d = os.path.dirname(os.path.abspath(a.json))
        if d:
            os.makedirs(d, exist_ok=True)
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=1)
    return 1 if nbad else 0


if __name__ == "__main__":
    sys.exit(main())
