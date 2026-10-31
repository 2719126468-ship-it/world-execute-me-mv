// 07_pre2.js — 导歌二 88.96–103.73（控件放大到她身上）
// 踩点：90.80 B(49) F / 91.72 Bt(198) M / 98.19 B(53) S / 99.10 Bt(214) M
import { base, figOrSkip } from '../core/photo.js';
import { C, mix, ground, drawFigure, plateFigure, drawText, drawTextHollow, textWidth, bigCursor, glowDisc } from '../core/art.js';
import { clamp, lerp, ease, circlePoly } from '../core/raster.js';
import { rays, bloom, B, flash } from '../core/kit.js';
import { chatFrame, drawer, cursor, inputBar, subtitle, layout } from '../core/ui.js';
import { cue, PRE2_HITS } from './cues.js';
import { smoothOpen, ellipse } from '../core/geom.js';

export const id = 'pre2';
export const start = 88.96;
export const end = 103.73;
export const shots = [
  { id: 'pre2-settings', t0: 88.96, t1: 90.80, kind: 'ui' },
  { id: 'pre2-gender', t0: 90.80, t1: 92.65, kind: 'plate' },
  { id: 'pre2-day', t0: 92.65, t1: 96.34, kind: 'plate' },
  { id: 'pre2-role', t0: 96.34, t1: 100.04, kind: 'plate' },
  { id: 'pre2-tail', t0: 100.04, t1: 103.73, kind: 'ui' },
];

const S = (ctx) => ctx.s;

// ---------- 共用小件 ----------
function plateFrame(surf, ctx, label) {
  const s = ctx.s;
  const W = ctx.w, H = ctx.h;
  drawText(surf, label, { font: ctx.fonts.monoUi, size: 15 * s, color: C('sub'), x: 46 * s, y: 44 * s, alpha: 0.5 });
  drawText(surf, 'settings / ' + label.split(' ')[0].toLowerCase(), {
    font: ctx.fonts.monoUi, size: 15 * s, color: C('ash'), x: W - 46 * s, y: 44 * s, alpha: 0.4, align: 'right',
  });
}

// 一个被放大到画面上的开关格子
function cell(surf, ctx, x, y, w, h, o = {}) {
  const s = ctx.s;
  const on = !!o.on;
  const press = o.press ?? 0;
  const yy = y + press * 10 * s;
  const fill = on ? (o.color || C('me')) : mix(C('paper'), C('you'), 0.05);
  surf.fillPath([roundRectP(x, yy, w, h, 10 * s)], fill, { alpha: on ? 0.92 : 0.45 });
  surf.stroke([...roundRectP(x, yy, w, h, 10 * s), [x + 10 * s, yy]], 2.4 * s, on ? C('meHot') : C('you'), { alpha: on ? 0.9 : 0.28 });
  drawText(surf, o.label || '', {
    font: ctx.fonts.sansBold, size: (o.size || 30) * s,
    color: on ? C('ink') : C('sub'), x: x + w / 2, y: yy + h / 2 - (o.size || 30) * 0.36 * s,
    align: 'center', alpha: on ? 0.95 : 0.6,
  });
}

function roundRectP(x, y, w, h, r, n = 6) {
  const p = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return p;
}

function sunburstPlate(surf, ctx, cx, cy, r, rot, alpha) {
  rays(surf, { cx, cy, n: 26, r0: r * 0.2, r1: r, rot, width: 3.2 * ctx.s, color: C('me'), alpha: 0.2 * alpha });
  rays(surf, { cx, cy, n: 13, r0: r * 0.45, r1: r * 0.82, rot: rot + 0.12, width: 7 * ctx.s, color: C('meHot'), alpha: 0.1 * alpha });
}

function spark(surf, ctx, x, y, r, a = 1) {
  const s = ctx.s;
  surf.circle(x, y, r, C('meHot'), { alpha: 0.95 * a });
  rays(surf, { cx: x, cy: y, n: 10, r0: r * 0.5, r1: r * 4.4, width: 2.6 * s, color: C('me'), alpha: 0.5 * a, rot: 0.2 });
}

// ---------- 1. 设置抽屉 ----------
function uiSettings(ctx, surf, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  surf.fill(mix(C('paper'), [0, 0, 0], 0.25));
  const open = ease.out(clamp((t - 89.28) / 0.5, 0, 1));
  const area = chatFrame(surf, ctx, { alpha: 0.85, count: 57, title: 'world.execute(me);' });
  // 线程内容（暗）
  for (let i = 0; i < 5; i++) {
    const y = area.y + i * 90 * s;
    surf.rect(area.x, y, area.w * (0.3 + 0.1 * (i % 3)), 26 * s, C('sub'), { alpha: 0.06 });
  }
  inputBar(surf, ctx, { alpha: 0.7, text: 'message\u2026' });

  const focus = clamp((t - 89.56) / 0.6, 0, 1);
  const rows = [
    { label: 'Gender', kind: 'seg', options: ['F', 'M'], value: 'F', alpha: focus, hot: true },
    { label: 'On call', kind: 'slider', value: 0.34, alpha: focus * 0.55 },
    { label: 'Role', kind: 'knob', value: 0.42, alpha: focus * 0.55 },
    { label: 'Loop', kind: 'toggle', value: false, alpha: focus * 0.55 },
  ];
  const d = drawer(surf, ctx, { open, rows, rowH: 116 });
  // 镜头推近 Gender 行：用一层放大的高亮
  const gy = 140 + 40;
  // 游标：从标题栏右上角 -> 设置按钮 -> Gender 行
  const t0 = 88.96;
  const p1 = [W - 210 * s, 110 * s];
  const p2 = [W - 70 * s, 110 * s];
  const p3 = [W - 300 * s, (140 + 46) * s];
  let cx, cy, click = 0;
  if (t < 89.2) { const k = ease.inOut(clamp((t - t0) / 0.24, 0, 1)); cx = lerp(p1[0], p2[0], k); cy = lerp(p1[1], p2[1], k); }
  else if (t < 89.5) { const k = ease.inOut(clamp((t - 89.2) / 0.28, 0, 1)); cx = lerp(p2[0], p3[0], k); cy = lerp(p2[1], p3[1], k); click = t < 89.3 ? (t - 89.2) / 0.1 : 0; }
  else { cx = p3[0]; cy = p3[1]; }
  cursor(surf, ctx, cx, cy, { scale: 1.5, click: click > 0 && click < 1 ? click : undefined });

  // 抽屉里 Gender 这一行被放大的暗示：行下加一条蓝线
  const lineA = focus * (1 - clamp((t - 90.5) / 0.3, 0, 1));
  if (lineA > 0) {
    surf.rect(d.x + 40 * s, (140 + 92) * s, d.w - 80 * s, 2 * s, C('meHot'), { alpha: 0.6 * lineA });
  }
  subtitle(surf, ctx, 'gender:', { alpha: 0.9 });
}

// ---------- 2. 性别 ----------
function plateGender(ctx, surf, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  base(surf, ctx, t, '16_gender', { noise: 5, proof: { sheet: '05/12' } });
  const tCut = 90.80;
  const tL1 = cue('pre2.gender.letter1');
  const tD1 = cue('pre2.gender.d1');
  const tL2 = cue('pre2.gender.letter2');
  const tD2 = cue('pre2.gender.d2');
  const boy = t >= tL2;

  // 背后的日芒
  sunburstPlate(surf, ctx, W * 0.5, H * 0.52, W * 0.62, t * 0.05, 1);

  // 人物：f_bust -> boy_bust（匹配剪辑，同构图）
  const figW = 740 * s;
  const fx = W / 2 - figW / 2;
  const fy = 300 * s;
  plateFigure(surf, boy ? 'boy_bust' : 'f_bust', {
    x: fx, y: fy, w: figW, alpha: 1, glow: 0.34, inkLift: 0.3,
  });
  if (!boy) {
    // 长发在 D2 落下
    const fall = clamp((t - tD2) / 0.4, 0, 1);
    for (let i = 0; i < 5; i++) {
      const x0 = fx + figW * (0.18 + i * 0.16);
      const len = (140 + i * 20) * s * fall;
      surf.stroke([[x0, fy + 60 * s], [x0 + 10 * s * (i % 2 ? 1 : -1), fy + 60 * s + len]], (5 + i) * s, mix(C('ink'), C('meDim'), 0.2), { alpha: 0.8 * fall });
    }
  }

  // 控制板：两个格子
  const pw = 1080 * s, ph = 190 * s, px = W / 2 - pw / 2, py = 72 * s;
  surf.fillPath([roundRectP(px, py, pw, ph, 12 * s)], mix(C('paper'), C('you'), 0.05), { alpha: 0.55 });
  surf.stroke([...roundRectP(px, py, pw, ph, 12 * s), [px + 12 * s, py]], 1.6 * s, C('you'), { alpha: 0.18 });
  const cw = pw / 2 - 26 * s;
  const press = t >= tD1 && t < tL2 ? 1 - clamp((t - tD1) / 0.12, 0, 1) * 0.6 : 0;
  cell(surf, ctx, px + 16 * s, py + 16 * s, cw, ph - 32 * s, { on: true, label: 'F', size: 46 });
  cell(surf, ctx, px + pw / 2 + 10 * s, py + 16 * s, cw, ph - 32 * s, {
    on: boy, label: 'M', size: 46, press, color: C('meHot'),
  });

  // 巨大字母：F（90.80）与 M（91.72）
  const letterY = 1010 * s;
  const size = 400 * s;
  const fw = textWidth(ctx.fonts.serif, 'F', size);
  const mw = textWidth(ctx.fonts.serif, 'M', size);
  const fx2 = W * 0.26 - fw / 2, mx2 = W * 0.74 - mw / 2;
  // 空心 -> 填实
  const fFill = t >= tL1 ? clamp((t - tL1) / 0.10, 0, 1) : 0;
  drawTextHollow(surf, 'F', {
    font: ctx.fonts.serif, size, x: fx2, y: letterY,
    color: C('you'), alpha: 0.9, fillColor: C('me'), fillAlpha: fFill, thickness: 5 * s,
  });
  const mFill = t >= tL2 ? clamp((t - tL2) / 0.10, 0, 1) : 0;
  drawTextHollow(surf, 'M', {
    font: ctx.fonts.serif, size, x: mx2, y: letterY,
    color: C('you'), alpha: 0.9, fillColor: C('meHot'), fillAlpha: mFill, thickness: 5 * s,
  });

  // 游标：按在 M 格上
  if (t >= tD1 - 0.25) {
    const k = clamp((t - (tD1 - 0.25)) / 0.25, 0, 1);
    const cxp = W / 2 + 240 * s, cyp = py + ph * 0.55 - k * 10 * s;
    const click = t >= tD1 && t < tL2 ? (t - tD1) / (tL2 - tD1) : 0;
    bigCursor(surf, cxp, cyp, 2.4 * s, C('you'), 0.95);
    if (click > 0) {
      surf.circle(cxp + 6 * s, cyp + 6 * s, (24 + 70 * click) * s, C('you'), { alpha: 0.28 * (1 - click), mode: 'add' });
    }
  }

  // 冲击（主事件）
  const hit = t >= tL2 ? Math.exp(-(t - tL2) * 9) : 0;
  if (hit > 0.01) {
    flash(surf, 0.22 * hit, [235, 240, 255]);
    bloom(surf, 0.5 * hit, 0.45, 20 * s);
  }
  // D2 整张震一下
  const sh = t >= tD2 && t < tD2 + 0.18 ? Math.sin((t - tD2) * 120) * 7 * s * (1 - (t - tD2) / 0.18) : 0;
  if (sh) surf.tearRow(0, surf.h, Math.round(sh));

  plateFrame(surf, ctx, 'gender');
  subtitle(surf, ctx, 'gender: ' + (boy ? 'M' : 'F'), { alpha: 0.95 });
}

// ---------- 3. 一天 ----------
function plateDay(ctx, surf, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  const tGrab = cue('pre2.day.grab');
  const tDrag = cue('pre2.day.drag');
  const tAM = cue('pre2.day.am');
  const tD3 = cue('pre2.day.d3');
  const tPM = cue('pre2.day.pm');
  const tD4 = cue('pre2.day.d4');
  base(surf, ctx, t, '04_current', { noise: 5, proof: { sheet: '05/12' } });

  // 弧线：On call 的滑块
  const cx = W * 0.5, cy = H * 1.28;
  const R = H * 1.02;
  const a0 = Math.PI * 1.16, a1 = Math.PI * 1.84;
  const arcPts = [];
  for (let i = 0; i <= 60; i++) {
    const a = a0 + (a1 - a0) * (i / 60);
    arcPts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
  }
  // 进度：92.65 抓住，94.04 后加速，D3 到顶，D4 到尽头
  let p;
  if (t < tDrag) p = 0.02 + 0.05 * (t - tGrab) / (tDrag - tGrab);
  else if (t < tD3) p = 0.07 + 0.83 * Math.pow((t - tDrag) / (tD3 - tDrag), 1.7);
  else if (t < tPM) p = 0.9 + 0.05 * (t - tD3) / (tPM - tD3);
  else p = 0.95 + 0.05 * clamp((t - tPM) / (tD4 - tPM), 0, 1);
  p = clamp(p, 0, 1);
  const ang = a0 + (a1 - a0) * p;
  const sx = cx + Math.cos(ang) * R, sy = cy + Math.sin(ang) * R;

  // 弧线（已走过的部分亮）
  surf.stroke(arcPts, 5 * s, C('you'), { alpha: 0.16 });
  const done = [];
  for (let i = 0; i <= 60; i++) if (i / 60 <= p) done.push(arcPts[i]);
  if (done.length > 1) surf.stroke(done, 5 * s, C('me'), { alpha: 0.55 });

  // 太阳 = 旋钮 = 火花
  spark(surf, ctx, sx, sy, 26 * s, 1);
  surf.circle(sx, sy, 78 * s, C('me'), { alpha: 0.1 });

  // 弧线下的小胸像
  const boyW = 420 * s;
  const dusk = clamp((t - tD3) / (tD4 - tD3 + 0.2), 0, 1);
  const bodyA = 1 - dusk * 0.55;
  figOrSkip(surf, '16_gender', 'boy_bust', {
    x: W / 2 - boyW / 2, y: 560 * s, w: boyW, alpha: bodyA, glow: 0.3 * (1 - dusk * 0.6), inkLift: 0.32,
    role: {
      black: mix(mix(C('ink'), C('meDim'), 0.3), C('dead'), dusk * 0.45),
      cream: mix(C('you'), C('ash'), dusk * 0.8),
      me: mix(C('me'), C('ash'), dusk * 0.75),
      paper: C('paper'),
    },
  });

  // 太阳高度 -> 画面亮度（D3 最亮）
  const rad = clamp((sy - 100 * s) / (H * 0.7), 0, 1);
  const lift = (1 - rad) * 0.13;
  if (lift > 0.002) surf.bright(1 + lift);
  if (tD3 - 0.15 < t && t < tD3 + 0.5) {
    const k = Math.exp(-Math.abs(t - tD3) * 12);
    bloom(surf, 0.5 * k, 0.42, 22 * s);
    flash(surf, 0.10 * k);
  }
  // 入暮
  if (t > tD3) surf.bright(1 - 0.18 * clamp((t - tD3) / (tD4 - tD3 + 0.3), 0, 1));

  // AM / PM 文字
  if (t >= tAM - 0.06) {
    const a = clamp((t - tAM + 0.06) / 0.12, 0, 1);
    drawText(surf, 'AM', { font: ctx.fonts.serif, size: 150 * s, color: C('you'), x: W * 0.17, y: H * 0.42, alpha: a * 0.85 });
  }
  if (t >= tPM - 0.06) {
    const a = clamp((t - tPM + 0.06) / 0.12, 0, 1);
    drawText(surf, 'PM', { font: ctx.fonts.serif, size: 150 * s, color: C('you'), x: W * 0.72, y: H * 0.42, alpha: a * 0.85 });
  }

  // 游标抓住太阳
  if (t >= tGrab) {
    bigCursor(surf, sx + 30 * s, sy + 10 * s, 2.2 * s, C('you'), 1);
    if (t < tGrab + 0.25) {
      surf.circle(sx, sy, (20 + 60 * (t - tGrab) / 0.25) * s, C('you'), { alpha: 0.3 * (1 - (t - tGrab) / 0.25), mode: 'add' });
    }
  }
  plateFrame(surf, ctx, 'on call');
  subtitle(surf, ctx, 'on call: all day', { alpha: 0.9 });
}

// ---------- 4. 角色（S / M） ----------
function plateRole(ctx, surf, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  const tD6 = cue('pre2.role.d6');
  const tD7 = cue('pre2.role.d7');
  const tL1 = cue('pre2.role.letter1');
  const tRel = cue('pre2.role.release');
  const tL2 = cue('pre2.role.letter2');
  const tD8 = cue('pre2.role.d8');
  base(surf, ctx, t, '17_role', { noise: 5, proof: { sheet: '05/12' } });

  const groundY = H * 0.74;
  // 台子
  surf.rect(W * 0.12, groundY - 220 * s, W * 0.26, 26 * s, C('you'), { alpha: 0.22 });
  surf.rect(W * 0.12, groundY - 220 * s, 26 * s, 220 * s, C('you'), { alpha: 0.12 });
  surf.rect(W * 0.12, groundY - 194 * s, W * 0.26, 2 * s, C('me'), { alpha: 0.25 });
  // 地面线
  surf.rect(0, groundY, W, 3 * s, C('you'), { alpha: 0.2 });

  // 开关：竖直滑轨
  const swX = W * 0.72, swTop = H * 0.26, swBot = groundY;
  surf.rect(swX - 5 * s, swTop, 10 * s, swBot - swTop, C('you'), { alpha: 0.2 });
  let knobP = 0.1;
  if (t >= tD7) knobP = lerp(0.1, 0.94, ease.out(clamp((t - tD7) / 0.2, 0, 1)));
  if (t >= tRel) knobP = lerp(0.94, 0.06, ease.inOut(clamp((t - tRel) / (tL2 - tRel), 0, 1)));
  const knobY = lerp(swBot, swTop, knobP);
  surf.circle(swX, knobY, 30 * s, C('me'), { alpha: 0.95 });
  surf.circle(swX, knobY, 14 * s, C('meHot'), { alpha: 0.95 });
  surf.rect(swX - 44 * s, swTop - 6 * s, 88 * s, 3 * s, C('you'), { alpha: 0.3 });

  // S：高处的台子上
  const sBase = groundY - 224 * s;
  const sFill = t >= tL1 ? clamp((t - tL1) / 0.09, 0, 1) : 0;
  const sSize = 330 * s;
  drawTextHollow(surf, 'S', {
    font: ctx.fonts.serif, size: sSize, x: W * 0.2, y: sBase,
    color: C('you'), alpha: 0.95, fillColor: C('me'), fillAlpha: sFill, thickness: 5 * s,
  });

  // M：地面，唱到后软塌
  const mFill = t >= tL2 ? clamp((t - tL2) / 0.09, 0, 1) : 0;
  const mSize = 330 * s;
  const sag = t >= tD8 ? ease.out(clamp((t - tD8) / 0.28, 0, 1)) : 0;
  const mx = W * 0.42;
  // 塌：用条带位移的 mask
  const mh = drawSaggedLetter(surf, ctx, 'M', {
    x: mx, y: groundY + 6 * s, size: mSize, sag, color: C('me'), fillAlpha: mFill, groundY,
  });

  // 地面线被压弯（只在 M 下方）
  if (sag > 0) {
    const dip = 26 * s * Math.sin(Math.min(1, sag) * Math.PI * 0.9);
    const seg = [];
    for (let i = 0; i <= 30; i++) {
      const x = W * 0.3 + (W * 0.3) * (i / 30);
      const k = Math.sin((i / 30) * Math.PI);
      seg.push([x, groundY + 2 * s + k * dip]);
    }
    surf.stroke(seg, 3 * s, C('me'), { alpha: 0.55 });
  }

  // 游标：握住旋钮
  if (t >= tD6 - 0.2) {
    const k = clamp((t - (tD6 - 0.2)) / 0.2, 0, 1);
    const cxp = lerp(W * 0.86, swX + 18 * s, k), cyp = lerp(groundY + 60 * s, knobY + 12 * s, k);
    bigCursor(surf, cxp, cyp, 2.2 * s, C('you'), 1);
    if (t >= tD6 && t < tD6 + 0.2) {
      surf.circle(swX, knobY, (18 + 46 * (t - tD6) / 0.2) * s, C('you'), { alpha: 0.3 * (1 - (t - tD6) / 0.2), mode: 'add' });
    }
  }

  // 冲击（S 填实、M 填实）
  const hit1 = t >= tL1 ? Math.exp(-(t - tL1) * 9) : 0;
  const hit2 = t >= tL2 ? Math.exp(-(t - tL2) * 9) : 0;
  if (hit1 > 0.02) { flash(surf, 0.14 * hit1, [235, 240, 255]); bloom(surf, 0.5 * hit1, 0.45, 18 * s); }
  if (hit2 > 0.02) { flash(surf, 0.12 * hit2, [235, 240, 255]); bloom(surf, 0.45 * hit2, 0.45, 18 * s); }
  if (hit2 > 0.02) surf.tearRow(0, surf.h, Math.round(Math.sin(t * 100) * 6 * s * hit2));
  // D8 落地震
  if (t >= tD8 && t < tD8 + 0.2) {
    const k = 1 - (t - tD8) / 0.2;
    surf.tearRow(0, surf.h, Math.round(Math.sin((t - tD8) * 130) * 9 * s * k));
  }

  plateFrame(surf, ctx, 'role');
  subtitle(surf, ctx, 'role:', { alpha: 0.9 });
}

// M 的软塌：条带位移
function drawSaggedLetter(surf, ctx, ch, o) {
  const s = ctx.s;
  const mask = textMaskCached(ctx, ch, o.size);
  if (!mask) return;
  const sag = o.sag || 0;
  const x = o.x, y = o.y - o.size * 0.72;
  const out = new Uint8Array(mask.a.length);
  const { w, h, a } = mask;
  for (let yy = 0; yy < h; yy++) {
    const k = Math.pow(yy / h, 2);
    const dx = Math.round(sag * 54 * s * k);
    for (let xx = 0; xx < w; xx++) {
      const sx = xx - dx;
      if (sx < 0 || sx >= w) continue;
      out[yy * w + xx] = a[yy * w + sx];
    }
  }
  const m2 = { w, h, left: mask.left, top: mask.top, advance: mask.advance, a: out };
  if (o.fillAlpha > 0) surf.blitMask(m2, Math.round(x + mask.left), Math.round(y + mask.top), o.color, o.fillAlpha);
  const th = 4 * s;
  const edge = outlineOf(m2, Math.max(1, Math.round(th)));
  surf.blitMask(edge, Math.round(x + mask.left), Math.round(y + mask.top), C('you'), 0.85);
  return out;
}

let textMaskCache = new Map();
function textMaskCached(ctx, str, size) {
  const key = str + '|' + size;
  let m = textMaskCache.get(key);
  if (!m) {
    m = textMaskFn(ctx.fonts.serif, str, size);
    textMaskCache.set(key, m);
  }
  return m;
}

import { textMask as textMaskFn, measure } from '../core/font.js';
import { maskOutline as outlineOf } from '../core/art.js';

// ---------- 5. 收尾：Loop / 完成 / 三个墨版叠合 ----------
function uiTail(ctx, surf, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  surf.fill(mix(C('paper'), [0, 0, 0], 0.25));
  const area = chatFrame(surf, ctx, { alpha: 1, count: 61 });
  const d = drawer(surf, ctx, {
    open: 1,
    rows: [
      { label: 'Gender', kind: 'seg', options: ['F', 'M'], value: 'M', alpha: 1 },
      { label: 'On call', kind: 'slider', value: 1, alpha: 1 },
      { label: 'Role', kind: 'knob', value: 0.06, alpha: 1 },
      { label: 'Loop', kind: 'toggle', value: t >= cue('pre2.tail.d9'), alpha: 1, hot: t >= cue('pre2.tail.d9') },
    ],
    rowH: 116,
  });
  inputBar(surf, ctx, { alpha: 1, text: 'message\u2026' });

  // 游标：D9 Loop -> D10 完成 -> 输入框
  const d9 = cue('pre2.tail.d9'), d10 = cue('pre2.tail.d10'), click = cue('pre2.tail.click');
  let cx = W - 520 * s, cy = (140 + 3 * 116 + 60) * s;
  if (t >= d10) { const k = ease.inOut(clamp((t - d10) / 0.2, 0, 1)); cx = lerp(cx, W - 180 * s, k); cy = lerp(cy, H - 130 * s, k); }
  if (t >= click) { const k = ease.inOut(clamp((t - click) / 0.3, 0, 1)); cx = lerp(W - 180 * s, W * 0.62, k); cy = lerp(H - 130 * s, H - 130 * s, k); }
  cursor(surf, ctx, cx, cy, { scale: 1.5, click: t >= d10 && t < d10 + 0.16 ? (t - d10) / 0.16 : undefined });

  // 三个墨版叠合 -> 对准
  const k = clamp((t - 100.62) / 1.4, 0, 1);
  if (k > 0) {
    const on = ease.inOut(k);
    const cx2 = W * 0.48, cy2 = H * 0.52;
    const w = 560 * s;
    const spread = (1 - on) * 46 * s;
    const roles = [
      { name: 'f_bust', role: { black: C('ink'), cream: C('you'), me: C('off'), paper: C('paper') }, dx: -spread, dy: -spread * 0.4, a: 0.5 },
      { name: 'man_bust', role: { black: C('dead'), cream: C('ash'), me: C('dead'), paper: C('paper') }, dx: spread * 0.7, dy: spread * 0.3, a: 0.35 },
      { name: 'boy_bust', role: { black: C('ink'), cream: C('me'), me: C('me'), paper: C('paper') }, dx: spread * 0.2, dy: spread * 0.8, a: 0.9 },
    ];
    for (const r of roles) {
      drawFigure(surf, r.name, {
        x: cx2 - w / 2 + r.dx, y: cy2 - w * 0.7 + r.dy, w,
        alpha: r.a * clamp(k * 2, 0, 1), role: r.role,
      });
    }
    if (on > 0.98) {
      drawText(surf, 'role: M', { font: ctx.fonts.monoUi, size: 22 * s, color: C('sub'), x: W * 0.08, y: H * 0.12, alpha: 0.6 });
    }
  }

  // 最后的收拢：向下一镜第一帧收
  if (t >= click) {
    const q = ease.inOut(clamp((t - click) / (103.73 - click), 0, 1));
    const w = lerp(W, 900 * s, q), h = lerp(H, 520 * s, q);
    const x = lerp(0, W * 0.5 - w / 2, q), y = lerp(0, H * 0.62 - h / 2, q);
    // 遮罩：外部压黑
    surf.rect(0, 0, W, y, C('ink'), { alpha: 0.9 * q });
    surf.rect(0, y + h, W, H - y - h, C('ink'), { alpha: 0.9 * q });
    surf.rect(0, y, x, h, C('ink'), { alpha: 0.9 * q });
    surf.rect(x + w, y, W - x - w, h, C('ink'), { alpha: 0.9 * q });
    surf.stroke([[...roundRectP(x, y, w, h, 10 * s), [x + 10 * s, y]]], 2 * s, C('you'), { alpha: 0.2 * q });
  }
  subtitle(surf, ctx, 'loop: on', { alpha: 0.85 });
}

export function draw(ctx, surf, t) {
  if (t < cue('pre2.gender.letter1') && t < 90.80) return uiSettings(ctx, surf, t);
  if (t < cue('pre2.gender.next')) return plateGender(ctx, surf, t);
  if (t < cue('pre2.role.in')) return plateDay(ctx, surf, t);
  if (t < cue('pre2.tail.d9')) return plateRole(ctx, surf, t);
  return uiTail(ctx, surf, t);
}
