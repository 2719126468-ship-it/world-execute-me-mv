// ascii.js — 字符球 / 字符迸发 / 滚动字符流
import { spherePoints, rotate3, project3 } from './geom.js';
import { glyphMask } from './font.js';
import { mulberry32, hash32 } from './prng.js';
import { clamp, lerp } from './raster.js';

const CHARS = '01{}[]()<>=+*/#%&$@:;.,';

export function asciiSphere(surf, o) {
  const {
    cx, cy, r, rot = 0, tilt = 0.35, n = 320, font, size = 16,
    color, alpha = 1, chars = CHARS, seed = 1,
  } = o;
  const rnd = mulberry32(hash32(seed));
  const pts = spherePoints(n, rnd);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = rotate3(pts[i], tilt, rot);
    const [x, y, z] = project3(p, cx, cy, r, 0);
    if (z < -0.2) continue;
    out.push({ x, y, z, ch: chars[Math.floor(rnd() * chars.length)] });
  }
  out.sort((a, b) => a.z - b.z);
  for (const p of out) {
    const k = (p.z + 1) / 2;
    const g = glyphMask(font, p.ch.codePointAt(0), Math.max(6, Math.round(size * (0.55 + 0.55 * k))));
    if (!g) continue;
    surf.blitMask(g, Math.round(p.x - g.w / 2), Math.round(p.y - g.h / 2), color, alpha * (0.18 + 0.82 * k * k));
  }
  return out.length;
}

// 从一点向外迸发的字符（强起音）
export function asciiBurst(surf, o) {
  const {
    cx, cy, t, seed = 1, count = 90, speed = 900, life = 0.55,
    font, size = 20, color, alpha = 1, spread = Math.PI * 2, dir = -Math.PI / 2,
  } = o;
  const rnd = mulberry32(hash32(seed));
  for (let i = 0; i < count; i++) {
    const a = dir + (rnd() - 0.5) * spread;
    const sp = speed * (0.35 + rnd() * 0.9);
    const ph = rnd() * life * 0.5;
    const tt = (t + ph) % life;
    const d = sp * tt;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d + 60 * tt * tt;
    const k = 1 - tt / life;
    if (k <= 0) continue;
    const ch = CHARS[Math.floor(rnd() * CHARS.length)];
    const g = glyphMask(font, ch.codePointAt(0), Math.round(size * (0.4 + k * 0.8)));
    if (!g) continue;
    surf.blitMask(g, Math.round(x - g.w / 2), Math.round(y - g.h / 2), color, alpha * k * k);
  }
}

// 竖直滚动的字符流（裁切在矩形内）
export function asciiScroll(surf, o) {
  const {
    x, y, w, h, t, font, size = 18, lineH = 26, speed = 60,
    color, alpha = 1, seed = 1, prefix = '', lines = 40,
  } = o;
  const rnd = mulberry32(hash32(seed));
  const rows = Math.ceil(h / lineH) + 2;
  const off = ((t * speed) % lineH);
  const clip = new Uint8Array(surf.w * surf.h);
  const x0 = Math.max(0, Math.floor(x)), x1 = Math.min(surf.w, Math.ceil(x + w));
  const y0 = Math.max(0, Math.floor(y)), y1 = Math.min(surf.h, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) clip.fill(255, yy * surf.w + x0, yy * surf.w + x1);
  const startLine = Math.floor((t * speed) / lineH);
  for (let r = -1; r < rows; r++) {
    const ly = y + r * lineH - off;
    if (ly < y - lineH || ly > y + h) continue;
    const li = (startLine + r + lines * 4) % lines;
    let s = prefix + String(li).padStart(3, '0') + ' ';
    const len = 10 + Math.floor(rnd() * 18);
    for (let c = 0; c < len; c++) s += CHARS[Math.floor(rnd() * CHARS.length)];
    const g = glyphMask(font, s.codePointAt(0), size);
    // 逐字符画，带裁切
    let pen = x + 4;
    for (const ch of s) {
      const gg = glyphMask(font, ch.codePointAt(0), size);
      if (!gg) continue;
      if (pen + gg.advance > x + w) break;
      surf.blitMask(gg, Math.round(pen + gg.left), Math.round(ly + gg.top), color, alpha, 'over', clip);
      pen += gg.advance;
    }
  }
  return surf;
}
