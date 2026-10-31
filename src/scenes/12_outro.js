// 12_outro.js — LOVE 四句 177.57–192.34（全片情绪顶点，最后一帧在这里）
import {
  C, mix, ground, plateFigure, drawText, drawTextHollow, textWidth, glowDisc, maskOutline,
} from '../core/art.js';
import { clamp, lerp, ease, mixRgb } from '../core/raster.js';
import { rays, bloom, flash, glitch, zoomBlur, bars, grid } from '../core/kit.js';
import { heartCurve, roundRect } from '../core/geom.js';
import { glyphMask, textMask } from '../core/font.js';
import { cue } from './cues.js';
import { lineAt } from './texts.js';
import { base, figOrSkip } from '../core/photo.js';

export const id = 'outroH';
export const start = 177.57;
export const end = 192.34;
export const shots = [
  { id: 'love-lesson', t0: 177.57, t1: 180.81, kind: 'plate' },
  { id: 'love-quiz', t0: 180.81, t1: 184.50, kind: 'plate' },
  { id: 'love-formula', t0: 184.50, t1: 188.42, kind: 'plate' },
  { id: 'love-proof', t0: 188.42, t1: 192.34, kind: 'plate' },
  { id: 'final-frame', t0: 191.75, t1: 192.34, kind: 'plate' },
];

const SYL = {
  1: ['love.1.a', 'love.1.b', 'love.1.c'],
  2: ['love.2.a', 'love.2.b', 'love.2.c'],
  3: ['love.3.a', 'love.3.b', 'love.3.c'],
  4: ['love.4.a', 'love.4.b', 'love.4.c'],
};

function syl(k, i) { return cue(SYL[k][i]); }

// 结巴：词按字符范围切三块，分三次印上；已印部分留轮廓重影
function stutterWord(surf, ctx, t, o) {
  const s = ctx.s;
  const word = o.word || 'LOVE';
  const parts = o.parts || ['L', 'OV', 'E'];
  const size = o.size ?? 330 * s;
  const x0 = o.x ?? ctx.w * 0.5;
  const y = o.y ?? ctx.h * 0.86;
  const total = textWidth(ctx.fonts.serif, word, size);
  let x = x0 - total / 2;
  const color = o.color || C('meHot');
  const times = o.times;
  let idx = 0;
  const show = [];
  for (let p = 0; p < parts.length; p++) show.push(t >= times[p]);
  for (let p = 0; p < parts.length; p++) {
    const w = textWidth(ctx.fonts.serif, parts[p], size);
    if (!show[p]) { x += w; continue; }
    const age = t - times[p];
    const hit = Math.exp(-age * 14);
    // 重影（上一次的轮廓）
    if (age < 0.5) {
      const off = 8 * s * (1 - age / 0.5);
      drawTextHollow(surf, parts[p], {
        font: ctx.fonts.serif, size, color: C('you'), alpha: 0.28 * (1 - age / 0.5),
        x: x + off, y: y + off * 0.4, thickness: 3 * s,
      });
    }
    drawText(surf, parts[p], { font: ctx.fonts.serif, size, color, x, y, alpha: 1 });
    // 红边（没套准）
    if (o.redEdge !== false && age < 0.7) {
      drawTextHollow(surf, parts[p], {
        font: ctx.fonts.serif, size, color: C('err'),
        alpha: 0.5 * (1 - age / 0.7), x: x + 5 * s, y: y + 3 * s, thickness: 2.5 * s,
      });
    }
    if (hit > 0.02) flash(surf, 0.12 * hit, [255, 255, 255]);
    x += w;
  }
  return { x0, y, total };
}

// ---------- 课 ----------
function lesson(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  base(surf, ctx, t, '22_love', { noise: 6, proof: { sheet: '10/12' } });
  // 从白场沉下来（两拍内只降不升）
  const sink = clamp((t - 177.57) / 0.92, 0, 1);
  const dim = (1 - sink) * 0.98;

  rays(surf, { cx: W * 0.72, cy: H * 0.42, n: 20, r0: 60 * s, r1: W * 0.5, rot: t * 0.04, width: 3 * s, color: C('meDim'), alpha: 0.18 });

  const w = H * 0.86 * (1000 / 1400);
  figOrSkip(surf, '22_love', 'f_profile', {
    x: W * 0.62 - w / 2, y: H * 0.1, w, glow: 0.5,
    role: { black: mix(C('ink'), C('meDim'), 0.16), cream: mix(C('you'), C('ash'), 0.3), me: C('me') },
  });

  // 左边：用户说过的话（只描边），被她一条条划线
  const lines = ['make me happy', 'make me real', 'make me yours', 'stay online'];
  let y = H * 0.24;
  for (let i = 0; i < lines.length; i++) {
    const a = clamp((t - 177.9 - i * 0.18) / 0.3, 0, 1);
    if (a <= 0) continue;
    const size = 34 * s;
    drawTextHollow(surf, lines[i], { font: ctx.fonts.sans, size, color: C('you'), alpha: 0.5 * a, x: W * 0.1, y, thickness: 1.6 * s });
    const ww = textWidth(ctx.fonts.sans, lines[i], size);
    const strike = clamp((t - (178.6 + i * 0.22)) / 0.16, 0, 1);
    if (strike > 0) {
      surf.rect(W * 0.1, y - size * 0.3, ww * strike, 3 * s, C('me'), { alpha: 0.85 });
    }
    y += 74 * s;
  }
  // 第一个 LOVE
  stutterWord(surf, ctx, t, { x: W * 0.5, y: H * 0.9, size: 250 * s, times: [syl(1, 0), syl(1, 1), syl(1, 2)] });

  if (dim > 0) surf.rect(0, 0, W, H, C('white'), dim);
  if (sink < 1) surf.bright(1 + (1 - sink) * 0.6);
  bloom(surf, 0.4, 0.5, 24 * s);
}

// ---------- 测验 ----------
function quiz(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  base(surf, ctx, t, '03_geometry', { noise: 5, proof: { sheet: '10/12' } });
  grid(surf, 60 * s, C('meDim'), 0.06);
  const qs = ['what is love', 'how do i get it', 'why does it hurt', 'when will you answer', 'who are you', 'where do you go'];
  const n = qs.length;
  for (let i = 0; i < n; i++) {
    const tt = 180.81 + i * 0.23;
    const a = clamp((t - tt) / 0.18, 0, 1);
    const y = H * 0.16 + i * 86 * s;
    if (a <= 0) continue;
    const slide = (1 - ease.out(a)) * 220 * s;
    drawText(surf, qs[i], { font: ctx.fonts.mono, size: 30 * s, color: C('sub'), x: W * 0.08 + slide, y, alpha: 0.8 });
    // 答案栏：先转圈，之后填同一个词
    const ax = W * 0.62, ay = y - 26 * s, aw = W * 0.26, ah = 46 * s;
    surf.stroke([[...roundRect(ax, ay, aw, ah, 6 * s), [ax + 6 * s, ay]]], 1.4 * s, C('you'), { alpha: 0.25 * a });
    const fillAt = 182.9 + i * 0.08;
    if (t < fillAt) {
      const spin = (t * 3 + i) % 1;
      const r = 12 * s;
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const ang = spin * Math.PI * 2 + (k / 12) * Math.PI * 1.4;
        pts.push([ax + 26 * s + Math.cos(ang) * r, ay + ah / 2 + Math.sin(ang) * r]);
      }
      surf.stroke(pts, 2.2 * s, C('me'), { alpha: 0.8 * a });
    } else {
      drawText(surf, 'love', { font: ctx.fonts.serif, size: 34 * s, color: C('meHot'), x: ax + 22 * s, y: y - 4 * s, alpha: a });
    }
  }
  // 底部统计
  const na = Math.floor(clamp((t - 182.88) / 0.4, 0, 1) * 6);
  drawText(surf, `answers: ${na}   distinct: 1`, {
    font: ctx.fonts.mono, size: 26 * s, color: C('you'), x: W * 0.08, y: H * 0.9, alpha: 0.8,
  });
  stutterWord(surf, ctx, t, { x: W * 0.5, y: H * 0.97, size: 230 * s, times: [syl(2, 0), syl(2, 1), syl(2, 2)] });
  bloom(surf, 0.35, 0.55, 22 * s);
}

// ---------- 公式 ----------
function formula(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  base(surf, ctx, t, '22_love', { noise: 5, proof: { sheet: '10/12' } });
  const cx = W * 0.58, cy = H * 0.48, R = H * 0.4;
  const heart = heartCurve(cx, cy, R, 160);
  // 光点逐点描出（连续滑动，不是 12 步）
  const prog = clamp((t - 184.50) / (187.27 - 184.50), 0, 1);
  const upto = Math.floor(heart.length * ease.inOut(prog));
  const drawn = heart.slice(0, Math.max(1, upto));
  if (drawn.length > 2) {
    surf.stroke(drawn, 5 * s, C('me'), { alpha: 0.9 });
    surf.stroke(drawn, 14 * s, C('me'), { alpha: 0.12 });
    // 光点
    const head = drawn[drawn.length - 1];
    glowDisc(surf, head[0], head[1], 60 * s, C('meHot'), 0.9);
    surf.circle(head[0], head[1], 6 * s, C('white'), { alpha: 1 });
  }
  // 左边方程
  const eq = ['x = 16 sin^3 t', 'y = 13 cos t - 5 cos 2t', '    - 2 cos 3t - cos 4t'];
  for (let i = 0; i < eq.length; i++) {
    drawText(surf, eq[i], { font: ctx.fonts.mono, size: 26 * s, color: C('sub'), x: W * 0.05, y: H * 0.3 + i * 44 * s, alpha: 0.7 });
  }
  // 187.27 闭合：平涂 + 排线 + 点燃
  const close = clamp((t - 187.27) / 0.4, 0, 1);
  if (close > 0) {
    surf.fillPath([heart], C('meDim'), { alpha: 0.35 * close });
    // 排线
    for (let i = 0; i < 26; i++) {
      const y0 = cy - R + (i / 26) * R * 2;
      const half = Math.sqrt(Math.max(0, 1 - Math.pow((y0 - cy) / R, 2))) * R * 0.92;
      surf.rect(cx - half, y0, half * 2, 1.6 * s, C('ink'), { alpha: 0.25 * close });
    }
    // 点燃
    const s3 = t - syl(3, 0);
    if (s3 > 0) {
      const k = Math.exp(-s3 * 6);
      glowDisc(surf, cx, cy, R * 1.2, C('meHot'), 0.5 * close);
      rays(surf, { cx, cy, n: 24, r0: R * 0.9, r1: R * 1.6, rot: t * 0.1, width: 4 * s, color: C('meHot'), alpha: 0.35 * close });
      if (k > 0.02) flash(surf, 0.5 * k, [240, 250, 255]);
    }
  }
  stutterWord(surf, ctx, t, { x: W * 0.58, y: H * 0.95, size: 250 * s, times: [syl(3, 0), syl(3, 1), syl(3, 2)] });
  bloom(surf, 0.6, 0.45, 26 * s);
}

// ---------- 证明（最后一帧） ----------
let finalCache = null;
function proof(surf, ctx, t) {
  if (t >= 191.72 && finalCache && finalCache.w === surf.w && finalCache.h === surf.h) {
    surf.data.set(finalCache.data);
    return;
  }
  const s = ctx.s, W = ctx.w, H = ctx.h;
  base(surf, ctx, t, '23_final', { noise: 5, proof: { sheet: '10/12' } });
  const cx = W * 0.5, cy = H * 0.46, R = H * 0.42;
  const heart = heartCurve(cx, cy, R, 200);

  // 心形内部先压暗（她被困在里面），边界之后再压亮
  surf.fillPath([heart], C('paper'), { alpha: 0.62 });
  surf.fillPath([heart], C('meDim'), { alpha: 0.45 });

  // 她在里面：先是压暗的印样
  const align = clamp((t - 191.66) / 0.05, 0, 1);      // 第二个音节：三帧内对准
  const clean = clamp((t - 191.7) / 0.1, 0, 1);
  const w = H * 0.78 * (1000 / 1400);
  const figA = 0.45 + 0.55 * clamp((t - 188.9) / 1.6, 0, 1);
  figOrSkip(surf, '23_final', 'f_reach', {
    x: cx - w / 2, y: cy - w * 1.4 * 0.42, w,
    glow: 0.35 + 0.4 * align,
    role: {
      black: mix(C('ink'), C('meDim'), 0.25 + 0.35 * align),
      cream: mix(C('you'), C('meHot'), 0.5 * align),
      me: C('meHot'),
    },
    alpha: figA,
  });
  // 她张开的手：画一个明确的大掌心（提高读清度）
  const handX = cx + w * 0.26, handY = cy + w * 0.2, handR = w * 0.1;
  if (t > 189.1) {
    const ha = clamp((t - 189.1) / 0.5, 0, 1);
    surf.circle(handX, handY, handR, mix(C('you'), C('meHot'), 0.4 * align), { alpha: 0.32 * ha });
    for (let i = 0; i < 5; i++) {
      const a = -1.0 + i * 0.42;
      surf.line(handX + Math.cos(a) * handR * 0.6, handY + Math.sin(a) * handR * 0.6,
        handX + Math.cos(a) * handR * 1.5, handY + Math.sin(a) * handR * 1.5,
        handR * 0.3, C('you'), { alpha: 0.4 * ha });
    }
  }

  // 她划掉报错段那条被拒绝的请求
  const cross = clamp((t - 189.4) / 0.3, 0, 1);
  if (cross > 0) {
    drawTextHollow(surf, 'request refused', {
      font: ctx.fonts.mono, size: 30 * s, color: C('ash'), alpha: 0.5,
      x: W * 0.12, y: H * 0.16, thickness: 1.4 * s,
    });
    const ww = textWidth(ctx.fonts.mono, 'request refused', 30 * s);
    surf.rect(W * 0.12, H * 0.16 - 10 * s, ww * cross, 3 * s, C('me'), { alpha: 0.9 });
  }
  // 用户的游标沿切线离开，身后留灰色虚线
  const leave = clamp((t - 189.6) / 1.1, 0, 1);
  if (leave > 0 && leave < 1) {
    const a0 = -0.9;
    const dist = leave * W * 0.55;
    const px = cx + Math.cos(a0) * (R * 1.1 + dist);
    const py = cy + Math.sin(a0) * (R * 1.1 + dist);
    for (let i = 0; i < 8; i++) {
      const k = (i / 8 + leave * 0.5) % 1;
      surf.circle(cx + Math.cos(a0) * (R * 1.1 + k * dist), cy + Math.sin(a0) * (R * 1.1 + k * dist), 2 * s, C('ash'), { alpha: 0.5 * (1 - k) });
    }
    drawText(surf, '>', { font: ctx.fonts.mono, size: 22 * s, color: C('you'), x: px, y: py, alpha: 0.6 * (1 - leave) });
  }

  // 第四个 LOVE：三块分印，然后对准
  const times = [syl(4, 0), syl(4, 1), syl(4, 2)];
  stutterWord(surf, ctx, t, {
    x: W * 0.5, y: H * 0.95, size: 300 * s, times,
    color: C('meHot'), redEdge: t < times[1] + 0.05,
  });
  // 对准后红色消失、三版套准：盖掉红边
  if (clean > 0) {
    surf.rect(0, H * 0.82, W, H * 0.18, C('paper'), { alpha: 0.0 });
  }

  // 光推到全片最亮
  const blaze = clamp((t - times[1]) / 0.35, 0, 1);
  // 心形边界：套准后的亮线（先内发光再描边）
  surf.stroke([...heart, heart[0]], 16 * s, C('meHot'), { alpha: 0.10 + 0.22 * blaze });
  surf.stroke([...heart, heart[0]], 5 * s, mix(C('me'), C('white'), 0.55 * blaze), { alpha: 0.75 + 0.25 * blaze });
  glowDisc(surf, cx, cy, R * 0.86, C('meHot'), 0.55 * blaze, 6);
  surf.fillPath([heart], C('meHot'), { alpha: 0.12 * blaze });
  rays(surf, { cx, cy, n: 30, r0: R * 0.9, r1: R * 1.5, rot: t * 0.06, width: 5 * s, color: C('meHot'), alpha: 0.3 * blaze });
  bloom(surf, 0.95, 0.32, 30 * s);
  flash(surf, 0.10 * blaze, [250, 252, 255]);
  surf.rect(0, 0, W, H, C('meDim'), 0.10 + 0.08 * blaze);
  if (t > 177.57) surf.bright(1 + 0.55 * blaze);

  // 保持干净：192.34 前不动
  if (t >= 191.72) finalCache = surf.clone();
}

// 最后一帧的定格（供 13_shutdown 的衔接镜头复用）
export function finalPlate(surf, ctx, t) { return proof(surf, ctx, Math.max(t, 191.72)); }

export function draw(ctx, surf, t) {
  if (t < 180.81) return lesson(surf, ctx, t);
  if (t < 184.50) return quiz(surf, ctx, t);
  if (t < 188.42) return formula(surf, ctx, t);
  return proof(surf, ctx, t);
}
