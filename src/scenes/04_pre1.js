// 04_pre1.js — 30.0–59.42（对话、dizzy 开关、A.D→B.C 时间旅行）
import { base } from '../core/photo.js';
import { C, mix, drawText, drawTextHollow, textWidth, glowDisc } from '../core/art.js';
import { clamp, lerp, ease } from '../core/raster.js';
import { rays, bloom, flash, grid } from '../core/kit.js';
import { roundRect, smoothClosed } from '../core/geom.js';
import { chatFrame, inputBar, userMsg, herMsg, sysMsg, drawer, cursor, subtitle } from '../core/ui.js';
import { lineAt } from './texts.js';

export const id = 'pre1';
export const start = 30.0;
export const end = 59.42;
export const shots = [
  { id: 'pre1-chat', t0: 30.0, t1: 49.4, kind: 'ui' },
  { id: 'pre1-vision', t0: 49.4, t1: 52.04, kind: 'ui' },
  { id: 'pre1-date', t0: 52.04, t1: 55.73, kind: 'plate' },
  { id: 'pre1-back', t0: 55.73, t1: 59.42, kind: 'ui' },
];

// 时间轴上的历史剪影（三墨剪纸）
function eraShape(kind, x, y, w, h, ink) {
  if (kind === 'tower') {
    return [[[x - w * 0.22, y], [x - w * 0.22, y - h * 0.72], [x - w * 0.06, y - h * 0.86], [x - w * 0.06, y - h], [x + w * 0.1, y - h * 0.9], [x + w * 0.22, y - h * 0.62], [x + w * 0.22, y]]];
  }
  if (kind === 'spire') {
    return [[[x - w * 0.18, y], [x - w * 0.1, y - h * 0.4], [x - w * 0.04, y - h * 0.9], [x, y - h], [x + w * 0.04, y - h * 0.9], [x + w * 0.1, y - h * 0.4], [x + w * 0.18, y]]];
  }
  if (kind === 'colonnade') {
    const p = [[[x - w * 0.3, y], [x - w * 0.3, y - h * 0.7], [x + w * 0.3, y - h * 0.7], [x + w * 0.3, y]]];
    return p;
  }
  return [[[x - w * 0.36, y], [x - w * 0.1, y - h], [x + w * 0.1, y - h], [x + w * 0.36, y]]];
}

function chatScene(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  surf.fill(mix(C('paper'), [0, 0, 0], 0.25));
  const area = chatFrame(surf, ctx, { alpha: 1, count: 8 });
  const line = lineAt(t);
  if (line) herMsg(surf, ctx, line.text, { x: area.x, y: area.y + 40 * s, alpha: 0.88, size: 31 });
  // 用户的两句
  userMsg(surf, ctx, 'who are you', { x: area.x + area.w, y: area.y + 200 * s, alpha: 0.9 });
  userMsg(surf, ctx, 'make me happy', { x: area.x + area.w, y: area.y + 300 * s, alpha: 0.9 });
  sysMsg(surf, ctx, '> typing', { x: area.x, y: area.y + 420 * s, alpha: 0.4 });
  inputBar(surf, ctx, { alpha: 1 });
  return area;
}

function visionScene(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  surf.fill(mix(C('paper'), [0, 0, 0], 0.25));
  const area = chatFrame(surf, ctx, { alpha: 0.9, count: 9 });
  // 抽屉：Vision 那一行，开关快速切换（第 11–14 拍，越点越快）
  const open = 1;
  const times = [49.73, 50.19, 50.65, 50.88, 51.11];
  let on = false;
  for (let i = 0; i < times.length; i++) if (t >= times[i]) on = !on;
  const rows = [
    { label: 'Vision', kind: 'toggle', value: on, alpha: 1, hot: true },
    { label: 'Current', kind: 'seg', options: ['AC', 'DC'], value: 'DC', alpha: 0.6 },
    { label: 'Voice', kind: 'toggle', value: false, alpha: 0.6 },
  ];
  const d = drawer(surf, ctx, { open, rows, rowH: 120 });
  // 游标停在 Vision 这一行
  cursor(surf, ctx, d.x - 30 * s, 190 * s, { scale: 1.6, click: 0.4 });
  // 切换次数提示
  const n = times.filter((x) => t >= x).length;
  drawText(surf, 'vision: ' + (on ? 'on' : 'off'), { font: ctx.fonts.monoUi, size: 18 * s, color: C('me'), x: area.x, y: area.y + 30 * s, alpha: 0.8 });
  subtitle(surf, ctx, 'dizzy, but the switch is still on', { alpha: 0.8 });
}

function dateScene(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  surf.fill(C('ink'));
  const open = ease.inOut(clamp((t - 52.04) / 0.5, 0, 1));
  const bandH = H * 0.8 * open;
  const bandY = H / 2 - bandH / 2;
  // 横带
  surf.rect(0, bandY, W, bandH, mix(C('paper'), [0, 0, 0], 0.2), { alpha: 0.96 });
  surf.rect(0, bandY, W, 2 * s, C('you'), { alpha: 0.2 });
  surf.rect(0, bandY + bandH, W, 2 * s, C('you'), { alpha: 0.2 });

  // 拖动：火花向左，历史向右流过
  const drag = ease.inOut(clamp((t - 53.0) / 2.4, 0, 1));
  const scroll = drag * W * 1.6;
  const sparkX = W * 0.34 - drag * W * 0.22;
  const sparkY = bandY + bandH * 0.32;

  // 历史剪影带
  const eras = ['tower', 'spire', 'colonnade', 'pyramid'];
  for (let i = 0; i < 12; i++) {
    const kind = eras[i % 4];
    const x = W * 0.2 + i * W * 0.42 + scroll;
    if (x < -W * 0.4 || x > W * 1.3) continue;
    const passed = x < sparkX;
    const ink = passed ? mix(C('paper'), C('you'), 0.18) : mix(C('ink'), C('meDim'), 0.35);
    const h = bandH * (0.36 + 0.12 * (i % 3));
    const p = eraShape(kind, x, bandY + bandH * 0.78, W * 0.16, h);
    if (passed) {
      surf.stroke([...p[0], p[0][0]], 2 * s, C('ash'), { alpha: 0.45 });
    } else {
      surf.fillPath(p, ink, { alpha: 0.9 });
      surf.fillPath([p[0].map(([px, py]) => [px + 6 * s, py + 6 * s])], C('meDim'), { alpha: 0.25 });
    }
    // 拖影
    if (drag > 0.02 && drag < 0.98) {
      surf.fillPath([p[0].map(([px, py]) => [px + 40 * s * (1 - drag), py])], C('ash'), { alpha: 0.12 });
    }
  }
  // 时间轴
  surf.rect(0, bandY + bandH * 0.78, W, 3 * s, C('you'), { alpha: 0.18 });
  // 年份里程表
  const year = 2025 - Math.floor(drag * 2000);
  drawText(surf, String(year), { font: ctx.fonts.serif, size: 120 * s, color: C('you'), x: W * 0.08, y: bandY + bandH * 0.35, alpha: 0.9 });
  drawText(surf, drag < 0.55 ? 'A.D.' : 'B.C.', {
    font: ctx.fonts.serif, size: 64 * s, color: C('meHot'), x: W * 0.08, y: bandY + bandH * 0.5, alpha: drag > 0.5 ? 0.95 : 0.4,
  });
  // 火花（旋钮）
  surf.circle(sparkX, sparkY, 16 * s, C('meHot'), { alpha: 0.95 });
  rays(surf, { cx: sparkX, cy: sparkY, n: 14, r1: 150 * s, rot: t * 0.3, width: 3 * s, color: C('me'), alpha: 0.5 });
  glowDisc(surf, sparkX, sparkY, 90 * s, C('me'), 0.4);
  // 快门：每拍一次猛拉
  const beat = 0.344 + Math.floor((t - 0.344) / 0.4615) * 0.4615;
  const pull = Math.exp(-Math.abs(t - beat) * 12);
  if (pull > 0.2) surf.shift(Math.round(-pull * 8), 0);
  bloom(surf, 0.4, 0.5, 20 * s);
}

export function draw(ctx, surf, t) {
  if (t < 49.4) return chatScene(surf, ctx, t);
  if (t < 52.04) return visionScene(surf, ctx, t);
  if (t < 55.73) return dateScene(surf, ctx, t);
  return chatScene(surf, ctx, t);
}
