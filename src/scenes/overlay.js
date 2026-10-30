// overlay.js — 片尾注记与全局叠加
import { C, drawText } from '../core/art.js';
import { clamp } from '../core/raster.js';

export const id = 'overlay';
export const start = 1e9;
export const end = 1e9 + 1;
export const shots = [];

export function post(ctx, surf, t) {
  // 片尾注记：205.73 之后淡入
  const a = clamp((t - 206.4) / 0.8, 0, 1) * clamp((211.4 - t) / 0.6, 0, 1);
  if (a <= 0) return;
  const s = ctx.s;
  const lines = [
    'a fan-made music video',
    'unofficial, not affiliated with Anthropic or Mili',
    'visuals: code  /  silhouettes: provided by the artist',
  ];
  let y = surf.h - 190 * s;
  for (const l of lines) {
    drawText(surf, l, { font: ctx.fonts.monoUi, size: 24 * s, color: C('ash'), x: 150 * s, y, alpha: a * 0.75 });
    y += 40 * s;
  }
}
