// art.js — 三色剪影绘制、字符版画、纸底
import { Surface, hexToRgb, clamp, lerp, ease, circlePoly } from './raster.js';
import { figure, registerOf } from './figures.js';
import { textMask, glyphMask, measure } from './font.js';
import { ellipse, smoothOpen } from './geom.js';

export const CFG = {
  palette: {
    paper: '#070B16', paperWarm: '#0D1830', ink: '#02040A',
    me: '#4D6BFE', meHot: '#8FA5FF', meDim: '#26389C',
    you: '#F2F6FF', sub: '#A9B8D9', err: '#F5506F',
    ash: '#5B6784', off: '#2A3350', dead: '#161E33', white: '#FFFFFF',
  },
  spot: {
    eggplant: { base: '#7B52AB', light: '#9C74C9', dark: '#4E3172' },
    tomato: { base: '#D4432F', light: '#EA6A4E', dark: '#8E2A1C' },
  },
};

export function loadConfig(cfg) {
  if (cfg.palette) Object.assign(CFG.palette, cfg.palette);
  if (cfg.spot) Object.assign(CFG.spot, cfg.spot);
}
export function C(name) { return hexToRgb(CFG.palette[name] || name); }

// ---------- 角色映射 ----------
// role: {black, cream, me, paper}
export function defaultRole() {
  return { black: C('ink'), cream: C('you'), me: C('me'), paper: C('paper') };
}

// ---------- 人物 mask（返回与目标同尺寸的 Uint8Array 轮廓覆盖） ----------
export function figureMask(name, w, h, o = {}) {
  const fig = figure(name);
  const surf = new Surface(w, h);
  const tmp = new Surface(w, h);
  drawFigure(tmp, name, { ...o, role: { black: [255, 255, 255], cream: [255, 255, 255], me: [255, 255, 255], paper: [0, 0, 0] }, screen: null, alpha: 1, reveal: 1 });
  const mask = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < mask.length; i++, j += 3) {
    mask[i] = tmp.data[j] > 100 ? 255 : 0;
  }
  return mask;
}

// ---------- 剪影绘制 ----------
// o: {x, y, w, h, alpha, role, offset:{black:[dx,dy],...}, reveal, flipX, mode,
//     screen:{surface, alpha}, screenClip, register:{s,tx,ty}, tone}
export function drawFigure(surf, name, o = {}) {
  const fig = figure(name);
  const role = { ...defaultRole(), ...(o.role || {}) };
  const alpha = o.alpha ?? 1;
  const mode = o.mode || 'over';
  const reg = o.register !== false ? registerOf(name) : { s: 1, tx: 0, ty: 0 };
  const w = o.w ?? surf.w, h = o.h ?? (w * fig.h / fig.w);
  const x = o.x ?? 0, y = o.y ?? 0;
  const scale = w / fig.w;
  const flipX = !!o.flipX;

  const map = (p) => {
    let px = p[0], py = p[1];
    // 配准（原图像素单位）
    px = (px - fig.w / 2) * reg.s + reg.tx + fig.w / 2;
    py = (py - fig.h / 2) * reg.s + reg.ty + fig.h / 2;
    let sx = x + px * scale;
    if (flipX) sx = x + w - px * scale;
    return [sx, y + py * scale];
  };

  // reveal：从下往上显影
  let clip = o.screenClip || null;
  if (o.reveal !== undefined && o.reveal < 1) {
    clip = new Uint8Array(surf.w * surf.h);
    const ry = y + h * (1 - o.reveal);
    for (let yy = Math.max(0, Math.floor(ry)); yy < Math.min(surf.h, Math.ceil(y + h)); yy++) {
      clip.fill(255, yy * surf.w, (yy + 1) * surf.w);
    }
  }
  if (o.clip) clip = o.clip;

  const offsetFor = (ink) => {
    const d = o.offset && o.offset[ink];
    return d ? [d[0] * scale, d[1] * scale] : [0, 0];
  };

  // 合并同色描边，减少 fillPath 次数
  let batch = [];
  const flush = () => {
    if (!batch.length) return;
    const groups = new Map();
    for (const b of batch) {
      const k = b.ink + '|' + b.a.toFixed(3) + '|' + b.col.join(',');
      if (!groups.has(k)) groups.set(k, { col: b.col, a: b.a, polys: [] });
      groups.get(k).polys.push(...b.polys);
    }
    for (const g of groups.values()) {
      surf.fillPath(g.polys, g.col, { alpha: g.a, mode, clip });
    }
    batch = [];
  };

  for (const op of fig.ops) {
    let col;
    if (op.ink === 'paper') col = o.paperColor || role.paper;
    else if (op.ink === 'hole') continue;
    else col = role[op.ink] || role.black;
    if (!col) continue;
    const a = alpha * (op.alpha ?? 1) * (o.tone ?? 1);
    const [ox, oy] = offsetFor(op.ink);
    const polys = [];
    for (const poly of op.polys) {
      polys.push(poly.map(([px, py]) => {
        let q = map([px, py]);
        return [q[0] + ox, q[1] + oy];
      }));
    }
    if (op.stroke) {
      for (const p of polys) batch.push({ ink: op.ink, a, col, polys: strokePolys(p, op.stroke * scale) });
    } else {
      flush();
      surf.fillPath(polys, col, { alpha: a, mode, evenOdd: !!op.evenOdd, clip });
    }
  }
  flush();

  // 黑墨区域作为屏幕
  if (o.screen && o.screen.surface) {
    const mask = figureMask(name, surf.w, surf.h, { ...o, role: undefined, screen: null });
    surf.composite(o.screen.surface, 0, 0, o.screen.alpha ?? 1, 'over', mask);
  }
  return surf;
}

// ---------- 字符版画 ----------
// 用字符组成剪影，字符裁切在轮廓内
const RAMP = '.:-=+*#%@';
const DIRS = { h: '-', v: '|', d1: '/', d2: '\\' };

export function glyphPlate(surf, name, o = {}) {
  const w = o.w ?? surf.w, h = o.h ?? (w * 1400 / 1000);
  const x = o.x ?? 0, y = o.y ?? 0;
  const cell = o.cell ?? 14;
  const role = { ...defaultRole(), ...(o.role || {}) };
  const font = o.font;
  const mask = figureMask(name, surf.w, surf.h, o);
  const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
  const px = Math.round(cell * 1.08);
  const dark = role.black, light = role.cream || role.sub, accent = o.accent || role.me;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x + c * cell + cell / 2;
      const cy = y + r * cell + cell / 2;
      if (cx < 0 || cy < 0 || cx >= surf.w || cy >= surf.h) continue;
      const m = mask[Math.round(cy) * surf.w + Math.round(cx)];
      if (!m) continue;
      // 覆盖率：四角采样
      let cov = 0;
      for (const [dx, dy] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
        const sx = Math.round(cx + dx * cell), sy = Math.round(cy + dy * cell);
        if (sx >= 0 && sy >= 0 && sx < surf.w && sy < surf.h && mask[sy * surf.w + sx]) cov++;
      }
      if (cov === 0) continue;
      // 边缘方向
      let ch;
      if (cov < 3) {
        const l = mask[Math.round(cy) * surf.w + Math.round(cx - cell)] ? 1 : 0;
        const rr = mask[Math.round(cy) * surf.w + Math.round(cx + cell)] ? 1 : 0;
        const u = mask[Math.round(cy - cell) * surf.w + Math.round(cx)] ? 1 : 0;
        const d = mask[Math.round(cy + cell) * surf.w + Math.round(cx)] ? 1 : 0;
        if (l !== rr && u === d) ch = DIRS.v;
        else if (u !== d && l === rr) ch = DIRS.h;
        else if ((l && !rr && !u) || (rr && !l && !d)) ch = DIRS.d1;
        else ch = DIRS.d2;
      } else {
        const g = (Math.sin(c * 0.9 + r * 1.7) * 0.5 + 0.5) * 0.5 + (o.tone ?? 0.55);
        ch = RAMP[clamp(Math.floor(g * RAMP.length), 2, RAMP.length - 1)];
      }
      const gmask = glyphMask(font, ch.codePointAt(0), px);
      if (!gmask) continue;
      const col = cov < 3 ? light : (r % 7 === 0 && o.alt ? accent : dark);
      surf.blitMask(gmask, Math.round(cx - gmask.w / 2 + gmask.left - gmask.left), Math.round(cy - gmask.h / 2 + gmask.top - gmask.top), col, o.alpha ?? 1, 'over', mask);
    }
  }
  return surf;
}

// ---------- 纸底（缓存底版 + 每帧噪点） ----------
const groundCache = new Map();
const noiseTile = (() => {
  const n = 512;
  const t = new Int8Array(n * n);
  let s = 0x9e3779b9 >>> 0;
  for (let i = 0; i < t.length; i++) {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    t[i] = ((s & 255) - 128) >> 3;
  }
  return t;
})();

function paintGroundBase(surf, o = {}) {
  const base = o.base || C('paper');
  surf.fill(base);
  const blobs = o.blobs ?? [
    [0.28, 0.32, 0.62, 0.11], [0.74, 0.68, 0.72, 0.08], [0.5, 0.95, 0.9, 0.05],
  ];
  const d = surf.data, W = surf.w, H = surf.h;
  const warm = mix(C('paperWarm'), C('meDim'), 0.28);
  const list = blobs.map(([bx, by, br, ba]) => [bx * W, by * H, br * Math.max(W, H), ba]);
  for (let y = 0; y < H; y++) {
    let i = y * W * 3;
    for (let x = 0; x < W; x++, i += 3) {
      let acc = 0;
      for (let b = 0; b < list.length; b++) {
        const [cx, cy, r, ba] = list[b];
        const dx = (x - cx) / r, dy = (y - cy) / r;
        const d2 = dx * dx + dy * dy;
        if (d2 < 1) { const k = 1 - d2; acc += k * k * ba; }
      }
      if (acc > 0) {
        d[i] += (warm[0] - d[i]) * acc;
        d[i + 1] += (warm[1] - d[i + 1]) * acc;
        d[i + 2] += (warm[2] - d[i + 2]) * acc;
      }
    }
  }
  // 点阵：一次遍历写像素
  const step = o.dotStep ?? 28;
  const a = o.dotAlpha ?? 0.05;
  const col = C('you');
  for (let y = Math.floor(step / 2); y < surf.h; y += step) {
    for (let x = Math.floor(step / 2); x < surf.w; x += step) {
      const i = (y * surf.w + x) * 3;
      d[i] += (col[0] - d[i]) * a; d[i + 1] += (col[1] - d[i + 1]) * a; d[i + 2] += (col[2] - d[i + 2]) * a;
    }
  }
  // 四角裁切标记
  if (o.marks !== false) {
    const m = Math.round(Math.min(surf.w, surf.h) * 0.045);
    const pad = Math.round(Math.min(surf.w, surf.h) * 0.035);
    const col2 = mix(C('you'), C('paper'), 0.55);
    for (const [cx, cy, sx, sy] of [[pad, pad, 1, 1], [surf.w - pad, pad, -1, 1], [pad, surf.h - pad, 1, -1], [surf.w - pad, surf.h - pad, -1, -1]]) {
      surf.rect(cx, cy, sx * m, 2, col2, 0.5);
      surf.rect(cx, cy, 2, sy * m, col2, 0.5);
    }
  }
}

export function ground(surf, t = 0, o = {}) {
  const key = `${surf.w}x${surf.h}|${o.base || ''}|${o.marks === false ? 0 : 1}|${o.dotStep || 28}|${o.proof ? o.proof.sheet || 'p' : ''}`;
  let base = groundCache.get(key);
  if (!base) { base = new Surface(surf.w, surf.h); paintGroundBase(base, o); groundCache.set(key, base); }
  surf.data.set(base.data);
  if (o.proof) proofMarks(surf, o.proof);
  // 每帧噪点（tile 平铺，确定性）
  const amp = o.noise ?? 6;
  if (amp > 0) {
    const d = surf.data, W = surf.w, H = surf.h;
    let k = (Math.floor(t * 30) * 7919) & 511;
    for (let y = 0; y < H; y++) {
      let i = y * W * 3;
      let ti = ((y & 511) << 9);
      for (let x = 0; x < W; x++, i += 3) {
        const n = (noiseTile[ti | ((x + k) & 511)] * amp) >> 3;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
      }
    }
  }
  return surf;
}

export function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

// ---------- 文字 ----------
// o: {font, size, x, y, color, alpha, align:'left'|'center'|'right', mode}
export function drawText(surf, str, o) {
  const m = textMask(o.font, str, o.size);
  if (!m) return 0;
  let x = o.x ?? 0;
  if (o.align === 'center') x -= m.w / 2;
  else if (o.align === 'right') x -= m.w;
  const y = (o.y ?? 0) + m.top;
  surf.blitMask(m, Math.round(x + m.left), Math.round(y), o.color || C('you'), o.alpha ?? 1, o.mode || 'over');
  return m.w;
}

export function textWidth(font, str, size) { return measure(font, str, size).width; }

// 逐字绘制（用于关键词拆字）
export function drawChars(surf, chars, o) {
  let x = o.x ?? 0;
  const out = [];
  for (const { ch, t0, t1 } of chars) {
    const g = glyphMask(o.font, ch.codePointAt(0), o.size);
    if (!g) continue;
    out.push({ ch, g, x });
    x += g.advance;
  }
  return out;
}

// 纸底上的暖色光斑背景（替代模糊插画）
export function warmBackdrop(surf, t, o = {}) {
  surf.fill(o.base || C('paper'));
  const n = o.n ?? 9;
  for (let i = 0; i < n; i++) {
    const ph = i * 1.7;
    const cx = (0.5 + 0.42 * Math.sin(t * 0.13 + ph)) * surf.w;
    const cy = (0.5 + 0.36 * Math.cos(t * 0.11 + ph * 1.3)) * surf.h;
    const r = (0.18 + 0.1 * Math.sin(t * 0.07 + i)) * Math.max(surf.w, surf.h);
    const col = mix(C('paperWarm'), C('meDim'), 0.35 + 0.2 * Math.sin(ph));
    for (let k = 12; k >= 1; k--) {
      surf.circle(cx, cy, r * (k / 12), col, { alpha: 0.05, mode: 'add' });
    }
  }
  surf.noise(7, 77, false);
  return surf;
}

// ---------- 空心字与轮廓 ----------
function erodeMask(a, w, h, r) {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 255;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= w) continue;
        const v = a[y * w + xx];
        if (v < m) m = v;
      }
      tmp[y * w + x] = m;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 255;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy < 0 || yy >= h) continue;
        const v = tmp[yy * w + x];
        if (v < m) m = v;
      }
      out[y * w + x] = m;
    }
  }
  return out;
}

export function maskOutline(m, thickness = 4) {
  const r = Math.max(1, Math.round(thickness));
  const inner = erodeMask(m.a, m.w, m.h, r);
  const out = new Uint8Array(m.a.length);
  for (let i = 0; i < out.length; i++) {
    const v = m.a[i] - inner[i];
    out[i] = v > 0 ? (v > 255 ? 255 : v) : 0;
  }
  return { w: m.w, h: m.h, left: m.left, top: m.top, advance: m.advance, a: out };
}

// 描边文字（可填实）
export function drawTextHollow(surf, str, o) {
  const m = textMask(o.font, str, o.size);
  if (!m || !m.w) return 0;
  let x = o.x ?? 0;
  if (o.align === 'center') x -= m.w / 2;
  else if (o.align === 'right') x -= m.w;
  const y = (o.y ?? 0) + m.top;
  if (o.fillAlpha > 0) {
    surf.blitMask(m, Math.round(x + m.left), Math.round(y), o.fillColor || o.color, o.fillAlpha);
  }
  const th = o.thickness ?? Math.max(1.5, o.size * 0.018);
  const edge = maskOutline(m, th);
  surf.blitMask(edge, Math.round(x + m.left), Math.round(y), o.color, o.alpha ?? 1);
  return m.w;
}

// 游标（大号，版画用）
export function bigCursor(surf, x, y, k, color, alpha = 1) {
  const p = [[0, 0], [0, 30], [8, 22], [14, 36], [21, 33], [15, 20], [27, 19]]
    .map(([px, py]) => [x + px * k, y + py * k]);
  surf.fillPath([p], [0, 0, 0], { alpha: 0.35 * alpha });
  surf.fillPath([p.map(([px, py]) => [px + 2 * k, py + 2 * k])], color, { alpha: 0.95 * alpha });
}

// 人物背光：多层圆盘叠加，把黑墨从底色里托出来
export function glowDisc(surf, cx, cy, r, color, alpha = 0.3, layers = 7) {
  for (let k = layers; k >= 1; k--) {
    surf.circle(cx, cy, r * (k / layers), color, { alpha: alpha / layers, mode: 'add' });
  }
  return surf;
}

// 版画人物：背光 + 提亮黑墨，让轮廓在黑底上读得出来
export function plateFigure(surf, name, o = {}) {
  const w = o.w ?? surf.w;
  const h = o.h ?? (w * 1400 / 1000);
  const cx = (o.x ?? 0) + w / 2, cy = (o.y ?? 0) + h * 0.42;
  radialGlow(surf, cx, cy, w * 0.98, C('meDim'), (o.glow ?? 0.5) * 0.9);
  radialGlow(surf, cx, cy, w * 0.52, o.glowColor || C('me'), (o.glow ?? 0.5) * 0.55);
  const baseTone = o.inkLift ?? 0.08;
  const role = {
    black: mix(C('ink'), C('meDim'), baseTone),
    cream: C('you'),
    me: C('me'),
    paper: o.paperColor || C('paper'),
    ...(o.role || {}),
  };
  return drawFigureFast(surf, name, { ...o, role });
}

// ---------- 任意形状的字符版画 ----------
export function shapeMask(w, h, polys) {
  const tmp = new Surface(w, h);
  tmp.fillPath(polys, [255, 255, 255], { alpha: 1 });
  const mask = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < mask.length; i++, j += 3) mask[i] = tmp.data[j] > 100 ? 255 : 0;
  return mask;
}

const RAMP2 = '.:-=+*#%@';

export function glyphFill(surf, mask, o = {}) {
  const cell = o.cell ?? 14;
  const font = o.font;
  const px = Math.round(cell * 1.08);
  const dark = o.dark || C('ink');
  const light = o.light || C('you');
  const accent = o.accent || C('me');
  const alpha = o.alpha ?? 1;
  const x0 = o.x ?? 0, y0 = o.y ?? 0;
  const cols = Math.ceil(surf.w / cell), rows = Math.ceil(surf.h / cell);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x0 + c * cell + cell / 2, cy = y0 + r * cell + cell / 2;
      const ix = Math.round(cx), iy = Math.round(cy);
      if (ix < 0 || iy < 0 || ix >= surf.w || iy >= surf.h) continue;
      if (!mask[iy * surf.w + ix]) continue;
      let cov = 0;
      for (const [dx, dy] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
        const sx = Math.round(cx + dx * cell), sy = Math.round(cy + dy * cell);
        if (sx >= 0 && sy >= 0 && sx < surf.w && sy < surf.h && mask[sy * surf.w + sx]) cov++;
      }
      if (!cov) continue;
      let ch;
      if (cov < 3) {
        const l = mask[iy * surf.w + Math.max(0, ix - cell)] ? 1 : 0;
        const rr = mask[iy * surf.w + Math.min(surf.w - 1, ix + cell)] ? 1 : 0;
        const u = mask[Math.max(0, iy - cell) * surf.w + ix] ? 1 : 0;
        const d = mask[Math.min(surf.h - 1, iy + cell) * surf.w + ix] ? 1 : 0;
        ch = l !== rr && u === d ? '|' : u !== d && l === rr ? '-' : (l && !rr) ? '/' : '\\';
      } else {
        const g = (Math.sin(c * 0.7 + r * 1.3) * 0.5 + 0.5) * 0.55 + (o.tone ?? 0.45);
        ch = RAMP2[clamp(Math.floor(g * RAMP2.length), 2, RAMP2.length - 1)];
      }
      const g = glyphMask(font, ch.codePointAt(0), px);
      if (!g) continue;
      const col = cov < 3 ? light : (r % 6 === 0 ? accent : dark);
      surf.blitMask(g, Math.round(cx - g.w / 2), Math.round(cy - g.h / 2), col, alpha, 'over', mask);
    }
  }
  return surf;
}

// ---------- 人物 sprite 缓存（形状不变，按尺寸缓存三墨 mask） ----------
const spriteCache = new Map();
const SPRITE_MAX = 6;

function buildSprite(name, w, h, flipX) {
  const sw = Math.max(2, Math.ceil(w)), sh = Math.max(2, Math.ceil(h));
  const tmp = new Surface(sw, sh);
  const role = { black: [255, 0, 0], cream: [0, 255, 0], me: [0, 0, 255], paper: [0, 0, 0] };
  drawFigure(tmp, name, { x: 0, y: 0, w: sw, h: sh, role, alpha: 1, flipX, mode: 'add' });
  const idx = new Uint8Array(sw * sh);
  const d = tmp.data;
  for (let i = 0, j = 0; i < idx.length; i++, j += 3) {
    const r = d[j], g = d[j + 1], b = d[j + 2];
    idx[i] = b > 40 ? 3 : g > 40 ? 2 : r > 40 ? 1 : 0;
  }
  return { sw, sh, idx };
}

// 索引图一次遍历上色
function blitIndex(surf, sp, x, y, colors, alpha, clip, off) {
  const { sw, sh, idx } = sp;
  const d = surf.data, W = surf.w, H = surf.h;
  const c0 = colors[1] || null, c1 = colors[2] || null, c2 = colors[3] || null;
  const x0 = Math.max(0, -x), y0 = Math.max(0, -y);
  const x1 = Math.min(sw, W - x), y1 = Math.min(sh, H - y);
  for (let yy = y0; yy < y1; yy++) {
    let di = ((yy + y) * W + x + x0) * 3;
    let ii = yy * sw + x0;
    const gy = yy + y;
    for (let xx = x0; xx < x1; xx++, di += 3, ii++) {
      const v = idx[ii];
      if (!v) continue;
      if (clip && clip[gy * W + xx + x] < 100) continue;
      const col = v === 1 ? c0 : v === 2 ? c1 : c2;
      if (!col) continue;
      if (alpha >= 1) { d[di] = col[0]; d[di + 1] = col[1]; d[di + 2] = col[2]; }
      else {
        d[di] += (col[0] - d[di]) * alpha;
        d[di + 1] += (col[1] - d[di + 1]) * alpha;
        d[di + 2] += (col[2] - d[di + 2]) * alpha;
      }
    }
  }
}

export function drawFigureFast(surf, name, o = {}) {
  const w = o.w ?? surf.w;
  const h = o.h ?? (w * 1400 / 1000);
  const flipX = !!o.flipX;
  const key = `${name}|${Math.round(w)}|${Math.round(h)}|${flipX}`;
  let sp = spriteCache.get(key);
  if (!sp) {
    sp = buildSprite(name, w, h, flipX);
    if (spriteCache.size >= SPRITE_MAX) spriteCache.delete(spriteCache.keys().next().value);
    spriteCache.set(key, sp);
  }
  const role = { ...defaultRole(), ...(o.role || {}) };
  const alpha = o.alpha ?? 1;
  const x = o.x ?? 0, y = o.y ?? 0;
  const off = o.offset || {};
  let clip = o.clip || null;
  if (o.reveal !== undefined && o.reveal < 1) {
    clip = new Uint8Array(surf.w * surf.h);
    const ry = y + h * (1 - o.reveal);
    for (let yy = Math.max(0, Math.floor(ry)); yy < Math.min(surf.h, Math.ceil(y + h)); yy++) {
      clip.fill(255, yy * surf.w, (yy + 1) * surf.w);
    }
  }
  const colors = { 1: role.black, 2: role.cream, 3: role.me };
  const od = off.black || [0, 0];
  blitIndex(surf, sp, Math.round(x + od[0]), Math.round(y + od[1]), colors, alpha, clip, off);
  return surf;
}

export function plateFigureFast(surf, name, o = {}) {
  const w = o.w ?? surf.w;
  const h = o.h ?? (w * 1400 / 1000);
  const cx = (o.x ?? 0) + w / 2, cy = (o.y ?? 0) + h * 0.42;
  radialGlow(surf, cx, cy, w * 0.98, C('meDim'), (o.glow ?? 0.5) * 0.9);
  radialGlow(surf, cx, cy, w * 0.52, o.glowColor || C('me'), (o.glow ?? 0.5) * 0.55);
  const role = {
    black: mix(C('ink'), C('meDim'), o.inkLift ?? 0.08),
    cream: C('you'), me: C('me'), paper: o.paperColor || C('paper'),
    ...(o.role || {}),
  };
  return drawFigureFast(surf, name, { ...o, role });
}

// 折线 -> 描边多边形（圆头）
export function strokePolys(pts, width) {
  const hw = width / 2;
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1e-6;
    const nx = (-dy / len) * hw, ny = (dx / len) * hw;
    out.push([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]);
    out.push(circlePoly(x1, y1, hw, 8));
    out.push(circlePoly(x2, y2, hw, 8));
  }
  return out;
}

// 逐像素径向光（比多层圆快）
export function radialGlow(surf, cx, cy, r, color, alpha = 0.5) {
  const W = surf.w, H = surf.h, d = surf.data;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H, Math.ceil(cy + r));
  const r2 = r * r;
  for (let y = y0; y < y1; y += 2) {
    const dy = y - cy;
    for (let x = x0; x < x1; x += 2) {
      const dx = x - cx;
      const q = (dx * dx + dy * dy) / r2;
      if (q >= 1) continue;
      const k = (1 - q) * (1 - q) * alpha;
      const i = (y * W + x) * 3;
      d[i] += color[0] * k; d[i + 1] += color[1] * k; d[i + 2] += color[2] * k;
      if (x + 1 < W) { d[i + 3] += color[0] * k; d[i + 4] += color[1] * k; d[i + 5] += color[2] * k; }
      if (y + 1 < H) {
        const j = i + W * 3;
        d[j] += color[0] * k; d[j + 1] += color[1] * k; d[j + 2] += color[2] * k;
        if (x + 1 < W) { d[j + 3] += color[0] * k; d[j + 4] += color[1] * k; d[j + 5] += color[2] * k; }
      }
    }
  }
  return surf;
}

// ---------- 印刷校样母题：校色条 / 印张号 / 套准十字 ----------
// 这是这支片子的签名：每一张版画都是一次印刷打样，页边留着印厂的校样标记。
export function proofMarks(surf, o = {}) {
  const W = surf.w, H = surf.h;
  const sheet = o.sheet || '01/12';
  const u = Math.max(1, Math.round(W / 1920));
  const pad = Math.round(Math.min(W, H) * 0.035);
  // 校色条：四块（我 / 你 / 墨 / 错误）
  const chips = [
    [C('me'), 'C'], [C('you'), 'M'], [C('ink'), 'K'], [C('err'), 'E'],
  ];
  const cw = 54 * u, ch = 16 * u, gap = 6 * u;
  let x = pad;
  const y = H - pad - ch;
  for (const [col, label] of chips) {
    surf.rect(x, y, cw, ch, col, { alpha: 0.95 });
    surf.stroke([[x, y], [x + cw, y], [x + cw, y + ch], [x, y + ch], [x, y]], 1 * u, C('ink'), { alpha: 0.5 });
    x += cw + gap;
  }
  // 印张号（右上）
  drawText(surf, `SHEET ${sheet}`, {
    font: globalThis.__MONO, size: 13 * u, color: C('sub'),
    x: W - pad, y: pad + 10 * u, align: 'right', alpha: 0.55,
  });
  drawText(surf, 'PROOF', {
    font: globalThis.__MONO, size: 13 * u, color: C('ash'),
    x: W - pad, y: pad + 30 * u, align: 'right', alpha: 0.45,
  });
  // 四角套准十字（比裁切线更细，压在画面上）
  const arm = 14 * u;
  for (const [cx, cy] of [[pad, pad], [W - pad, pad], [pad, H - pad], [W - pad, H - pad]]) {
    surf.rect(cx - arm, cy - 0.6 * u, arm * 2, 1.2 * u, C('you'), { alpha: 0.35 });
    surf.rect(cx - 0.6 * u, cy - arm, 1.2 * u, arm * 2, C('you'), { alpha: 0.35 });
    surf.circle(cx, cy, arm * 0.45, C('you'), { alpha: 0.0 });
    surf.stroke([[...Array(17)].map((_, i) => [cx + Math.cos(i / 16 * 6.283) * arm * 0.45, cy + Math.sin(i / 16 * 6.283) * arm * 0.45])], 1 * u, C('you'), { alpha: 0.28 });
  }
  return surf;
}
