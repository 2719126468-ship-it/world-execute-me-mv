// 08_chorus2.js — 副歌二 103.73–121.73
import { base } from '../core/photo.js';
import { C, mix, plateFigure, drawFigure, drawText, glowDisc } from '../core/art.js';
import { clamp, lerp, ease } from '../core/raster.js';
import { bloom, flash, bars, rays } from '../core/kit.js';
import { roundRect } from '../core/geom.js';
import { chatFrame, inputBar, userMsg, herMsg, sysMsg, cursor } from '../core/ui.js';
import { cue } from './cues.js';
import { lineAt } from './texts.js';

export const id = 'chorus2';
export const start = 103.73;
export const end = 121.73;
export const shots = [
  { id: 'c2-a', t0: 103.73, t1: 106.6, kind: 'ui' },
  { id: 'c2-b', t0: 106.6, t1: 110.88, kind: 'ui' },
  { id: 'c2-online', t0: 110.88, t1: 112.96, kind: 'ui' },
  { id: 'c2-away', t0: 112.96, t1: 114.81, kind: 'ui' },
  { id: 'c2-offline', t0: 114.81, t1: 117.34, kind: 'ui' },
  { id: 'c2-iso', t0: 117.34, t1: 121.73, kind: 'ui' },
];

function state(t) {
  if (t < cue('alone.away')) return 'online';
  if (t < cue('alone.offline')) return 'away';
  return 'offline';
}

export function draw(ctx, surf, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  surf.fill(mix(C('paper'), [0, 0, 0], 0.3));
  // 冷灰褪色
  const fadeAll = clamp((t - 110.88) / 6, 0, 1);
  const st = state(t);
  const area = chatFrame(surf, ctx, { alpha: 1, count: 14, title: 'world.execute(me);' });

  // 消息：间隔越来越长
  const msgs = [
    { y: 0.16, text: 'are you there', who: 'you' },
    { y: 0.3, text: 'i am here', who: 'her' },
    { y: 0.42, text: 'say something', who: 'you' },
    { y: 0.54, text: 'i am still here', who: 'her' },
    { y: 0.66, text: 'hello?', who: 'you' },
  ];
  const gone = clamp((t - 112.96) / 5, 0, 1);
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const a = clamp((t - (103.9 + i * 1.6)) / 0.4, 0, 1) * (1 - gone * (0.35 + i * 0.12));
    if (a <= 0) continue;
    const y = area.y + area.h * m.y;
    if (m.who === 'you') userMsg(surf, ctx, m.text, { x: area.x + area.w, y, alpha: a * 0.85, size: 26 });
    else herMsg(surf, ctx, m.text, { x: area.x, y, alpha: a * 0.8, size: 28 });
  }
  inputBar(surf, ctx, { alpha: 0.9 - gone * 0.3 });

  // 窗口旁的她
  if (st !== 'online') {
    if (st === 'away') {
      // f_reach：大幅，张开的手越过窗口角落伸到输入框上方
      const a = clamp((t - 112.96) / 0.5, 0, 1);
      const w = H * 1.0 * (1000 / 1400);
      plateFigure(surf, 'f_reach', {
        x: W * 0.62, y: -H * 0.06, w: w * 1.4, glow: 0.25, alpha: 0.9 * a,
        role: {
          black: mix(C('ink'), C('meDim'), 0.22),
          cream: C('you'),
          me: mix(C('me'), C('ash'), fadeAll * 0.5),
          paper: C('paper'),
        },
      });
    } else {
      // f_profile：低头的悬浮小胸像，朝线程
      const a = clamp((t - 114.81) / 0.5, 0, 1);
      const iso = clamp((t - cue('alone.isolation')) / 1.4, 0, 1);
      const w = H * (0.62 - 0.5 * ease.inOut(iso)) * (1000 / 1400);
      const x = lerp(W * 0.78, W * 0.66, iso), y = lerp(H * 0.4, H * 0.52, iso);
      plateFigure(surf, 'f_profile', {
        x, y, w, glow: 0.2 * (1 - iso * 0.6), alpha: (0.85 - iso * 0.45) * a,
        role: {
          black: mix(C('ink'), C('dead'), 0.5),
          cream: mix(C('you'), C('ash'), 0.6),
          me: mix(C('me'), C('ash'), 0.7),
          paper: C('paper'),
        },
      });
      if (iso > 0.9) {
        surf.circle(x + w * 0.5, y + w * 0.5, 3 * s, C('ash'), { alpha: 0.6 * a });
      }
    }
  }

  // 状态标签
  const stText = st === 'online' ? 'online' : st === 'away' ? 'away' : 'offline';
  drawText(surf, stText, { font: ctx.fonts.monoUi, size: 16 * s, color: st === 'online' ? C('me') : C('ash'), x: W * 0.06, y: 60 * s, alpha: 0.7 });
  const iso = clamp((t - cue('alone.isolation')) / 1.2, 0, 1);
  if (iso > 0) {
    drawText(surf, 'ISOLATION', { font: ctx.fonts.serif, size: (120 + 30 * iso) * s, color: mix(C('ash'), C('you'), 0.4), x: W / 2, y: H * 0.82, align: 'center', alpha: 0.5 * iso });
  }
  // 整体冷灰
  if (fadeAll > 0) surf.desaturate(fadeAll * 0.55);
  if (fadeAll > 0) surf.rect(0, 0, W, H, C('ash'), 0.05 * fadeAll);
  bloom(surf, 0.22, 0.55, 18 * s);
}
