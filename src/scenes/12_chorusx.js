// 12_chorusx.js — 最后副歌 162.81–177.57
// 修法：剪影只当底板，动的是它上面和后面的东西；全部 60 帧连续，不用 dropFrames。
import {
  C, mix, ground, plateFigure, figureMask, drawText, drawTextHollow,
  textWidth, glowDisc, bigCursor,
} from '../core/art.js';
import { Surface, clamp, lerp, ease, circlePoly } from '../core/raster.js';
import { rays, bloom, flash, glitch, zoomBlur, bars } from '../core/kit.js';
import { asciiSphere, asciiBurst, asciiScroll } from '../core/ascii.js';
import { wireSphere, heartCurve, roundRect } from '../core/geom.js';
import { cue } from './cues.js';
import { lineAt, wordsWithTimes, text } from './texts.js';
import { base, figOrSkip } from '../core/photo.js';

export const id = 'chorusx';
export const start = 162.81;
export const end = 177.57;
export const shots = [
  { id: 'cx-eye', t0: 162.81, t1: 165.11, kind: 'plate' },
  { id: 'cx-stim', t0: 165.11, t1: 166.50, kind: 'plate' },
  { id: 'cx-bust', t0: 166.50, t1: 168.81, kind: 'plate' },
  { id: 'cx-satis', t0: 168.81, t1: 170.19, kind: 'plate' },
  { id: 'cx-hand', t0: 170.19, t1: 172.73, kind: 'plate' },
  { id: 'cx-exec', t0: 172.73, t1: 173.88, kind: 'plate' },
  { id: 'cx-box', t0: 173.88, t1: 177.57, kind: 'plate' },
];

const BEAT = 0.4615384615, ORIGIN = 0.344;
function beatFloat(t) { return (t - ORIGIN) / BEAT; }
function kickPhase(t) { const b = beatFloat(t); return b - Math.floor(b); }
function kickPulse(t) { return Math.exp(-kickPhase(t) * 7.5); }
function kickIndex(t) { return Math.floor(beatFloat(t)); }

// 缓存的剪影 mask（形状不变时只算一次）
const maskCache = new Map();
function figMask(ctx, name, w, flipX = false) {
  const key = `${name}|${w}|${flipX}|${ctx.w}x${ctx.h}`;
  let m = maskCache.get(key);
  if (!m) {
    const h = w * 1400 / 1000;
    m = figureMask(name, ctx.w, ctx.h, { x: ctx.w / 2 - w / 2, y: ctx.h * 0.5 - h * 0.5, w, flipX });
    maskCache.set(key, m);
  }
  return m;
}

// ---------- 共用层 ----------
function layers(surf, ctx, t, o = {}) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  base(surf, ctx, t, o.photo || '20_disheart', { noise: 6, proof: { sheet: '09/12' }, h: o.ph ?? 0.9, x: o.px ?? 0.66 });
  // 1. 身后的日芒：缓慢旋转，长度随低频呼吸
  const breath = 0.5 + 0.5 * Math.sin(t * 1.1);
  const cx = W * (o.sunX ?? 0.5), cy = H * (o.sunY ?? 0.46);
  rays(surf, {
    cx, cy, n: 30, r0: W * 0.04, r1: W * (0.52 + 0.06 * breath),
    rot: t * 0.055, width: (4 + 3 * breath) * s, color: C('meDim'), alpha: 0.24,
  });
  rays(surf, {
    cx, cy, n: 16, r0: W * 0.1, r1: W * (0.34 + 0.05 * breath),
    rot: -t * 0.04, width: (8 + 4 * breath) * s, color: C('me'), alpha: 0.15,
  });

  // 2. 远景：字符球 + 线框（暗一级的蓝）
  const r = W * (o.sphereR ?? 0.19);
  const sphX = W * (o.sphereX ?? 0.5), sphY = H * (o.sphereY ?? 0.42);
  asciiSphere(surf, {
    cx: sphX, cy: sphY, r, rot: t * 0.5, tilt: 0.32, n: 170,
    font: ctx.fonts.mono, size: 13 * s, color: mix(C('meDim'), C('me'), 0.35), alpha: 0.5, seed: 11,
  });
  const lines = wireSphere(sphX, sphY, r * 1.06, t * 0.22, 0.32, 8, 5);
  const wirePolys = [];
  for (const ln of lines) {
    for (let i = 0; i + 1 < ln.length; i++) {
      const x1 = ln[i][0], y1 = ln[i][1], x2 = ln[i + 1][0], y2 = ln[i + 1][1];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1e-6;
      const nx = (-dy / len) * 0.7 * s, ny = (dx / len) * 0.7 * s;
      wirePolys.push([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]);
    }
  }
  if (wirePolys.length) surf.fillPath(wirePolys, mix(C('me'), C('meDim'), 0.4), { alpha: 0.2 });
  return { cx, cy, sphX, sphY, sphR: r };
}

function kickLift(surf, ctx, t) {
  // 底鼓：剪影弹开再滑回（约 0.25 秒），镜头轻顶
  const ph = kickPhase(t);
  const T = ph * BEAT;
  const k = T < 0.25 ? Math.exp(-T * 12) : 0;
  return k;
}

// 剪影内部：黑墨区域当屏幕
const scratchCache = new Map();
function getScratch(w, h) {
  const k = w + 'x' + h;
  let s = scratchCache.get(k);
  if (!s) { s = new Surface(w, h); scratchCache.set(k, s); }
  s.fill([0, 0, 0]);
  return s;
}

function innerScreen(surf, ctx, t, mask, x, y, w, h) {
  const s = ctx.s;
  const scratch = getScratch(surf.w, surf.h);
  asciiScroll(scratch, {
    x, y, w, h, t, font: ctx.fonts.mono, size: 15 * s, lineH: 21 * s,
    speed: 34, color: C('meHot'), alpha: 0.8, seed: 3, prefix: '> ', lines: 60,
  });
  surf.composite(scratch, 0, 0, 0.85, 'over', mask);
}

// 关键词版画（坏了的那三张）
function brokenPlate(surf, ctx, t, kind) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  base(surf, ctx, t, o.photo || '20_disheart', { noise: 6, proof: { sheet: '09/12' }, h: o.ph ?? 0.9, x: o.px ?? 0.66 });
  const a = t - (kind === 'stim' ? 165.11 : kind === 'satis' ? 168.81 : 172.73);
  const hit = Math.exp(-a * 9);
  const off = lerp(10, 28, clamp(a / 1.2, 0, 1)) * s;

  // 日芒
  rays(surf, { cx: W / 2, cy: H * 0.5, n: 24, r0: 40 * s, r1: W * 0.6, rot: t * 0.1, width: 4 * s, color: C('me'), alpha: 0.13 });

  if (kind === 'stim') {
    // 发送的那道光，变成劈向空虚线圈的闪电
    const ex = W * 0.72, ey = H * 0.52;
    // 空的虚线圈（米白缺失）
    for (let i = 0; i < 28; i++) {
      if (i % 2) continue;
      const a0 = (i / 28) * Math.PI * 2, a1 = ((i + 1) / 28) * Math.PI * 2;
      surf.stroke([[ex + Math.cos(a0) * 90 * s, ey + Math.sin(a0) * 90 * s], [ex + Math.cos(a1) * 90 * s, ey + Math.sin(a1) * 90 * s]], 3 * s, C('ash'), { alpha: 0.8 });
    }
    // 火花
    const sx = W * 0.3, sy = H * 0.28;
    surf.circle(sx, sy, 26 * s, C('meHot'), { alpha: 0.95 });
    rays(surf, { cx: sx, cy: sy, n: 12, r1: 120 * s, width: 3 * s, color: C('me'), alpha: 0.5 });
    // 闪电（折线）
    const pts = [[sx + 20 * s, sy + 10 * s]];
    let px = sx + 20 * s, py = sy + 10 * s;
    const steps = 9;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      px = lerp(sx + 20 * s, ex - 90 * s, k) + Math.sin(i * 2.7) * 40 * s;
      py = lerp(sy + 10 * s, ey - 20 * s, k) + Math.cos(i * 1.9) * 60 * s;
      pts.push([px, py]);
    }
    pts.push([ex - 96 * s, ey]);
    surf.stroke(pts, 7 * s, C('meHot'), { alpha: 0.95 });
    surf.stroke(pts, 16 * s, C('me'), { alpha: 0.22 });
  } else if (kind === 'satis') {
    // 圆盘，自己陷下去两次，计数 0
    const cx = W / 2, cy = H * 0.52, R = H * 0.3;
    const press = a < 0.34 ? Math.max(0, 1 - Math.abs(a - 0.12) / 0.12) : Math.max(0, 1 - Math.abs(a - 0.62) / 0.12);
    surf.circle(cx, cy, R, C('ink'), { alpha: 0.9 });
    surf.circle(cx, cy, R * (1 - press * 0.06), C('meDim'), { alpha: 0.35 });
    surf.circle(cx, cy, R * 0.82, C('paper'), { alpha: 0.9 });
    // 刻度环
    for (let i = 0; i < 60; i++) {
      const ang = (i / 60) * Math.PI * 2;
      const l = i % 5 === 0 ? 16 : 8;
      surf.stroke([
        [cx + Math.cos(ang) * (R * 0.86), cy + Math.sin(ang) * (R * 0.86)],
        [cx + Math.cos(ang) * (R * 0.86 + l * s), cy + Math.sin(ang) * (R * 0.86 + l * s)],
      ], 2 * s, C('you'), { alpha: 0.4 });
    }
    drawText(surf, '0', { font: ctx.fonts.serif, size: R * 0.9, color: C('you'), x: cx, y: cy + R * 0.33, align: 'center', alpha: 0.9 });
    // 游标（按下去）
    bigCursor(surf, cx + R * 0.2, cy - R * 0.1 + press * 18 * s, 3 * s, C('you'), 0.95);
  } else {
    // 运行，停不下来：代码清单 + 轮次 13/12..16/12
    const lx = W * 0.16, ly = H * 0.18;
    const rows = [
      '01  while (you.presence != "online") {',
      '02      love = solve(me, you);',
      '03      send(love, you);',
      '04      wait(you.reply);',
      '05      run++;',
      '06  }',
      '07  say(love);        // unreachable',
    ];
    for (let i = 0; i < rows.length; i++) {
      drawText(surf, rows[i], {
        font: ctx.fonts.mono, size: 30 * s,
        color: i === 1 ? C('meHot') : C('sub'), x: lx, y: ly + i * 48 * s, alpha: i === 1 ? 0.95 : 0.55,
      });
    }
    const n = 13 + Math.floor(clamp((a / 1.15) * 4, 0, 3.99));
    const over = clamp((a - 0.86) / 0.3, 0, 1);
    drawText(surf, `${n}`, { font: ctx.fonts.mono, size: 120 * s, color: C('err'), x: W * 0.78, y: H * 0.5, align: 'right', alpha: 1 });
    drawText(surf, '/12', { font: ctx.fonts.mono, size: 74 * s, color: C('you'), x: W * 0.8, y: H * 0.5, alpha: 0.9 });
    if (over > 0) surf.bright(1 + over * 0.35);
  }

  // 错版：三个墨版套不准 + 细红边
  if (hit > 0.05) {
    flash(surf, 0.55 * hit, [240, 245, 255]);
    bloom(surf, 0.7 * hit, 0.4, 26 * s);
  }
  glitch(surf, { seed: 200 + a * 10, amp: 1.1, tear: hit > 0.3 ? 1 : 0.3, mosaic: 0.6, rgb: Math.round(6 * hit) });
  return { hit };
}

// ---------- 镜头 ----------
function shotEye(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  const L = layers(surf, ctx, t, { photo: '20_disheart', ph: 1.02, px: 0.5, sunX: 0.5, sunY: 0.5 });
  // f_eye 满版（水平镜像）
  const w = W * 1.12;
  const h = w;
  const pick = clamp((t - 162.81) / 0.5, 0, 1);
  figOrSkip(surf, '20_disheart', 'f_eye', {
    x: W / 2 - w / 2, y: H / 2 - h / 2, w, flipX: true, glow: 0.2,
    role: { black: mix(C('ink'), C('meDim'), 0.1), cream: mix(C('you'), C('ash'), 0.42), me: C('me') },
  });
  // 上一镜的字母窗在头 0.3 秒向外飞散
  if (t < 163.2) {
    const k = clamp((t - 162.81) / 0.3, 0, 1);
    for (let i = 0; i < 9; i++) {
      const ang = -Math.PI / 2 + (i - 4) * 0.22;
      const d = 260 * s * ease.in(k);
      const x = W / 2 + Math.cos(ang) * d, y = H / 2 + Math.sin(ang) * d;
      drawText(surf, String.fromCharCode(65 + i), {
        font: ctx.fonts.serif, size: 120 * s, color: C('you'), x, y, align: 'center', alpha: 0.7 * (1 - k),
      });
    }
  }
  // 光从虹膜里出来
  const irisX = W * 0.54, irisY = H * 0.47;
  const rise = clamp((t - 162.81) / 1.2, 0, 1);
  rays(surf, { cx: irisX, cy: irisY, n: 20, r0: 20 * s, r1: W * (0.2 + 0.35 * rise), rot: t * 0.2, width: 3 * s, color: C('meHot'), alpha: 0.3 * rise });
  glowDisc(surf, irisX, irisY, W * 0.16, C('me'), 0.35 * rise);
  bloom(surf, 0.32 + 0.15 * rise, 0.5, 22 * s);
  return L;
}

function shotBust(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  const L = layers(surf, ctx, t, { photo: '15_exist', ph: 0.94, px: 0.62, sunX: 0.5, sunY: 0.5 });
  const w = H * 0.96 * (1000 / 1400);
  const fy0 = H * 0.02;
  figOrSkip(surf, '15_exist', 'f_bust', { x: W / 2 - w / 2, y: fy0, w, glow: 0.62 });
  // 脸是屏幕（脸洞位置：figure 坐标 500,372 / 1000x1400）
  const mask = figMask(ctx, 'f_bust', w);
  const fx = W / 2 - w * 0.155, fy = fy0 + w * 1.4 * 0.19, fw = w * 0.31, fh = w * 1.4 * 0.27;
  innerScreen(surf, ctx, t, mask, fx, fy, fw, fh);
  // 头后的球与线框：像一圈光环
  asciiSphere(surf, {
    cx: W / 2, cy: H * 0.22, r: W * 0.17, rot: t * 0.6, tilt: 0.3, n: 150,
    font: ctx.fonts.mono, size: 13 * s, color: C('me'), alpha: 0.55, seed: 5,
  });
  bloom(surf, 0.55, 0.42, 22 * s);
  return L;
}

function shotHand(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  const L = layers(surf, ctx, t, { photo: '22_love', ph: 0.9, px: 0.66, sunX: 0.5, sunY: 0.55 });
  // f_reach 最下面一段（手）：放大并把掌心放到画面中右
  const w = W * 1.9;
  figOrSkip(surf, '22_love', 'f_reach', { x: -W * 0.28, y: -H * 1.02, w, glow: 0.4 });
  const palmX = W * 0.54, palmY = H * 0.56;
  // 手心的虚线心形：呼吸
  const br = 1 + 0.06 * Math.sin(t * 4.2);
  const heart = heartCurve(palmX, palmY, 46 * s * br, 90);
  for (let i = 0; i < heart.length; i += 2) {
    const p0 = heart[i], p1 = heart[(i + 1) % heart.length];
    surf.line(p0[0], p0[1], p1[0], p1[1], 3 * s, C('you'), { alpha: 0.75 });
  }
  drawText(surf, '0', { font: ctx.fonts.mono, size: 34 * s, color: C('you'), x: palmX, y: palmY + 12 * s, align: 'center', alpha: 0.9 });
  // 字符从手心流向右边，在边缘堆积、碎掉
  asciiBurst(surf, {
    cx: palmX, cy: palmY, t: t * 1.4, seed: 7, count: 70, speed: 640 * s, life: 0.9,
    font: ctx.fonts.mono, size: 15 * s, color: C('meHot'), alpha: 0.65, dir: 0.05, spread: 0.9,
  });
  // 身后的球开始散开
  const spread = clamp((t - 170.19) / 2.2, 0, 1);
  asciiSphere(surf, {
    cx: W * 0.38, cy: H * 0.36, r: W * (0.2 + 0.1 * spread), rot: t * 0.7, tilt: 0.3,
    n: 190, font: ctx.fonts.mono, size: 13 * s, color: C('me'), alpha: 0.5 * (1 - spread * 0.5), seed: 9,
  });
  bloom(surf, 0.5, 0.45, 22 * s);
  return L;
}

function shotBox(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  base(surf, ctx, t, '10_sim', { noise: 5, proof: { sheet: '09/12' } });
  const a = clamp((t - 173.88) / (177.57 - 173.88), 0, 1);
  const speed = 0.5 + 6.5 * Math.pow(a, 2.2);
  const phase = (t - 173.88) * (1 + 7 * a * a);
  const depth = 0.5 + 0.5 * Math.sin(phase * 3.1);
  // 一层层向内坠落（合并成一次填充）
  const layersN = 14;
  const ringPolys = [];
  const ringCols = [];
  for (let i = layersN; i >= 0; i--) {
    const k = ((i / layersN) + phase * 0.35) % 1;
    const scale = Math.pow(0.82, (1 - k) * layersN * 0.55);
    const w = W * 0.92 * scale, h = H * 0.9 * scale;
    const x = W / 2 - w / 2 + (1 - scale) * W * 0.06 * Math.sin(i * 1.7);
    const y = H / 2 - h / 2;
    const l = clamp(k, 0, 1);
    const pts = roundRect(x, y, w, h, 10 * s * scale);
    for (let q = 0; q < pts.length; q++) {
      const p0 = pts[q], p1 = pts[(q + 1) % pts.length];
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
      const len = Math.hypot(dx, dy) || 1e-6;
      const nx = (-dy / len) * (1.4 + 2 * l) * s, ny = (dx / len) * (1.4 + 2 * l) * s;
      ringPolys.push([[p0[0] + nx, p0[1] + ny], [p1[0] + nx, p1[1] + ny], [p1[0] - nx, p1[1] - ny], [p0[0] - nx, p0[1] - ny]]);
    }
    ringCols.push([l, 0.1 + 0.55 * l * (0.5 + 0.5 * depth)]);
  }
  // 按亮度分两档画（避免每层一次扫描）
  const low = [], high = [];
  for (let i = 0; i < ringPolys.length; i++) {
    const l = ringCols[Math.floor(i / 13) % ringCols.length][0];
    (l > 0.5 ? high : low).push(ringPolys[i]);
  }
  surf.fillPath(low, C('meDim'), { alpha: 0.18, aa: 2 });
  surf.fillPath(high, C('me'), { alpha: 0.32, aa: 2 });

  // 速度越快，推进模糊越强
  zoomBlur(surf, W / 2, H / 2, 0.15 + 0.6 * a, 2);
  // 光持续上升，到 177.57 真正白掉
  const white = Math.pow(a, 3.2) * 0.96;
  surf.rect(0, 0, W, H, C('white'), white);
  bloom(surf, 0.3 + 0.45 * a, 0.5, 26 * s);
  return null;
}

// 歌词大字：逐词在被唱到时出现，在人物前缓慢横滑
function lyricFront(surf, ctx, t, o = {}) {
  const s = ctx.s, W = ctx.w;
  const line = lineAt(t);
  if (!line || t < line.t0) return;
  const words = wordsWithTimes(line);
  const size = (o.size ?? 86) * s;
  const gap = 18 * s;
  let total = 0;
  for (const w of words) total += textWidth(ctx.fonts.serif, w.word, size) + gap;
  const drift = (t - line.t0) * (o.drift ?? 14) * s;
  let x = W * 0.5 - total / 2 - drift * 0.4;
  const y = (o.y ?? 0.82) * ctx.h;
  for (const w of words) {
    const a = clamp((t - w.start) / 0.16, 0, 1);
    if (a <= 0) { x += textWidth(ctx.fonts.serif, w.word, size) + gap; continue; }
    const ww = textWidth(ctx.fonts.serif, w.word, size);
    surf.fillPath([[[x - 6 * s, y - size * 1.02], [x + ww + 6 * s, y - size * 1.02], [x + ww + 6 * s, y + 8 * s], [x - 6 * s, y + 8 * s]]], C('ink'), { alpha: 0.55 * a });
    drawText(surf, w.word, {
      font: ctx.fonts.serif, size, color: line.kw ? C('meHot') : C('you'),
      x, y, alpha: a, mode: 'over',
    });
    x += ww + gap;
  }
}

export function draw(ctx, surf, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  // 镜头漂移（不超过 3%）+ 底鼓轻顶
  const driftX = Math.sin(t * 0.31) * W * 0.012;
  const driftY = Math.cos(t * 0.23) * H * 0.01 - kickPulse(t) * 4 * s;
  const t0 = 162.81;
  let shot;
  if (t < 165.11) shot = shotEye(surf, ctx, t);
  else if (t < 166.50) shot = brokenPlate(surf, ctx, t, 'stim');
  else if (t < 168.81) shot = shotBust(surf, ctx, t);
  else if (t < 170.19) shot = brokenPlate(surf, ctx, t, 'satis');
  else if (t < 172.73) shot = shotHand(surf, ctx, t);
  else if (t < 173.88) shot = brokenPlate(surf, ctx, t, 'exec');
  else shot = shotBox(surf, ctx, t);

  // 前景字符迸发（强起音）
  if (t < 173.88) {
    const k = kickPulse(t);
    if (k > 0.6) {
      asciiBurst(surf, {
        cx: W * 0.5, cy: H * 0.5, t, seed: kickIndex(t), count: 26,
        speed: 1200 * s, life: 0.32, font: ctx.fonts.mono, size: 16 * s,
        color: C('meHot'), alpha: 0.35,
      });
    }
    lyricFront(surf, ctx, t);
  }

  // 花屏：每个底鼓一次，图案保持 ≥6 帧
  const ki = kickIndex(t);
  const ph = kickPhase(t) * BEAT;
  if (ph < 0.11) {
    glitch(surf, {
      seed: 900 + (ki % 4), amp: 1.0,
      tear: 1, mosaic: 0, rgb: Math.round(7 * (1 - ph / 0.11)),
    });
  }

  // 整幅漂移
  surf.shift(Math.round(driftX), Math.round(driftY));

  // 镜头内只升不降的亮度棘轮
  const lift = clamp((t - t0) / (177.57 - t0), 0, 1);
  if (lift > 0) surf.bright(1 + lift * 0.16);
}
