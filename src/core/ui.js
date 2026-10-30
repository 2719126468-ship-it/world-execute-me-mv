// ui.js — 聊天界面（用户看到的世界）
import { C, mix, drawText, textWidth } from './art.js';
import { clamp, lerp, ease } from './raster.js';
import { roundRect } from './geom.js';

export function layout(ctx) {
  const s = ctx.s;
  const W = ctx.w, H = ctx.h;
  return {
    s, W, H,
    win: { x: 150 * s, y: 78 * s, w: 1620 * s, h: 924 * s, r: 18 * s },
    bar: 62 * s,
    pad: 46 * s,
    inputH: 84 * s,
  };
}

// 窗口框架：返回可用消息区
export function chatFrame(surf, ctx, o = {}) {
  const L = layout(ctx);
  const s = L.s;
  const win = o.win || L.win;
  const bg = o.bg || mix(C('paper'), [0, 0, 0], 0.15);
  // 窗口底
  surf.fillPath([roundRect(win.x, win.y, win.w, win.h, win.r, 10)], bg, { alpha: o.alpha ?? 1 });
  // 外框
  surf.stroke(
    [...roundRect(win.x, win.y, win.w, win.h, win.r, 10), [win.x + win.r, win.y]],
    1.5 * s, C('you'), { alpha: 0.13 * (o.alpha ?? 1) }
  );
  // 标题栏
  const barY = win.y + L.bar;
  surf.rect(win.x, barY, win.w, 1 * s, C('you'), 0.09);
  for (let i = 0; i < 3; i++) {
    surf.circle(win.x + 30 * s + i * 22 * s, win.y + L.bar / 2, 5 * s, o.dotsColor || C('off'), { alpha: 0.85 });
  }
  const title = o.title ?? 'world.execute(me);';
  drawText(surf, title, { font: ctx.fonts.sans, size: 20 * s, color: C('sub'), alpha: 0.85, x: win.x + win.w / 2, y: win.y + L.bar / 2 - 10 * s, align: 'center' });
  if (o.count !== undefined) {
    drawText(surf, String(o.count), { font: ctx.fonts.mono, size: 17 * s, color: C('ash'), x: win.x + win.w - 34 * s, y: win.y + L.bar / 2 - 9 * s, align: 'right' });
  }
  return {
    x: win.x + L.pad, y: win.y + L.bar + 34 * s,
    w: win.w - L.pad * 2, h: win.h - L.bar - L.inputH - 50 * s,
    win, s,
  };
}

export function wrap(ctx, text, font, size, maxW) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (textWidth(font, test, size) > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// 用户消息（米白气泡，右对齐）
export function userMsg(surf, ctx, text, o = {}) {
  const s = o.s ?? ctx.s;
  const size = (o.size ?? 27) * s;
  const padX = 22 * s, padY = 15 * s;
  const maxW = (o.maxW ?? 720) * s;
  const lines = wrap(ctx, text, ctx.fonts.sans, size, maxW);
  let tw = 0;
  for (const l of lines) tw = Math.max(tw, textWidth(ctx.fonts.sans, l, size));
  const bw = tw + padX * 2, bh = lines.length * size * 1.34 + padY * 2;
  const x = (o.x ?? 0) - bw, y = o.y ?? 0;
  const a = o.alpha ?? 1;
  surf.fillPath([roundRect(x, y, bw, bh, 18 * s, 8)], C('you'), { alpha: 0.94 * a });
  let by = y + padY + size * 0.78;
  for (const l of lines) {
    drawText(surf, l, { font: ctx.fonts.sans, size, color: C('ink'), x: x + padX, y: by, alpha: a });
    by += size * 1.34;
  }
  return { x, y, w: bw, h: bh };
}

// 她的话（衬线、橙色、无气泡）
export function herMsg(surf, ctx, text, o = {}) {
  const s = o.s ?? ctx.s;
  const size = (o.size ?? 31) * s;
  const maxW = (o.maxW ?? 900) * s;
  const lines = wrap(ctx, text, ctx.fonts.serif, size, maxW);
  let y = o.y ?? 0;
  const a = o.alpha ?? 1;
  for (const l of lines) {
    drawText(surf, l, { font: ctx.fonts.serif, size, color: o.color || C('me'), x: o.x ?? 0, y: y + size * 0.8, alpha: a });
    y += size * 1.4;
  }
  return y;
}

// 系统/代码行
export function sysMsg(surf, ctx, text, o = {}) {
  const s = o.s ?? ctx.s;
  const size = (o.size ?? 18) * s;
  drawText(surf, text, {
    font: ctx.fonts.monoUi, size,
    color: o.color || C('ash'), alpha: o.alpha ?? 0.9,
    x: o.x ?? 0, y: (o.y ?? 0) + size * 0.8,
    align: o.align || 'left',
  });
  return size * 1.5;
}

export function inputBar(surf, ctx, o = {}) {
  const L = layout(ctx);
  const s = L.s;
  const win = o.win || L.win;
  const w = win.w - L.pad * 2;
  const h = L.inputH * (o.scale ?? 1);
  const x = win.x + L.pad;
  const y = win.y + win.h - h - 22 * s;
  surf.fillPath([roundRect(x, y, w, h, h / 2, 12)], mix(C('paper'), C('you'), 0.045), { alpha: 0.9 * (o.alpha ?? 1) });
  surf.stroke([...roundRect(x, y, w, h, h / 2, 12), [x + h / 2, y]], 1.2 * s, C('you'), { alpha: 0.12 * (o.alpha ?? 1) });
  const ph = o.text || 'message\u2026';
  drawText(surf, ph, { font: ctx.fonts.monoUi, size: 20 * s, color: C('ash'), x: x + 34 * s, y: y + h / 2 - 9 * s, alpha: 0.7 * (o.alpha ?? 1) });
  // 发送键
  const br = 22 * s;
  const bx = x + w - 34 * s, by = y + h / 2;
  surf.circle(bx, by, br, o.sendColor || C('me'), { alpha: (o.sendAlpha ?? 0.9) * (o.alpha ?? 1) });
  surf.stroke([[bx - 7 * s, by], [bx + 7 * s, by], [bx + 2 * s, by - 6 * s]], 2.4 * s, C('ink'), { alpha: 0.9 * (o.alpha ?? 1) });
  surf.stroke([[bx - 7 * s, by], [bx + 7 * s, by], [bx + 2 * s, by + 6 * s]], 2.4 * s, C('ink'), { alpha: 0.9 * (o.alpha ?? 1) });
  return { x, y, w, h, bx, by };
}

// 游标：箭头 + 可选点击涟漪
export function cursor(surf, ctx, x, y, o = {}) {
  const s = o.s ?? ctx.s;
  const k = (o.scale ?? 1) * s;
  const a = o.alpha ?? 1;
  const col = o.color || C('you');
  const p = [
    [0, 0], [0, 26], [7, 19], [12, 31], [18, 28], [13, 17], [23, 16],
  ].map(([px, py]) => [x + px * k, y + py * k]);
  surf.fillPath([p], C('ink'), { alpha: 0.55 * a });
  surf.fillPath([p.map(([px, py]) => [px + 2 * k, py + 2 * k])], col, { alpha: 0.95 * a });
  if (o.click !== undefined && o.click > 0) {
    const r = (10 + 26 * o.click) * k;
    surf.circle(x + 4 * k, y + 4 * k, r, col, { alpha: 0.35 * (1 - o.click) * a, mode: 'add' });
    surf.fillPath([[...Array(32)].map((_, i) => [x + 4 * k + Math.cos(i / 32 * 6.283) * r, y + 4 * k + Math.sin(i / 32 * 6.283) * r])], col, { alpha: 0.5 * (1 - o.click) * a });
  }
  return { x, y };
}

// 设置抽屉（界面版）
// rows: [{key,label,kind:'seg'|'slider'|'knob'|'toggle',value,alpha}]
export function drawer(surf, ctx, o = {}) {
  const s = o.s ?? ctx.s;
  const W = ctx.w, H = ctx.h;
  const open = o.open ?? 1;
  const pw = 620 * s;
  const x = W - pw * open;
  const y = 0;
  surf.rect(x, y, pw, H, mix(C('paper'), [0, 0, 0], 0.2), { alpha: 0.96 });
  surf.rect(x, 0, 1.5 * s, H, C('you'), { alpha: 0.14 });
  drawText(surf, 'settings', { font: ctx.fonts.monoUi, size: 19 * s, color: C('sub'), x: x + 46 * s, y: 70 * s, alpha: 0.8 });
  surf.rect(x + 46 * s, 104 * s, pw - 92 * s, 1 * s, C('you'), { alpha: 0.12 });

  let ry = 140 * s;
  const rowH = (o.rowH ?? 108) * s;
  for (const row of o.rows || []) {
    const a = row.alpha ?? 1;
    if (a <= 0) { ry += rowH; continue; }
    const hot = row.hot ? 1 : 0;
    if (hot) surf.rect(x + 24 * s, ry - 14 * s, pw - 48 * s, rowH - 12 * s, C('me'), { alpha: 0.07 });
    drawText(surf, row.label, { font: ctx.fonts.sans, size: 23 * s, color: hot ? C('meHot') : C('sub'), x: x + 46 * s, y: ry + 10 * s, alpha: a });
    const vy = ry + 58 * s;
    if (row.kind === 'seg') {
      const opts = row.options || ['F', 'M'];
      let ox = x + 46 * s;
      for (const op of opts) {
        const sel = op === row.value;
        const bw = 62 * s, bh = 40 * s;
        surf.fillPath([roundRect(ox, vy - 8 * s, bw, bh, 10 * s, 6)], sel ? C('me') : mix(C('paper'), C('you'), 0.08), { alpha: sel ? 0.9 : 0.6 });
        drawText(surf, op, { font: ctx.fonts.monoUi, size: 22 * s, color: sel ? C('ink') : C('sub'), x: ox + bw / 2, y: vy + 3 * s, align: 'center', alpha: a });
        ox += bw + 12 * s;
      }
    } else if (row.kind === 'slider') {
      const tw = pw - 130 * s;
      surf.rect(x + 46 * s, vy + 8 * s, tw, 2 * s, C('you'), { alpha: 0.22 * a });
      surf.rect(x + 46 * s, vy + 8 * s, tw * (row.value ?? 0.5), 2 * s, C('me'), { alpha: 0.85 * a });
      const kx = x + 46 * s + tw * (row.value ?? 0.5);
      surf.circle(kx, vy + 9 * s, 9 * s, C('meHot'), { alpha: a });
    } else if (row.kind === 'knob') {
      const kx = x + 120 * s, ky = vy + 4 * s;
      surf.circle(kx, ky, 34 * s, mix(C('paper'), C('you'), 0.08), { alpha: 0.8 });
      surf.stroke([[...Array(40)].map((_, i) => [kx + Math.cos(-2.2 + i / 40 * 4.4) * 30 * s, ky + Math.sin(-2.2 + i / 40 * 4.4) * 30 * s])], 3 * s, C('me'), { alpha: 0.9 * a });
      const ang = -2.2 + 4.4 * (row.value ?? 0.5);
      surf.line(kx, ky, kx + Math.cos(ang) * 26 * s, ky + Math.sin(ang) * 26 * s, 4 * s, C('you'), { alpha: a });
    } else if (row.kind === 'toggle') {
      const tw = 62 * s, th = 32 * s;
      const on = !!row.value;
      surf.fillPath([roundRect(x + 46 * s, vy - 2 * s, tw, th, th / 2, 10)], on ? C('me') : mix(C('paper'), C('you'), 0.14), { alpha: 0.9 * a });
      surf.circle(x + 46 * s + (on ? tw - th / 2 : th / 2), vy - 2 * s + th / 2, th / 2 - 4 * s, C('ink'), { alpha: 0.9 * a });
    }
    ry += rowH;
  }
  return { x, y, w: pw };
}

// 固定字幕带
export function subtitle(surf, ctx, text, o = {}) {
  const s = o.s ?? ctx.s;
  const y = (o.y ?? 986) * s;
  const size = (o.size ?? 54) * s;
  const a = o.alpha ?? 1;
  if (!text || a <= 0) return;
  drawText(surf, text, {
    font: ctx.fonts.serif, size, color: o.color || C('me'),
    x: o.x ?? 150 * s, y, alpha: a, align: o.align || 'left',
  });
}

// 界面里的她（玻璃/窗口旁）
export function glassFigure(surf, ctx, o) {
  // 由场景直接调用 art.drawFigure，这里只留位置约定
  return o;
}
