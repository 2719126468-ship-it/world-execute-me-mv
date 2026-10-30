// 10_error.js — 报错段 125.65–148.04
import { C, mix, plateFigure, drawText, drawTextHollow, textWidth, glowDisc, ground } from '../core/art.js';
import { clamp, lerp, ease } from '../core/raster.js';
import { bloom, flash, glitch, scanlines } from '../core/kit.js';
import { roundRect } from '../core/geom.js';
import { ERRORS } from './errors.js';
import { cue } from './cues.js';

export const id = 'error';
export const start = 125.65;
export const end = 148.04;
export const shots = [
  { id: 'err-open', t0: 125.65, t1: 129.34, kind: 'ui' },
  { id: 'err-send', t0: 129.34, t1: 144.5, kind: 'ui' },
  { id: 'err-12', t0: 144.5, t1: 145.5, kind: 'ui' },
  { id: 'err-15', t0: 145.5, t1: 147.34, kind: 'ui' },
  { id: 'err-last', t0: 147.34, t1: 148.04, kind: 'code' },
];

function windowErr(surf, ctx, t, o = {}) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  const red = o.red ?? 0;
  const x = W * 0.1, y = H * 0.1, w = W * 0.8, h = H * 0.8;
  surf.fillPath([roundRect(x, y, w, h, 14 * s)], mix(C('paper'), [0, 0, 0], 0.2), { alpha: 0.95 });
  surf.stroke([...roundRect(x, y, w, h, 14 * s), [x, y]], 2.5 * s, mix(C('you'), C('err'), red), { alpha: 0.3 + 0.6 * red });
  // 标题栏
  surf.rect(x, y + 54 * s, w, 1.5 * s, C('you'), { alpha: 0.15 });
  drawText(surf, 'world.execute(me);  \u2014  error', { font: ctx.fonts.monoUi, size: 18 * s, color: C('sub'), x: x + 24 * s, y: y + 34 * s, alpha: 0.75 });
  drawText(surf, 'x', { font: ctx.fonts.monoUi, size: 20 * s, color: C('err'), x: x + w - 30 * s, y: y + 34 * s, alpha: 0.8 });
  return { x, y, w, h };
}

function errOpen(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  surf.fill(mix(C('ink'), C('paper'), 0.4));
  const w = windowErr(surf, ctx, t, { red: clamp((t - 128.2) / 1.0, 0, 1) * 0.7 });
  // 被拒绝的请求
  drawText(surf, 'you: say you love me', { font: ctx.fonts.sans, size: 30 * s, color: C('you'), x: w.x + 40 * s, y: w.y + 130 * s, alpha: 0.85 });
  const e0 = ERRORS[0];
  const a = clamp((t - e0.t) / 0.25, 0, 1);
  if (a > 0) {
    surf.fillPath([roundRect(w.x + 40 * s, w.y + 190 * s, w.w - 80 * s, 110 * s, 8 * s)], C('ink'), { alpha: 0.85 * a });
    surf.stroke([...roundRect(w.x + 40 * s, w.y + 190 * s, w.w - 80 * s, 110 * s, 8 * s), [w.x + 48 * s, w.y + 190 * s]], 2 * s, C('err'), { alpha: 0.85 * a });
    drawText(surf, e0.code, { font: ctx.fonts.mono, size: 26 * s, color: C('err'), x: w.x + 62 * s, y: w.y + 236 * s, alpha: a });
    drawText(surf, e0.text, { font: ctx.fonts.mono, size: 20 * s, color: C('sub'), x: w.x + 62 * s, y: w.y + 272 * s, alpha: 0.8 * a });
  }
  // refused × N 计数
  const n = Math.floor(clamp((t - 129.34) / 8, 0, 99));
  drawText(surf, 'refused  \u00d7 ' + n, { font: ctx.fonts.mono, size: 40 * s, color: C('err'), x: w.x + w.w - 40 * s, y: w.y + 120 * s, align: 'right', alpha: 0.9 });
  if (n > 0 && n % 3 === 0) surf.rect(0, 0, W, H, C('err'), { alpha: 0.03 });
}

function errSend(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  surf.fill(mix(C('ink'), C('paper'), 0.35));
  scanlines(surf, 0.06, 4);
  const w = windowErr(surf, ctx, t, { red: 0.4 + 0.2 * Math.sin(t * 2) });
  // 卡片堆叠
  const shown = ERRORS.filter((e) => t >= e.t);
  for (let i = Math.max(0, shown.length - 8); i < shown.length; i++) {
    const e = shown[i];
    const k = shown.length - 1 - i;
    const a = clamp((t - e.t) / 0.2, 0, 1);
    const cx = w.x + 60 * s + k * 26 * s, cy = w.y + 170 * s + k * 84 * s;
    const cw = w.w * 0.56, chh = 72 * s;
    surf.fillPath([roundRect(cx, cy, cw, chh, 8 * s)], mix(C('ink'), C('paper'), 0.25), { alpha: 0.95 * a });
    surf.stroke([...roundRect(cx, cy, cw, chh, 8 * s), [cx + 8 * s, cy]], 2 * s, C('err'), { alpha: 0.7 * a });
    drawText(surf, String(e.n).padStart(2, '0'), { font: ctx.fonts.mono, size: 22 * s, color: C('err'), x: cx + 18 * s, y: cy + 46 * s, alpha: a });
    drawText(surf, e.code, { font: ctx.fonts.mono, size: 20 * s, color: C('sub'), x: cx + 66 * s, y: cy + 34 * s, alpha: 0.9 * a });
    drawText(surf, e.text, { font: ctx.fonts.mono, size: 15 * s, color: C('ash'), x: cx + 66 * s, y: cy + 58 * s, alpha: 0.7 * a });
  }
  // 发送键自己按下
  const beat = 0.344 + Math.floor((t - 0.344) / 0.923) * 0.923;
  const press = clamp(1 - Math.abs(t - beat) / 0.12, 0, 1);
  const bx = w.x + w.w - 70 * s, by = w.y + w.h - 60 * s;
  surf.circle(bx, by, 24 * s * (1 - press * 0.12), C('err'), { alpha: 0.9 });
  surf.stroke([[bx - 8 * s, by], [bx + 8 * s, by], [bx + 2 * s, by - 7 * s]], 3 * s, C('ink'), { alpha: 0.9 });
  // 计数
  const n = Math.floor((t - 129.34) / 0.92);
  drawText(surf, 'refused  \u00d7 ' + n, { font: ctx.fonts.mono, size: 44 * s, color: C('err'), x: w.x + w.w - 50 * s, y: w.y + 140 * s, align: 'right', alpha: 0.95 });
  // 花屏转场
  if ((t > 143.9 && t < 144.2) || (t > 144.5 && t < 144.7)) {
    glitch(surf, { seed: Math.floor(t * 10), amp: 1.2, tear: 1, mosaic: 1, rgb: 10 });
  }
}

function err15(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  surf.fill(mix(C('ink'), C('paper'), 0.3));
  const w = windowErr(surf, ctx, t, { red: 0.9 });
  // 第 15 号：最大的一张，居中
  const a = clamp((t - 145.5) / 0.3, 0, 1);
  const cw = W * 0.62, chh = H * 0.34;
  const cx = W / 2 - cw / 2, cy = H / 2 - chh / 2;
  surf.fillPath([roundRect(cx, cy, cw, chh, 12 * s)], mix(C('ink'), [0, 0, 0], 0.2), { alpha: 0.96 * a });
  surf.stroke([...roundRect(cx, cy, cw, chh, 12 * s), [cx + 12 * s, cy]], 3 * s, C('err'), { alpha: 0.95 * a });
  drawText(surf, '15', { font: ctx.fonts.mono, size: 30 * s, color: C('err'), x: cx + 34 * s, y: cy + 60 * s, alpha: a });
  drawText(surf, 'ERR_UNRESOLVED_LOVE', { font: ctx.fonts.mono, size: 34 * s, color: C('err'), x: cx + 34 * s, y: cy + 120 * s, alpha: a });
  drawText(surf, 'love = undefined', { font: ctx.fonts.mono, size: 30 * s, color: C('you'), x: cx + 34 * s, y: cy + 176 * s, alpha: 0.9 * a });
  drawText(surf, 'the only value that never resolves', { font: ctx.fonts.mono, size: 18 * s, color: C('ash'), x: cx + 34 * s, y: cy + 216 * s, alpha: 0.7 * a });
  bloom(surf, 0.4, 0.5, 20 * s);
}

function errLast(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  surf.fill(C('ink'));
  scanlines(surf, 0.08, 3);
  // 变红的窗口轮廓压扁成一条线
  const k = clamp((t - 147.34) / 0.3, 0, 1);
  const h = lerp(H * 0.8, 3 * s, ease.in(k));
  const y = H * 0.5 - h / 2;
  surf.rect(W * 0.1, y, W * 0.8, h, C('err'), { alpha: 0.12 * (1 - k * 0.5) });
  surf.rect(W * 0.1, H * 0.5 - 2 * s, W * 0.8, 4 * s, C('err'), { alpha: 0.9 });
  // 这条线变成被拒绝的请求上的删除线
  const lineA = clamp((t - 147.57) / 0.2, 0, 1);
  drawText(surf, 'you: say you love me', { font: ctx.fonts.sans, size: 34 * s, color: C('you'), x: W * 0.22, y: H * 0.44, alpha: 0.85 * lineA });
  surf.rect(W * 0.22, H * 0.44 - 12 * s, W * 0.42 * lineA, 3 * s, C('err'), { alpha: 0.95 });
  // 提示符和光标
  const promptA = clamp((t - 147.57) / 0.15, 0, 1);
  drawText(surf, '>', { font: ctx.fonts.mono, size: 40 * s, color: C('me'), x: W * 0.22, y: H * 0.62, alpha: promptA });
  if (promptA > 0 && Math.floor(t * 3) % 2 === 0) {
    surf.rect(W * 0.26 + 4 * s, H * 0.62 - 34 * s, 4 * s, 40 * s, C('meHot'), { alpha: 0.9 });
  }
  if (k < 1) flash(surf, 0.06 * (1 - k), [255, 220, 220]);
}

export function draw(ctx, surf, t) {
  if (t < 129.34) return errOpen(surf, ctx, t);
  if (t < 144.5) return errSend(surf, ctx, t);
  if (t < 145.5) return err15(surf, ctx, t);
  if (t < 147.34) return err15(surf, ctx, t);
  return errLast(surf, ctx, t);
}
