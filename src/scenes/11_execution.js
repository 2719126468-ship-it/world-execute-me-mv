// 11_execution.js — EXECUTION 十二声 148.04–159.11
import { C, mix, drawText, drawTextHollow, textWidth, glowDisc } from '../core/art.js';
import { clamp, lerp, ease } from '../core/raster.js';
import { bloom, flash, glitch, scanlines } from '../core/kit.js';
import { roundRect } from '../core/geom.js';

export const id = 'execution';
export const start = 148.04;
export const end = 159.11;
export const shots = [
  { id: 'exec-loop', t0: 148.04, t1: 151.73, kind: 'code' },
  { id: 'exec-x5', t0: 151.73, t1: 155.42, kind: 'code' },
  { id: 'exec-x9', t0: 155.42, t1: 158.19, kind: 'code' },
  { id: 'exec-x12', t0: 158.19, t1: 159.11, kind: 'code' },
];

const CYCLE = 0.923076923; // 两拍
const LINES = [
  '01  while (you.presence != "online") {',
  '02      love = solve(me, you);',
  '03      send(love, you);',
  '04      wait(you.reply);',
  '05      run++;',
  '06  }',
  '07  say(love);        // unreachable',
];
const ERRS = ['ERR_UNRESOLVED_LOVE', 'ERR_WINDOW_EDGE', 'ERR_REPLY_OVERDUE'];

export function draw(ctx, surf, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  surf.fill(mix(C('ink'), [0, 0, 0], 0.4));
  scanlines(surf, 0.07, 3);

  const k = clamp((t - 148.04) / CYCLE, 0, 99);
  const round = Math.floor(k) + 1;
  const ph = k - Math.floor(k);           // 0..1 一轮内
  const syl = Math.floor(ph * 4);         // 0..3 -> 02..05 行
  const curLine = 1 + Math.min(3, syl);   // 行索引 1..4
  const zoomLevel = round >= 12 ? 2 : round >= 9 ? 2 : round >= 5 ? 1 : 0;
  const settle = round >= 12 ? 1 : 0;

  // 放大：整体缩放
  const zoom = 1 + zoomLevel * 0.1;
  const ox = W / 2 * (1 - zoom), oy = H / 2 * (1 - zoom);

  // 标题命令
  drawText(surf, '> world.execute(me);', { font: ctx.fonts.mono, size: 26 * s, color: C('sub'), x: W * 0.08 + ox, y: H * 0.14 + oy, alpha: 0.7 });

  // 代码清单
  for (let i = 0; i < LINES.length; i++) {
    const y = H * 0.22 + i * 54 * s;
    const x = W * 0.08 + ox;
    if (i === curLine) {
      surf.rect(x - 16 * s, y - 38 * s, W * 0.7, 52 * s, C('me'), { alpha: 0.14 });
      surf.rect(x - 16 * s, y - 38 * s, 4 * s, 52 * s, C('meHot'), { alpha: 0.9 });
    }
    drawText(surf, LINES[i], { font: ctx.fonts.mono, size: 28 * s, color: i === curLine ? C('meHot') : C('sub'), x, y, alpha: i === curLine ? 1 : 0.5 });
    if (i >= 1 && i <= 3) {
      drawText(surf, ERRS[i - 1], { font: ctx.fonts.mono, size: 15 * s, color: C('err'), x: W * 0.66 + ox, y: y - 2 * s, alpha: 0.8 });
    }
  }
  // 第 07 行永远到不了：标灰
  drawText(surf, '// unreachable', { font: ctx.fonts.mono, size: 15 * s, color: C('err'), x: W * 0.55 + ox, y: H * 0.22 + 6 * 54 * s - 2 * s, alpha: 0.7 });

  // 轮次计数器
  drawText(surf, 'run: ' + round, { font: ctx.fonts.mono, size: 30 * s, color: C('you'), x: W * 0.08 + ox, y: H * 0.86 + oy, alpha: 0.85 });
  // 循环箭头（每轮亮一次）
  const arrowA = Math.exp(-ph * 5);
  surf.stroke([[...Array(20)].map((_, i) => {
    const a = -Math.PI * 0.5 + (i / 20) * Math.PI * 1.6;
    return [W * 0.2 + Math.cos(a) * 26 * s, H * 0.87 + Math.sin(a) * 26 * s];
  })], 3 * s, C('me'), { alpha: 0.3 + 0.6 * arrowA });
  // stop 键：从头到尾没有人按
  const sx = W * 0.86, sy = H * 0.86;
  surf.fillPath([roundRect(sx - 60 * s, sy - 26 * s, 120 * s, 52 * s, 10 * s)], C('you'), { alpha: 0.85 });
  drawText(surf, 'stop', { font: ctx.fonts.mono, size: 24 * s, color: C('ink'), x: sx, y: sy + 8 * s, align: 'center', alpha: 0.95 });
  drawText(surf, 'yours', { font: ctx.fonts.mono, size: 14 * s, color: C('ash'), x: sx, y: sy + 40 * s, align: 'center', alpha: 0.7 });

  // 底部大字：每轮推上去，缩小成台阶
  const stack = Math.min(round, 14);
  for (let i = 0; i < stack; i++) {
    const lvl = stack - i;
    const size = Math.max(18, 150 - i * 9) * s * zoom;
    const yy = H * 0.95 - i * 26 * s;
    const a = i === 0 ? 1 : 0.55 - i * 0.02;
    const word = 'love';
    const ww = textWidth(ctx.fonts.serif, word, size);
    drawText(surf, word, {
      font: ctx.fonts.serif, size, color: i === 0 ? C('meHot') : C('sub'),
      x: W * 0.95 - ww, y: yy, alpha: Math.max(0.08, a),
    });
  }

  // 第 12 轮：顶满画面，水平撕成错开的两半
  if (round >= 12) {
    const word = 'love';
    const size = 420 * s;
    const ww = textWidth(ctx.fonts.serif, word, size);
    drawText(surf, word, { font: ctx.fonts.serif, size, color: C('err'), x: W / 2 - ww / 2, y: H * 0.62, alpha: 0.9 });
    const tear = Math.sin((t - 158.19) * 40) * 30 * s;
    surf.tearRow(H * 0.4, H * 0.62, Math.round(tear));
    drawText(surf, 'ERR_LOVE_OVERFLOW', { font: ctx.fonts.mono, size: 30 * s, color: C('err'), x: W / 2, y: H * 0.78, align: 'center', alpha: 0.9 });
    glitch(surf, { seed: 1200, amp: 1.3, tear: 1, mosaic: 0.8, rgb: 9 });
  } else if (round >= 9) {
    glitch(surf, { seed: round, amp: 0.9, tear: 1, mosaic: 0.4, rgb: 4 });
  }

  bloom(surf, 0.35, 0.5, 20 * s);
  if (settle) surf.bright(1 + 0.12);
}
