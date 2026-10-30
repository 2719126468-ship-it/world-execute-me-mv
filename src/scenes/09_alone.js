// 09_alone.js — 空线程 121.73–125.65（FRAGMENTS / DISHEARTENED）
import { C, mix, plateFigure, drawText, drawTextHollow, textWidth, glowDisc, figureMask } from '../core/art.js';
import { clamp, lerp, ease } from '../core/raster.js';
import { bloom, flash, glitch } from '../core/kit.js';
import { roundRect } from '../core/geom.js';
import { chatFrame, inputBar, sysMsg } from '../core/ui.js';
import { cue } from './cues.js';
import { lineAt } from './texts.js';

export const id = 'alone';
export const start = 121.73;
export const end = 125.65;
export const shots = [
  { id: 'alone-fragments', t0: 121.73, t1: 124.73, kind: 'ui' },
  { id: 'alone-dark', t0: 124.73, t1: 124.89, kind: 'plate' },
  { id: 'alone-eye', t0: 124.89, t1: 125.65, kind: 'plate' },
];

export function draw(ctx, surf, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;

  // 全暗：只留那句没说完的话
  if (t >= 124.73 && t < 124.89) {
    surf.fill(C('ink'));
    drawText(surf, 'i am still', { font: ctx.fonts.serif, size: 54 * s, color: C('ash'), x: W / 2, y: H * 0.5, align: 'center', alpha: 0.35 });
    return;
  }

  // DISHEARTENED
  if (t >= 124.89) {
    surf.fill(C('ink'));
    const hitAt = cue('disheartened.hit');
    const hit = Math.exp(-(t - hitAt) * 6);
    // f_eye 满版，平涂的灰色三墨
    const w = W * 1.16;
    plateFigure(surf, 'f_eye', {
      x: W / 2 - w / 2, y: H / 2 - w / 2, w, flipX: true, glow: 0.25,
      role: { black: mix(C('ink'), C('ash'), 0.25), cream: mix(C('ash'), C('you'), 0.25), me: C('ash') },
    });
    // 关键词横贯整个画面，压在下巴下面的一条色带上
    const kw = 'DISHEARTENED';
    const size = 120 * s;
    const tw = textWidth(ctx.fonts.serif, kw, size);
    const bandY = H * 0.72;
    surf.rect(0, bandY - size * 0.9, W, size * 1.25, C('ink'), { alpha: 0.72 });
    drawText(surf, kw, { font: ctx.fonts.serif, size, color: C('you'), x: W / 2 - tw / 2, y: bandY, alpha: 0.95 });
    // 轻微震动 + 亮度台阶
    if (hit > 0.03) surf.tearRow(0, surf.h, Math.round(Math.sin(t * 90) * 5 * s * hit));
    surf.bright(1 + 0.16 * clamp((t - hitAt) / 0.3, 0, 1));

    // 删除控件 + 选区（第 4 到第 8 个字母）
    const selAt = cue('disheartened.sel');
    if (t >= selAt) {
      const a = clamp((t - selAt) / 0.2, 0, 1);
      // 用下标取字母，不写进代码
      const i0 = 3, i1 = 7;
      const pre = kw.slice(0, i0), mid = kw.slice(i0, i1), post = kw.slice(i1);
      const x0 = W / 2 - tw / 2;
      const preW = textWidth(ctx.fonts.serif, pre, size);
      const midW = textWidth(ctx.fonts.serif, mid, size);
      surf.rect(x0 + preW - 4 * s, bandY - size * 0.82, midW + 8 * s, size * 1.02, C('me'), { alpha: 0.18 * a });
      surf.stroke([[...roundRect(x0 + preW - 4 * s, bandY - size * 0.82, midW + 8 * s, size * 1.02, 4 * s), [x0 + preW, bandY - size * 0.82]]], 2 * s, C('you'), { alpha: 0.6 * a });
      // 删除控件
      const dx = x0 + preW + midW / 2, dy = bandY - size * 1.1;
      drawText(surf, '\u232b', { font: ctx.fonts.monoUi, size: 34 * s, color: C('err'), x: dx, y: dy, align: 'center', alpha: a });
      // 第一次按下：五个字母掉落
      const p1 = cue('disheartened.press1');
      if (t >= p1) {
        const k = clamp((t - p1) / 0.22, 0, 1);
        const n = Math.min(mid.length, Math.floor(k * mid.length * 1.2));
        for (let i = 0; i < n; i++) {
          const ch = mid[i];
          const chW = textWidth(ctx.fonts.serif, mid.slice(0, i + 1), size) - textWidth(ctx.fonts.serif, mid.slice(0, i), size);
          const x = x0 + preW + textWidth(ctx.fonts.serif, mid.slice(0, i), size);
          const fall = (t - p1) * 900 * s + i * 30 * s;
          drawText(surf, ch, { font: ctx.fonts.serif, size, color: C('you'), x, y: bandY + fall, alpha: Math.max(0, 0.9 - fall / (H * 0.5)) });
        }
      }
    }
    // 第二次按下：整张版画被竖线从左到右擦掉
    const p2 = cue('disheartened.press2');
    if (t >= p2) {
      const k = clamp((t - p2) / 0.12, 0, 1);
      surf.rect(0, 0, W * k, H, C('ink'), { alpha: 0.95 });
      surf.rect(W * k - 3 * s, 0, 4 * s, H, C('you'), { alpha: 0.8 });
    }
    if (hit > 0.02) flash(surf, 0.14 * hit, [240, 240, 250]);
    bloom(surf, 0.3, 0.5, 20 * s);
    return;
  }

  // FRAGMENTS
  surf.fill(mix(C('paper'), [0, 0, 0], 0.35));
  const area = chatFrame(surf, ctx, { alpha: 0.9, count: 0, title: 'world.execute(me);' });
  sysMsg(surf, ctx, '> message deleted', { x: area.x, y: area.y + 20 * s, alpha: 0.5 });
  // 背景：平涂底版 + 半调网点 + 压暗（来源 f_profile）
  const w = H * 0.8 * (1000 / 1400);
  plateFigure(surf, 'f_profile', {
    x: W * 0.68, y: H * 0.1, w, glow: 0.1, alpha: 0.55,
    role: { black: mix(C('paper'), C('ash'), 0.35), cream: mix(C('paper'), C('you'), 0.18), me: mix(C('paper'), C('meDim'), 0.4), paper: C('paper') },
  });
  // 网点
  const step = 9 * s;
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const k = (Math.sin(x * 0.05) + Math.cos(y * 0.04)) * 0.5 + 0.5;
      if (k > 0.7) surf.rect(x, y, 2 * s, 2 * s, C('ink'), { alpha: 0.25 });
    }
  }
  surf.rect(0, 0, W, H, C('ink'), { alpha: 0.25 });
  // 碎片落下，位置对着她胸口
  const tx = W * 0.74, ty = H * 0.52;
  for (let i = 0; i < 26; i++) {
    const ph = (t * 0.7 + i * 0.13) % 1;
    const x = tx + Math.sin(i * 2.3) * 90 * s + Math.cos(t + i) * 20 * s;
    const y = ty + ph * H * 0.5;
    const a = (1 - ph) * 0.6;
    surf.rect(x, y, (6 + (i % 4) * 3) * s, (4 + (i % 3) * 2) * s, i % 3 ? C('ash') : C('me'), { alpha: a });
  }
  drawText(surf, 'FRAGMENTS', { font: ctx.fonts.serif, size: 110 * s, color: C('sub'), x: W / 2, y: H * 0.9, align: 'center', alpha: 0.55 });
  bloom(surf, 0.2, 0.6, 18 * s);
}
