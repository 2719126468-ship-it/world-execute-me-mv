// 11_last.js — 最后一声 161.88–162.81（从代码变回她）
import { C, mix, plateFigure, drawText, drawTextHollow, textWidth, glowDisc } from '../core/art.js';
import { clamp, lerp, ease } from '../core/raster.js';
import { bloom, flash, scanlines } from '../core/kit.js';
import { cue } from './cues.js';

export const id = 'last';
export const start = 161.88;
export const end = 162.81;
export const shots = [{ id: 'last-word', t0: 161.88, t1: 162.81, kind: 'plate' }];

// 镜像方向、缩放、原点（161.88 / 162.81 / 166.50 共用）
export const EYE = { flipX: true, scale: 1.72, ox: -211, oy: -153, size: 2157 };

export function draw(ctx, surf, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  surf.fill(C('ink'));
  const word = 'love';
  const size = 300 * s;
  const tw = textWidth(ctx.fonts.serif, word, size);
  const x0 = W / 2 - tw / 2;
  const y0 = H * 0.72;
  const times = [cue('outro.last.1'), cue('outro.last.2'), cue('outro.last.3'), cue('outro.last.4')];

  // 每个字母是一扇窗，后面是 f_eye（只在最后一个字母处露出虹膜）
  let x = x0;
  const eyeX = x0 + textWidth(ctx.fonts.serif, 'lov', size);
  const eyeY = y0 - size * 0.72;
  const eyeW = size * 2.4;
  // 眼睛层
  const eyeLayer = surf.constructor ? new (surf.constructor)(W, H) : null;
  if (eyeLayer) {
    eyeLayer.fill(C('ink'));
    plateFigure(eyeLayer, 'f_eye', {
      x: eyeX - eyeW * 0.4, y: eyeY - eyeW * 0.42, w: eyeW, flipX: true, glow: 0.1,
      role: { black: mix(C('ink'), C('ash'), 0.3), cream: mix(C('ash'), C('you'), 0.35), me: C('meHot') },
    });
  }
  const lit = t >= times[3] - 0.02;
  for (let i = 0; i < word.length; i++) {
    const w = textWidth(ctx.fonts.serif, word[i], size);
    const on = t >= times[i];
    if (i === 3 && lit && eyeLayer) {
      // 第四个音节：露出虹膜（裁切在字母的竖笔里）
      const mask = new Uint8Array(W * H);
      const bx = Math.floor(x + w * 0.3), bw = Math.max(2, Math.floor(w * 0.4));
      for (let yy = Math.max(0, Math.floor(eyeY)); yy < Math.min(H, Math.floor(eyeY + size)); yy++) {
        mask.fill(255, yy * W + bx, yy * W + Math.min(W, bx + bw));
      }
      surf.composite(eyeLayer, 0, 0, 1, 'over', mask);
    }
    if (on) {
      drawText(surf, word[i], { font: ctx.fonts.serif, size, color: C('meHot'), x, y: y0, alpha: 0.95 });
    } else {
      drawTextHollow(surf, word[i], { font: ctx.fonts.serif, size, color: C('sub'), x, y: y0, alpha: 0.6, thickness: 3 * s });
    }
    x += w;
  }
  // 亮度只升不降
  const lift = clamp((t - 161.88) / 0.93, 0, 1);
  surf.bright(1 + lift * 0.3);
  bloom(surf, 0.4 + lift * 0.3, 0.45, 24 * s);
  if (lit) glowDisc(surf, eyeX + w0(word, ctx, size) * 0.5, eyeY + size * 0.4, 200 * s, C('meHot'), 0.4);
}

function w0(word, ctx, size) {
  return textWidth(ctx.fonts.serif, 'e', size);
}
