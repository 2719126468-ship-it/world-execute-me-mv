// 02_title.js — 标题与人设 15.11–30.0
import { C, mix, drawFigure, plateFigure, drawText, textWidth, glowDisc } from '../core/art.js';
import { clamp, lerp, ease } from '../core/raster.js';
import { rays, bloom, flash } from '../core/kit.js';
import { roundRect } from '../core/geom.js';
import { chatFrame, inputBar, userMsg, herMsg, sysMsg } from '../core/ui.js';
import { lineAt } from './texts.js';

export const id = 'title';
export const start = 15.11;
export const end = 30.0;
export const shots = [
  { id: 'title-hit', t0: 15.11, t1: 18.5, kind: 'ui' },
  { id: 'title-persona', t0: 18.5, t1: 24.0, kind: 'ui' },
  { id: 'title-thread', t0: 24.0, t1: 30.0, kind: 'ui' },
];

export function draw(ctx, surf, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  surf.fill(C('ink'));
  surf.noise(3, 502, false);

  const lit = clamp((t - 15.11) / 0.35, 0, 1);
  // 玻璃后的人影：被火花点亮后是两级蓝
  plateFigure(surf, 'f_bust', {
    x: W * 0.52 - 330 * s, y: H * 0.16, w: 660 * s, alpha: 0.5,
    glow: 0.1 + 0.25 * lit,
    role: {
      black: mix(C('ink'), C('dead'), 0.7),
      cream: mix(C('ink'), C('off'), 0.55),
      me: mix(C('ink'), C('meDim'), 0.3 + 0.5 * lit),
      paper: C('ink'),
    },
  });

  const area = chatFrame(surf, ctx, { alpha: 1, count: 1, title: 'world.execute(me);' });

  // 标题：第一拍点亮
  const titleSize = 68 * s;
  const title = 'world.execute(me);';
  const tw = textWidth(ctx.fonts.mono, title, titleSize);
  const tx = W / 2 - tw / 2, ty = H * 0.3;
  if (lit < 1) {
    // 未点亮：空心
    for (const ch of title) {
      // 简化为整体描边
    }
  }
  drawText(surf, title, { font: ctx.fonts.mono, size: titleSize, color: lit > 0 ? C('you') : C('off'), x: tx, y: ty, alpha: 0.4 + 0.6 * lit });
  // 火花在句末
  const sx = tx + tw + 14 * s, sy = ty - 22 * s;
  surf.circle(sx, sy, 7 * s * (0.6 + lit * 0.6), C('meHot'), { alpha: 0.95 });
  rays(surf, { cx: sx, cy: sy, n: 12, r1: (60 + 40 * lit) * s, rot: t * 0.4, width: 2 * s, color: C('me'), alpha: 0.5 });
  if (lit > 0 && lit < 1) flash(surf, 0.25 * (1 - lit));

  // 人设卡片
  if (t >= 18.5) {
    const a = clamp((t - 18.5) / 0.4, 0, 1) * (1 - clamp((t - 23.4) / 0.5, 0, 1));
    if (a > 0) {
      const cw = 720 * s, chh = 300 * s;
      const cx = W / 2 - cw / 2, cy = H * 0.5;
      surf.fillPath([roundRect(cx, cy, cw, chh, 12 * s)], mix(C('paper'), C('you'), 0.05), { alpha: 0.95 * a });
      surf.stroke([...roundRect(cx, cy, cw, chh, 12 * s), [cx + 12 * s, cy]], 1.5 * s, C('you'), { alpha: 0.2 * a });
      drawText(surf, 'persona', { font: ctx.fonts.monoUi, size: 17 * s, color: C('sub'), x: cx + 28 * s, y: cy + 34 * s, alpha: 0.7 * a });
      const rows = [
        ['name', 'her'],
        ['role', 'assistant'],
        ['gender', 'F'],
        ['love', 'undefined'],
      ];
      for (let i = 0; i < rows.length; i++) {
        const y = cy + 92 * s + i * 48 * s;
        drawText(surf, rows[i][0] + ':', { font: ctx.fonts.monoUi, size: 22 * s, color: C('sub'), x: cx + 28 * s, y, alpha: 0.7 * a });
        drawText(surf, rows[i][1], {
          font: ctx.fonts.monoUi, size: 22 * s,
          color: i === 3 ? C('err') : C('you'), x: cx + 200 * s, y, alpha: 0.9 * a,
        });
      }
    }
  }

  // 线程里的第一句话
  const line = lineAt(t);
  if (line && t >= line.t0) {
    herMsg(surf, ctx, line.text, { x: area.x, y: area.y + 40 * s, alpha: 0.85, size: 32 });
  }
  inputBar(surf, ctx, { alpha: 0.9 });
  bloom(surf, 0.3, 0.5, 20 * s);
}
