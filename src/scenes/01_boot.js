// 01_boot.js — 开机 0–15.11
import { base } from '../core/photo.js';
import { C, drawFigure, drawText, mix } from '../core/art.js';
import { clamp, lerp, ease } from '../core/raster.js';
import { rays, bloom, flash } from '../core/kit.js';
import { chatFrame, inputBar, layout, sysMsg } from '../core/ui.js';

export const id = 'boot';
export const start = 0.0;
export const end = 15.11;
export const shots = [
  { id: 'boot-scan', t0: 0.0, t1: 2.0, kind: 'ui' },
  { id: 'boot-ghost', t0: 2.0, t1: 6.5, kind: 'ui' },
  { id: 'boot-title', t0: 6.5, t1: 15.11, kind: 'ui' },
];

export function draw(ctx, surf, t) {
  const s = ctx.s;
  const W = ctx.w, H = ctx.h;
  surf.fill(C('ink'));
  surf.noise(4, 501, false);

  // 玻璃后面的人影（两级灰）
  const ghost = clamp((t - 1.9) / 0.9, 0, 1) * 0.55;
  if (ghost > 0) {
    drawFigure(surf, 'f_bust', {
      x: W * 0.52 - 330 * s, y: H * 0.16, w: 660 * s,
      alpha: ghost,
      role: { black: mix(C('ink'), C('dead'), 0.75), cream: mix(C('ink'), C('off'), 0.5), me: mix(C('ink'), C('off'), 0.35), paper: C('ink') },
    });
  }

  // 窗口生长
  const grow = clamp((t - 1.2) / 0.9, 0, 1);
  const openE = ease.out(grow);
  if (grow <= 0) {
    // 扫描线
    const p = clamp(t / 1.2, 0, 1);
    const w = W * Math.pow(p, 1.6);
    surf.rect(W / 2 - w / 2, H / 2, w, 2 * s, C('you'), { alpha: 0.55 * (1 - p * 0.4) });
    if (t < 0.2) flash(surf, 0.9 * (1 - t / 0.2), [0, 0, 0]);
    return;
  }

  const L = layout(ctx);
  const win = L.win;
  const bh = win.h * openE;
  const by = win.y + (win.h - bh) / 2;

  // 窗口体
  surf.rect(win.x, by, win.w, bh, mix(C('paper'), [0, 0, 0], 0.1), { alpha: 0.92 });
  surf.rect(win.x, by, win.w, 1.5 * s, C('you'), { alpha: 0.18 * openE });
  surf.rect(win.x, by + bh - 1.5 * s, win.w, 1.5 * s, C('you'), { alpha: 0.1 * openE });
  surf.rect(win.x, by, 1.5 * s, bh, C('you'), { alpha: 0.12 * openE });
  surf.rect(win.x + win.w - 1.5 * s, by, 1.5 * s, bh, C('you'), { alpha: 0.12 * openE });

  if (openE > 0.6) {
    const a = clamp((openE - 0.6) / 0.4, 0, 1);
    const gy = by + 30 * s;
    const area = chatFrame(surf, ctx, { alpha: a, count: 0 });
    // 开机提示
    sysMsg(surf, ctx, '> session started', { x: area.x, y: area.y, alpha: 0.5 * a, size: 17 });
    sysMsg(surf, ctx, '> persona loaded: 1 undefined field', { x: area.x, y: area.y + 30 * s, alpha: 0.35 * a, size: 17 });
    const inp = inputBar(surf, ctx, { alpha: a, text: 'type to begin' });
    // 标题
    drawText(surf, 'world.execute(me);', {
      font: ctx.fonts.sans, size: 22 * s, color: C('sub'),
      x: W / 2, y: win.y + L.bar / 2 - 11 * s, align: 'center', alpha: a * 0.9,
    });
  }

  // 15.11 之前的火花：界面里唯一的一点颜色
  const spark = clamp((t - 14.2) / 0.9, 0, 1);
  if (spark > 0) {
    const cx = W * 0.5, cy = H * 0.5;
    const r = 6 * s * ease.out(spark);
    rays(surf, { cx, cy, n: 12, r1: 180 * s * ease.out(spark), width: 2.2 * s, color: C('me'), alpha: 0.5 * spark });
    surf.circle(cx, cy, r, C('meHot'), { alpha: 0.95 });
    bloom(surf, 0.5 * spark, 0.4, 18 * s);
  }
}
