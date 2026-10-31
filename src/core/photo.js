// photo.js — AI 插画底版（raw RGB 直读，无解码依赖）
import fs from 'node:fs';
import path from 'node:path';
import { Surface, clamp, lerp, mixRgb } from './raster.js';
import { C, mix, proofMarks, plateFigure } from './art.js';

const CACHE_DIR = process.env.WEM_ART_CACHE || path.join(process.cwd(), 'out/artcache');
let INDEX = null;
const loaded = new Map();

function index() {
  if (INDEX) return INDEX;
  try { INDEX = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'index.json'), 'utf8')); }
  catch { INDEX = {}; }
  return INDEX;
}

export function hasPhoto(name) { return !!index()[name]; }

export function photoSurface(name) {
  if (loaded.has(name)) return loaded.get(name);
  const meta = index()[name];
  if (!meta) { loaded.set(name, null); return null; }
  const buf = fs.readFileSync(path.join(CACHE_DIR, name + '.raw'));
  const s = new Surface(meta.w, meta.h);
  s.data.set(buf);
  loaded.set(name, s);
  return s;
}

// 模糊铺底结果按尺寸缓存（同一尺寸只算一次，渲染时才不会每帧重算模糊）
const stageCache = new Map();
export function photoStageSurface(w, h, name, o = {}) {
  const key = `${w}x${h}|${name}|${o.cover ?? 1.02}|${o.dim ?? 0.55}|${o.blur !== false ? 1 : 0}`;
  const hit = stageCache.get(key);
  if (hit) return hit;
  const img = photoSurface(name);
  if (!img) return null;
  const cover = o.cover ?? 1.02;
  const scale = Math.max(w / img.w, h / img.h) * cover;
  const bw = Math.round(img.w * scale), bh = Math.round(img.h * scale);
  let bg;
  if (o.blur !== false) {
    // 在 1/4 尺寸做模糊再放大：同样的观感，快一个数量级
    const q = 4;
    const sw = Math.max(4, Math.round(bw / q)), sh = Math.max(4, Math.round(bh / q));
    const small = img.scaled(sw, sh);
    small.blur(Math.max(3, Math.round(Math.min(w, h) * 0.075 / q)));
    bg = small.scaled(bw, bh);
  } else {
    bg = img.scaled(bw, bh);
  }
  const full = new Surface(w, h);
  full.composite(bg, Math.round((w - bw) / 2), Math.round((h - bh) / 2), 1, 'over');
  full.rect(0, 0, w, h, C('paper'), o.dim ?? 0.72);
  if (stageCache.size > 8) stageCache.clear();
  stageCache.set(key, full);
  return full;
}

// 把插画贴成「一张印张」：模糊铺底 + 居中竖版 + 边角压暗
export function photoStage(surf, name, o = {}) {
  const full = photoStageSurface(surf.w, surf.h, name, o);
  if (!full) return false;
  surf.data.set(full.data);
  return true;
}

function photoStageLegacy(surf, name, o = {}) {
  const img = photoSurface(name);
  if (!img) return false;
  const W = surf.w, H = surf.h;
  const cover = o.cover ?? 1.02;
  const scale = Math.max(W / img.w, H / img.h) * cover;
  const bw = Math.round(img.w * scale), bh = Math.round(img.h * scale);
  const bg = img.scaled(bw, bh);
  if (o.blur !== false) bg.blur(Math.max(2, Math.round(Math.min(W, H) * 0.035)));
  surf.composite(bg, Math.round((W - bw) / 2), Math.round((H - bh) / 2), 1, 'over');
  surf.rect(0, 0, W, H, C('paper'), o.dim ?? 0.55);
  return true;
}

// 前景：完整竖图（高度占比 h），像贴上去的一张印张
const plateCache = new Map();
export function photoPlate(surf, name, o = {}) {
  const img = photoSurface(name);
  if (!img) return false;
  const W = surf.w, H = surf.h;
  const h = (o.h ?? 0.98) * H;
  const w = h * img.w / img.h;
  const x = Math.round((o.x ?? 0.5) * W - w / 2);
  const y = Math.round((o.y ?? 0.5) * H - h / 2);
  // 左右暗场：让竖构图读起来像电影画幅里的主体，而不是贴上去的小图
  const side = Math.max(40, Math.round((W - w) / 2));
  for (let i = 0; i < side; i += 2) {
    const a = 0.5 * (1 - i / side) ** 0.7;
    surf.rect(x - i, 0, 2, H, C('paper'), { alpha: a });
    surf.rect(x + w + i, 0, 2, H, C('paper'), { alpha: a });
  }
  // 投影
  surf.rect(x + 8, y + 10, w, h, [0, 0, 0], { alpha: 0.35 });
  const pk = `${name}|${Math.round(w)}x${Math.round(h)}`;
  let s = plateCache.get(pk);
  if (!s) {
    s = img.scaled(Math.max(2, Math.round(w)), Math.max(2, Math.round(h)));
    if (plateCache.size > 8) plateCache.clear();
    plateCache.set(pk, s);
  }
  surf.composite(s, x, y, 1, 'over');
  if (o.registration !== false) {
    // 裁切标记
    const u = Math.max(1, Math.round(H / 1080));
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      surf.rect(cx, cy, sx * 20 * u, 1.6 * u, C('you'), { alpha: 0.32 });
      surf.rect(cx, cy, 1.6 * u, sy * 20 * u, C('you'), { alpha: 0.32 });
    }
  }
  return true;
}

// 调色：把插画压向片子的蓝白黑（保明度、冷化、可控压暗）
// 调色 LUT（256 级，逐帧只查表）
const lutCache = new Map();
function tintLut(gain, dim, cool, contrast) {
  const key = `${gain}|${dim}|${cool}|${contrast}`;
  let t = lutCache.get(key);
  if (t) return t;
  t = new Uint8ClampedArray(256 * 3);
  for (let v = 0; v < 256; v++) {
    let l = v / 255;
    l = clamp((l - 0.5) * contrast + 0.5, 0, 1);
    l = Math.pow(l, 1.05) * gain * dim * 255;
    t[v * 3] = l * (1 - cool * 0.42);
    t[v * 3 + 1] = l * (1 - cool * 0.22);
    t[v * 3 + 2] = Math.min(255, l * (1 + cool * 0.16));
  }
  if (lutCache.size > 16) lutCache.clear();
  lutCache.set(key, t);
  return t;
}

export function tintPhoto(surf, o = {}) {
  const lut = tintLut(o.gain ?? 1, o.dim ?? 0.82, o.cool ?? 0.30, o.contrast ?? 1.12);
  const d = surf.data;
  for (let i = 0; i < d.length; i += 3) {
    const l = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    d[i] = lut[l * 3];
    d[i + 1] = lut[l * 3 + 1];
    d[i + 2] = lut[l * 3 + 2];
  }
  return surf;
}

// 半调网点：一次像素写入
export function halftoneDots(surf, alpha = 0.13, step = null) {
  const W = surf.w, H = surf.h, d = surf.data;
  const st = step || Math.max(2, Math.round(H / 200));
  const col = C('ink');
  const a = alpha, ia = 1 - a;
  for (let y = 0; y < H; y += st) {
    const off = (Math.floor(y / st) % 2) * (st >> 1);
    for (let x = off; x < W; x += st) {
      const i = (y * W + x) * 3;
      d[i] = d[i] * ia + col[0] * a;
      d[i + 1] = d[i + 1] * ia + col[1] * a;
      d[i + 2] = d[i + 2] * ia + col[2] * a;
    }
  }
  return surf;
}

// ---------- 场景用的一站式接口 ----------
// 有插画：模糊底＋压暗＋网点＋（可选）居中印张；无插画：返回 false，调用方回退纸底
export function plateBase(surf, ctx, t, name, o = {}) {
  if (!name || !hasPhoto(name)) return false;
  const W = surf.w, H = surf.h;
  photoStage(surf, name, { dim: o.stageDim ?? 0.84, blur: o.blur !== false });
  tintPhoto(surf, { dim: o.stageDim2 ?? 0.34, cool: o.cool ?? 0.4, contrast: o.contrast ?? 0.96 });
  // 印刷肌理：网点（整片写入，避免逐点走 fillPath）
  halftoneDots(surf, o.dotAlpha ?? 0.055);
  if (o.plate !== false) {
    photoPlate(surf, name, { h: o.h ?? 0.98, x: o.x ?? 0.5, y: o.y ?? 0.5, registration: o.registration === true });
  }
  if (o.proof) proofMarks(surf, o.proof);
  return true;
}

// 剪影：只有在没有插画时才画（免得画面里出现两个她）
export function figureIfNoPhoto(surf, photoName, figName, o = {}) {
  if (photoName && hasPhoto(photoName) && o.skipWhenPhoto !== false) return null;
  if (figName === 'f_eye') return plateFigure(surf, figName, o);
  return plateFigure(surf, figName, o);
}

// 一行替换用的入口：有插画走插画，没有回到纸底（CI 与本地行为一致）
export function base(surf, ctx, t, name, o = {}) {
  const used = plateBase(surf, ctx, t, name, o);
  if (!used) ground(surf, t, o);
  return used;
}
import { ground } from './art.js';

// 有插画时不画代码剪影（避免画面里出现两个她）
export function figOrSkip(surf, photo, name, o = {}) {
  if (photo && hasPhoto(photo)) return null;
  return plateFigure(surf, name, o);
}
