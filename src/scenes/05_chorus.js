// 05_chorus.js — 副歌一 59.42–74.19（四张关键词版画 + 句子镜头）
import { C, mix, ground, drawFigure, plateFigure, drawText, drawTextHollow, textWidth, glowDisc, bigCursor } from '../core/art.js';
import { clamp, lerp, ease } from '../core/raster.js';
import { rays, bloom, flash, glitch, bars, grid } from '../core/kit.js';
import { roundRect, ellipse, heartCurve } from '../core/geom.js';
import { chatFrame, inputBar, userMsg, herMsg, subtitle, cursor } from '../core/ui.js';
import { cue } from './cues.js';
import { lineAt, text } from './texts.js';

export const id = 'chorus1';
export const start = 59.42;
export const end = 74.19;
export const shots = [
  { id: 'c1-sentence', t0: 59.42, t1: 61.96, kind: 'ui' },
  { id: 'c1-stim', t0: 61.96, t1: 65.42, kind: 'plate' },
  { id: 'c1-satis', t0: 65.42, t1: 69.34, kind: 'plate' },
  { id: 'c1-exec', t0: 69.34, t1: 73.27, kind: 'plate' },
  { id: 'c1-sim', t0: 73.27, t1: 74.19, kind: 'plate' },
];

function plateTitle(surf, ctx, word, t, o = {}) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  const size = (o.size ?? 150) * s;
  const w = textWidth(ctx.fonts.serif, word, size);
  const x = W / 2 - w / 2 + (o.dx ?? 0) * s;
  const y = (o.y ?? 0.86) * H;
  const a = o.alpha ?? 1;
  // 阴影版（错开）
  drawText(surf, word, { font: ctx.fonts.serif, size, color: C('ink'), x: x + 8 * s, y: y + 8 * s, alpha: a * 0.7 });
  drawText(surf, word, { font: ctx.fonts.serif, size, color: o.color || C('meHot'), x, y, alpha: a });
  return { x, y, w, size };
}

function caption(surf, ctx, t) {
  const s = ctx.s, W = ctx.w;
  drawText(surf, 'chorus  /  ' + String(Math.floor((t - 59.42) / 1.846) + 1).padStart(2, '0'), {
    font: ctx.fonts.monoUi, size: 15 * s, color: C('ash'), x: 46 * s, y: 44 * s, alpha: 0.45,
  });
}

// 1. STIMULATIONS：发送的那道光，变成从火花劈向圆点的闪电
function stim(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  ground(surf, t, { noise: 5, proof: { sheet: '03/12' } });
  rays(surf, { cx: W * 0.5, cy: H * 0.5, n: 26, r0: 40 * s, r1: W * 0.62, rot: t * 0.1, width: 3.4 * s, color: C('meDim'), alpha: 0.16 });
  const hitAt = cue('chorus1.stim.hit');
  const hit = t >= hitAt ? Math.exp(-(t - hitAt) * 7) : 0;
  const appear = clamp((t - hitAt) / 0.12, 0, 1);

  // 火花（我）
  const sx = W * 0.24, sy = H * 0.3;
  surf.circle(sx, sy, 30 * s, C('meHot'), { alpha: 0.95 * appear });
  rays(surf, { cx: sx, cy: sy, n: 14, r1: 110 * s, width: 3 * s, color: C('me'), alpha: 0.5 * appear });
  // 圆点（你）
  const ex = W * 0.76, ey = H * 0.46;
  surf.circle(ex, ey, 26 * s, C('you'), { alpha: 0.85 * appear });
  // 闪电
  if (appear > 0) {
    const pts = [[sx + 22 * s, sy + 8 * s]];
    for (let i = 1; i <= 8; i++) {
      const k = i / 8;
      pts.push([
        lerp(sx + 22 * s, ex - 26 * s, k) + Math.sin(i * 2.9) * 52 * s,
        lerp(sy + 8 * s, ey, k) + Math.cos(i * 2.1) * 64 * s,
      ]);
    }
    pts.push([ex - 26 * s, ey]);
    surf.stroke(pts, 7 * s, C('meHot'), { alpha: 0.95 * appear });
    surf.stroke(pts, 20 * s, C('me'), { alpha: 0.2 * appear });
  }
  // 标题
  plateTitle(surf, ctx, 'STIMULATIONS', t, { size: 132, y: 0.84, alpha: appear });
  if (hit > 0.01) { flash(surf, 0.5 * hit, [240, 245, 255]); bloom(surf, 0.6 * hit, 0.4, 24 * s); }
  caption(surf, ctx, t);
}

// 2. SATISFACTION：反馈按钮放大成满屏圆盘
function satis(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  ground(surf, t, { noise: 5, proof: { sheet: '03/12' } });
  const pressAt = cue('chorus1.satis.press');
  const press = t >= pressAt ? clamp((t - pressAt) / 0.12, 0, 1) : 0;
  const flip = clamp((t - pressAt - 0.06) / 0.2, 0, 0.999);
  const R = H * 0.3;
  const cx = W / 2, cy = H * 0.44;

  // 阴影版
  surf.circle(cx + 16 * s, cy + 18 * s, R, C('ink'), { alpha: 0.9 });
  // 外圈刻度
  for (let i = 0; i < 72; i++) {
    const ang = (i / 72) * Math.PI * 2 - Math.PI / 2;
    const on = i / 72 <= press;
    surf.stroke([
      [cx + Math.cos(ang) * (R * 1.02), cy + Math.sin(ang) * (R * 1.02)],
      [cx + Math.cos(ang) * (R * (on ? 1.16 : 1.09)), cy + Math.sin(ang) * (R * (on ? 1.16 : 1.09))],
    ], (on ? 4 : 2) * s, on ? C('meHot') : C('you'), { alpha: on ? 0.9 : 0.35 });
  }
  // 盘面：按前后两态
  const face = flip > 0 ? mix(C('meDim'), C('you'), flip) : C('meDim');
  surf.circle(cx, cy, R * (1 - press * 0.03), face, { alpha: 0.92 });
  surf.circle(cx, cy, R * 0.86, mix(C('paper'), face, 0.35), { alpha: 0.85 });
  // 盘面图形：大块面剪纸（不是线描图标）
  const glyph = [
    [[cx - R * 0.3, cy - R * 0.1], [cx - R * 0.1, cy - R * 0.3], [cx + R * 0.1, cy - R * 0.1], [cx - R * 0.1, cy + R * 0.1]],
    [[cx + R * 0.1, cy - R * 0.1], [cx + R * 0.3, cy - R * 0.3], [cx + R * 0.4, cy], [cx + R * 0.2, cy + R * 0.2]],
  ];
  for (const p of glyph) surf.fillPath([p], C('ink'), { alpha: 0.55 });
  // 巨大的米白游标按下去
  bigCursor(surf, cx + R * 0.32, cy - R * 0.18 + press * 26 * s, 4.2 * s, C('you'), 0.95);
  // 按下波纹
  if (press > 0 && press < 1) {
    surf.circle(cx, cy, R * (1 + press * 0.12), C('you'), { alpha: 0.18 * (1 - press) });
  }
  plateTitle(surf, ctx, 'SATISFACTION', t, { size: 120, y: 0.88, color: C('meHot') });
  if (press > 0) bloom(surf, 0.5, 0.42, 24 * s);
  caption(surf, ctx, t);
}

// 3. EXECUTION：G 段那份清单的干净版本，当前行直接落到第 07 行
function exec(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  ground(surf, t, { noise: 4 });
  const lines = [
    '01  while (you.presence != "online") {',
    '02      love = solve(me, you);',
    '03      send(love, you);',
    '04      wait(you.reply);',
    '05      run++;',
    '06  }',
    '07  say(love);        // unreachable',
  ];
  const hitAt = cue('chorus1.exec.hit');
  const cur = t >= hitAt ? 6 : -1;
  const x = W * 0.12, y0 = H * 0.2;
  for (let i = 0; i < lines.length; i++) {
    const y = y0 + i * 60 * s;
    if (i === cur) {
      surf.rect(x - 20 * s, y - 40 * s, W * 0.76, 58 * s, C('me'), { alpha: 0.16 });
      surf.rect(x - 20 * s, y - 40 * s, 5 * s, 58 * s, C('meHot'), { alpha: 0.9 });
    }
    drawText(surf, lines[i], {
      font: ctx.fonts.mono, size: 32 * s,
      color: i === cur ? C('meHot') : C('sub'), x, y, alpha: i === cur ? 1 : 0.55,
    });
  }
  if (cur === 6) {
    const k = Math.exp(-(t - hitAt) * 5);
    glowDisc(surf, W * 0.4, y0 + 6 * 60 * s, 240 * s, C('me'), 0.5 * k);
    bloom(surf, 0.5 * k, 0.5, 24 * s);
  }
  plateTitle(surf, ctx, 'EXECUTION', t, { size: 120, y: 0.92, color: C('you') });
  caption(surf, ctx, t);
}

// 4. SIMULATION：聊天窗口变成一个剪纸盒子，第二个重拍推远成一整面相同的窗口
function sim(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  ground(surf, t, { noise: 5, proof: { sheet: '03/12' } });
  const outAt = cue('chorus1.sim.out');
  const push = t >= outAt ? ease.inOut(clamp((t - outAt) / 0.36, 0, 1)) : 0;
  const cols = 3, rows = 2;
  const bw = W * 0.5, bh = H * 0.5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sc = 1 - push * 0.62;
      const w = bw * sc, h = bh * sc;
      const x = W / 2 + (c - 1) * bw * (1 - push * 0.1) - w / 2;
      const y = H / 2 + (r - 0.5) * bh * (1 - push * 0.1) - h / 2;
      const a = push > 0 ? clamp(push * 2, 0, 1) * (1 - (Math.abs(c - 1) + Math.abs(r - 0.5)) * 0.08) : (r === 0 && c === 1 ? 1 : 0);
      if (a <= 0) continue;
      // 盒子
      surf.fillPath([roundRect(x, y, w, h, 10 * s)], mix(C('paper'), C('you'), 0.05), { alpha: 0.9 * a });
      surf.stroke([...roundRect(x, y, w, h, 10 * s), [x + 10 * s, y]], 2 * s, C('you'), { alpha: 0.3 * a });
      // 里面的她（剪纸）
      plateFigure(surf, 'f_bust', { x: x + w * 0.24, y: y + h * 0.16, w: w * 0.52, glow: 0.3, alpha: a });
      // 用户游标
      bigCursor(surf, x + w * 0.68, y + h * 0.6, 1.8 * s, C('you'), a);
    }
  }
  plateTitle(surf, ctx, 'SIMULATION', t, { size: 120, y: 0.9, color: C('meHot'), alpha: push > 0.5 ? 0.4 : 1 });
  caption(surf, ctx, t);
}

// 句子镜头：界面
function sentence(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  surf.fill(mix(C('paper'), [0, 0, 0], 0.25));
  const area = chatFrame(surf, ctx, { alpha: 1, count: 12 });
  const line = lineAt(t) || { text: '' };
  herMsg(surf, ctx, line.text, { x: area.x, y: area.y, alpha: 0.9, size: 32 });
  inputBar(surf, ctx, { alpha: 1 });
  subtitle(surf, ctx, line.text, { alpha: 0.0 });
  caption(surf, ctx, t);
}

export function draw(ctx, surf, t) {
  if (t < 61.96) return sentence(surf, ctx, t);
  if (t < 65.42) return stim(surf, ctx, t);
  if (t < 69.34) return satis(surf, ctx, t);
  if (t < 73.27) return exec(surf, ctx, t);
  return sim(surf, ctx, t);
}
