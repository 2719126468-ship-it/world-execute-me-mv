// 00_preroll.js — 片头闪光警告页（歌曲开始之前，−5..0 秒）
import { C, drawText, textWidth, mix } from '../core/art.js';
import { clamp, lerp, ease } from '../core/raster.js';

export const id = 'preroll';
export const start = -5.0;
export const end = 0.0;
export const shots = [
  { id: 'preroll-page', t0: -5.0, t1: 0.0, kind: 'code' },
];

const LINES = [
  { text: '$ check "world.execute(me);"', delay: 0.0, dim: 0.55 },
  { text: 'warning: this video contains flashing images', delay: 0.35, warn: true },
  { text: '  --> 2:33 - 3:17', delay: 0.55, dim: 0.7 },
  { text: '   |  rapid high-contrast cuts and strong light', delay: 0.7, dim: 0.7 },
  { text: '   = note: may affect photosensitive viewers', delay: 0.85, dim: 0.7 },
  { text: '   = 本片含有閃爍畫面與強光，光敏感者請留意', delay: 1.0, cjk: true, dim: 0.7 },
];

export function draw(ctx, surf, t) {
  const s = ctx.s;
  surf.fill(mix(C('ink'), C('dead'), 0.25));
  const fade = clamp((t + 5.0) / 0.4, 0, 1) * clamp((-0.05 - t) / 0.4, 0, 1);
  // 轻微纸面噪点
  surf.noise(3, 9001, false);

  const x = 190 * s;
  let y = 236 * s;
  const size = 30 * s;
  const lh = 58 * s;

  // 命令提示
  for (let i = 0; i < LINES.length; i++) {
    const ln = LINES[i];
    const a = clamp((t - start - 0.4 - ln.delay) / 0.35, 0, 1) * fade;
    if (a <= 0) { y += lh; continue; }
    if (ln.warn) {
      const w = textWidth(ctx.fonts.monoUi, ln.text, size);
      surf.rect(x - 10 * s, y - size * 0.95, w + 20 * s, size * 1.45, C('white'), { alpha: 0.92 * a });
      drawText(surf, ln.text, { font: ctx.fonts.monoUi, size, color: C('ink'), x: x, y, alpha: a });
    } else if (ln.cjk) {
      drawText(surf, ln.text, { font: ctx.fonts.cjk, size: size * 0.92, color: C('sub'), x: x, y, alpha: a * 0.85 });
    } else {
      drawText(surf, ln.text, { font: ctx.fonts.monoUi, size, color: mix(C('sub'), C('white'), 0.25), x: x, y, alpha: a * (ln.dim ?? 1) });
    }
    y += lh;
  }

  // 倒数
  const countStart = start + 2.6;
  if (t >= countStart - 0.1) {
    const n = clamp(3 - Math.floor(t - countStart), 1, 3);
    const a = fade * clamp((t - countStart + 0.1) / 0.15, 0, 1);
    drawText(surf, 'starting in', { font: ctx.fonts.monoUi, size: 26 * s, color: C('ash'), x, y: y + 40 * s, alpha: a });
    drawText(surf, String(n), {
      font: ctx.fonts.monoUi, size: 92 * s, color: C('you'),
      x: x + textWidth(ctx.fonts.monoUi, 'starting in ', 26 * s), y: y + 118 * s, alpha: a,
    });
  }

  // 韧性：底部一行小字
  drawText(surf, 'headphones recommended  /  no audio before 00:00', {
    font: ctx.fonts.monoUi, size: 17 * s, color: C('ash'),
    x, y: surf.h - 120 * s, alpha: 0.45 * fade,
  });
}
