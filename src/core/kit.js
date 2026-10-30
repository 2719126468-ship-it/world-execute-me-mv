// kit.js — 共用镜头工具：光、撕裂、降帧、转场
import { Surface, hexToRgb, clamp, lerp, ease, mixRgb } from './raster.js';
import { mulberry32, hash32 } from './prng.js';
import { C } from './art.js';

export const W = 1920, H = 1080;

// ---------- 时间 ----------
export function beatAt(t) { return (t - 0.344) / 0.4615384615; }
export function B(n) { return 0.344 + n * 0.4615384615; }
export function Bt(n) { return B(n); }
export function bar(n) { return 0.344 + n * 1.846153846; }
export function dropFrames(t, fps) { return Math.floor(t * fps + 1e-6) / fps; }
export function window01(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
export function pulse(t, at, dur = 0.12) { const d = Math.abs(t - at); return d > dur ? 0 : 1 - d / dur; }

// ---------- 光 ----------
export function bloom(surf, amount = 0.6, threshold = 0.55, radius = 24) {
  if (amount <= 0) return surf;
  const q = 6;
  const sw = Math.max(2, Math.round(surf.w / q)), sh = Math.max(2, Math.round(surf.h / q));
  const small = new Surface(sw, sh);
  const d = surf.data, sd = small.data;
  // 采样 + 阈值
  for (let y = 0; y < sh; y++) {
    const sy = Math.min(surf.h - 1, y * q + (q >> 1));
    for (let x = 0; x < sw; x++) {
      const sx = Math.min(surf.w - 1, x * q + (q >> 1));
      const si = (sy * surf.w + sx) * 3, di = (y * sw + x) * 3;
      const r = d[si], g = d[si + 1], b = d[si + 2];
      const l = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      const k = l <= threshold ? 0 : Math.min(1, (l - threshold) / (1 - threshold));
      sd[di] = r * k; sd[di + 1] = g * k; sd[di + 2] = b * k;
    }
  }
  small.blur(Math.max(1, Math.round(radius / q)));
  // 最近邻放大加色
  const k = amount;
  for (let y = 0; y < surf.h; y++) {
    const sy = (y / q) | 0;
    let i = y * surf.w * 3;
    for (let x = 0; x < surf.w; x++, i += 3) {
      const si = (sy * sw + ((x / q) | 0)) * 3;
      d[i] += sd[si] * k;
      d[i + 1] += sd[si + 1] * k;
      d[i + 2] += sd[si + 2] * k;
    }
  }
  return surf;
}

export function flash(surf, k, color = [255, 250, 240]) {
  if (k <= 0) return surf;
  const a = clamp(k, 0, 1);
  surf.rect(0, 0, surf.w, surf.h, color, a, 'over');
  return surf;
}

// 从一点向外的光线（版画用，纯平涂）
export function rays(surf, o) {
  const { cx, cy, n = 18, r0 = 40, r1 = 600, rot = 0, width = 8, color = C('me'), alpha = 0.5 } = o;
  const polys = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const w = width * (0.6 + 0.4 * Math.sin(i * 2.3));
    const ca = Math.cos(a), sa = Math.sin(a);
    const px = -sa, py = ca;
    polys.push([
      [cx + px * w * 0.3, cy + py * w * 0.3],
      [cx + ca * r1 + px * w, cy + sa * r1 + py * w],
      [cx + ca * r1 - px * w, cy + sa * r1 - py * w],
      [cx - px * w * 0.3, cy - py * w * 0.3],
    ]);
  }
  surf.fillPath(polys, color, { alpha, mode: 'over' });
  return surf;
}

// 水平光条
export function bars(surf, o) {
  const { y, h = 6, color = C('you'), alpha = 0.4, x = 0, w = surf.w, skew = 0 } = o;
  if (skew) {
    surf.fillPath([[[x, y], [x + w, y + skew], [x + w, y + skew + h], [x, y + h]]], color, { alpha });
  } else {
    surf.rect(x, y, w, h, color, alpha);
  }
  return surf;
}

// 径向推进模糊（低分辨率近似）
export function zoomBlur(surf, cx, cy, strength = 0.5, samples = 3) {
  if (strength <= 0.001) return surf;
  const W = surf.w, H = surf.h, d = surf.data;
  const src = d.slice();
  const k = Math.min(0.12, strength * 0.06);
  for (let y = 0; y < H; y++) {
    const dy = y - cy;
    let i = y * W * 3;
    for (let x = 0; x < W; x++, i += 3) {
      const dx = x - cx;
      let r = 0, g = 0, b = 0, n = 0;
      for (let s = 0; s < samples; s++) {
        const f = 1 + k * s;
        const sx = Math.round(cx + dx * f);
        const sy = Math.round(cy + dy * f);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const j = (sy * W + sx) * 3;
        r += src[j]; g += src[j + 1]; b += src[j + 2]; n++;
      }
      if (n) {
        d[i] = r / n; d[i + 1] = g / n; d[i + 2] = b / n;
      }
    }
  }
  return surf;
}

// ---------- 腐坏 ----------
// 一次性花屏事件：横向撕裂 + 块位移 + RGB 分离
export function glitch(surf, o = {}) {
  const { seed = 1, amp = 1, rgb = 0, mosaic = 0, tear = 0 } = o;
  const rnd = mulberry32(hash32(seed * 977 + 13));
  const W_ = surf.w, H_ = surf.h;
  if (tear > 0) {
    const bands = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < bands; i++) {
      const y0 = Math.floor(rnd() * H_);
      const hgt = 4 + Math.floor(rnd() * 46 * amp);
      const dx = Math.round((rnd() - 0.5) * 120 * amp);
      if (Math.abs(dx) > 1) surf.tearRow(y0, Math.min(H_, y0 + hgt), dx);
    }
  }
  if (mosaic > 0) {
    const bs = Math.max(8, Math.round(28 * mosaic));
    const small = surf.scaled(Math.max(2, Math.round(W_ / bs)), Math.max(2, Math.round(H_ / bs)));
    const up = small.scaled(W_, H_);
    // 只替换若干块
    for (let i = 0; i < 6 + Math.floor(rnd() * 8); i++) {
      const bx = Math.floor(rnd() * (W_ - bs * 2)), by = Math.floor(rnd() * (H_ - bs * 2));
      const bw = bs * (1 + Math.floor(rnd() * 3)), bh = bs * (1 + Math.floor(rnd() * 2));
      const sx = Math.round(bx / W_ * up.w), sy = Math.round(by / H_ * up.h);
      const sw = Math.round(bw / W_ * up.w), sh = Math.round(bh / H_ * up.h);
      const piece = new Surface(sw, sh);
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const si = ((sy + y) * up.w + sx + x) * 3, di = (y * sw + x) * 3;
          piece.data[di] = up.data[si]; piece.data[di + 1] = up.data[si + 1]; piece.data[di + 2] = up.data[si + 2];
        }
      }
      surf.composite(piece, bx, by, 1, 'over');
    }
  }
  if (rgb > 0) surf.rgbSplit(Math.round(rgb));
  return surf;
}

// 扫描线（代码画面）
export function scanlines(surf, alpha = 0.12, step = 4) {
  for (let y = 0; y < surf.h; y += step) {
    surf.rect(0, y, surf.w, 1, [0, 0, 0], alpha);
  }
  return surf;
}

// ---------- 版画框内嵌（小图/卡片） ----------
export function panel(surf, x, y, w, h, o = {}) {
  const fill = o.fill || C('paperWarm');
  surf.fillPath([[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]], fill, { alpha: o.alpha ?? 1 });
  if (o.border !== false) {
    surf.stroke([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], o.borderWidth ?? 2, o.borderColor || C('you'), { alpha: o.borderAlpha ?? 0.35 });
  }
  return surf;
}

// 网格（版画坐标纸）
export function grid(surf, step, color, alpha) {
  for (let x = 0; x <= surf.w; x += step) surf.rect(x, 0, 1, surf.h, color, alpha);
  for (let y = 0; y <= surf.h; y += step) surf.rect(0, y, surf.w, 1, color, alpha);
  return surf;
}

// 噪声片（VHS 底噪）
export function noiseBand(surf, y, h, alpha, seed) {
  const rnd = mulberry32(hash32(seed * 31 + 7));
  for (let i = 0; i < 400; i++) {
    const yy = y + Math.floor(rnd() * h);
    const xx = Math.floor(rnd() * surf.w);
    const w = 2 + Math.floor(rnd() * 40);
    surf.rect(xx, yy, w, 1, [255, 255, 255], alpha * rnd());
  }
  return surf;
}
