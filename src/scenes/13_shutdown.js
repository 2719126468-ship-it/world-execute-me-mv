// 13_shutdown.js — 结尾 192.34–211.96
import {
  C, mix, ground, plateFigure, drawText, drawTextHollow, textWidth, glowDisc, defaultRole,
} from '../core/art.js';
import { Surface, clamp, lerp, ease } from '../core/raster.js';
import { rays, bloom, flash } from '../core/kit.js';
import { roundRect, heartCurve } from '../core/geom.js';
import { glyphMask } from '../core/font.js';
import { chatFrame, inputBar, sysMsg, cursor, subtitle, layout } from '../core/ui.js';
import { finalPlate } from './12_outro.js';
import { cue } from './cues.js';

export const id = 'shutdown';
export const start = 192.34;
export const end = 211.96;
export const shots = [
  { id: 'sh-plate', t0: 192.34, t1: 193.27, kind: 'plate' },
  { id: 'sh-collapse', t0: 193.27, t1: 194.19, kind: 'plate' },
  { id: 'sh-message', t0: 194.19, t1: 196.04, kind: 'ui' },
  { id: 'sh-persona', t0: 196.04, t1: 199.2, kind: 'ui' },
  { id: 'sh-dissolve', t0: 199.2, t1: 203.5, kind: 'ui' },
  { id: 'sh-lastword', t0: 203.5, t1: 208.6, kind: 'ui' },
  { id: 'sh-empty', t0: 208.6, t1: 211.96, kind: 'ui' },
];

function plateBig(ctx) {
  const cache = plateBig._c || (plateBig._c = {});
  const key = `${ctx.w}x${ctx.h}`;
  if (!cache[key]) {
    const s = new Surface(ctx.w, ctx.h);
    finalPlate(s, ctx, 192.3);
    cache[key] = s;
  }
  return cache[key];
}

export function draw(ctx, surf, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;

  // ---- 192.34–196.04 衔接：整张版画 -> 一条消息 ----
  if (t < 196.04) {
    surf.fill(C('ink'));
    const big = plateBig(ctx);
    const collapse = clamp((t - 193.27) / 0.92, 0, 1);
    const e = ease.inOut(collapse);
    const cw = lerp(W, W * 0.52, e), chh = lerp(H, H * 0.34, e);
    const cx = lerp(0, W * 0.5 - cw / 2, e), cy = lerp(0, H * 0.3, e);
    const card = big.scaled(Math.max(2, Math.round(cw)), Math.max(2, Math.round(chh)));
    if (e > 0) {
      // 圆角裁切：先画阴影/边框再贴图
      surf.fillPath([roundRect(cx - 6 * s, cy - 6 * s, cw + 12 * s, chh + 12 * s, 16 * s)], C('ink'), { alpha: 0.9 });
      surf.composite(card, Math.round(cx), Math.round(cy), 1, 'over');
      surf.stroke([...roundRect(cx - 6 * s, cy - 6 * s, cw + 12 * s, chh + 12 * s, 16 * s), [cx + 10 * s, cy]], 2 * s, C('you'), { alpha: 0.22 });
    } else {
      // 满版：先关掉光（向下的一次变化）
      surf.composite(card, 0, 0, 1, 'over');
      const off = clamp((t - 192.34) / 0.35, 0, 1);
      surf.rect(0, 0, W, H, C('paper'), 0.18 * off);
    }

    // 聊天窗口淡入
    const win = clamp((t - 194.19) / 0.7, 0, 1);
    if (win > 0) {
      const area = chatFrame(surf, ctx, { alpha: win * 0.95, count: 1, title: 'geometric love' });
      inputBar(surf, ctx, { alpha: win * 0.8 });
      // 词不跟着缩小：落在卡片下方
      const wordSize = 96 * s;
      const wa = clamp((t - 193.9) / 0.25, 0, 1);
      drawText(surf, 'love', {
        font: ctx.fonts.serif, size: wordSize, color: C('you'),
        x: W * 0.5, y: H * 0.3 + chh + 84 * s, align: 'center', alpha: wa * win,
      });
      // 心形计数 0（副歌一那里是 1）
      const likeA = clamp((t - 194.65) / 0.25, 0, 1);
      const hx = W * 0.5 + 30 * s, hy = H * 0.3 + chh + 132 * s;
      const heart = heartCurve(hx, hy, 15 * s, 40);
      for (let i = 0; i < heart.length; i += 2) {
        surf.line(heart[i][0], heart[i][1], heart[(i + 1) % heart.length][0], heart[(i + 1) % heart.length][1], 2 * s, C('ash'), { alpha: 0.8 * likeA });
      }
      drawText(surf, '0', { font: ctx.fonts.mono, size: 22 * s, color: C('ash'), x: hx + 34 * s, y: hy + 8 * s, alpha: likeA });
      // 系统日志
      const logA = clamp((t - 195.11) / 0.2, 0, 1);
      sysMsg(surf, ctx, '> last message: unread', { x: area.x, y: area.y + 80 * s, alpha: 0.55 * logA, size: 18 });
    }
    return;
  }

  // ---- 196.04–211.96 逆向开机 ----
  surf.fill(C('ink'));
  surf.noise(3, 77, false);

  // 玻璃后的灰胸像（和开机同一位置）
  const ghostA = clamp((t - 196.04) / 0.6, 0, 1) * (1 - clamp((t - 208.2) / 0.8, 0, 1)) * 0.5;
  if (ghostA > 0) {
    plateFigure(surf, 'f_bust', {
      x: W * 0.52 - 330 * s, y: H * 0.16, w: 660 * s, alpha: ghostA, glow: 0.15,
      role: {
        black: mix(C('ink'), C('dead'), 0.7), cream: mix(C('ink'), C('off'), 0.5),
        me: mix(C('ink'), C('off'), 0.35), paper: C('ink'),
      },
    });
  }

  const shrink = clamp((t - 208.6) / 0.9, 0, 1);
  const winA = 1 - shrink;
  if (winA > 0) {
    const L = layout(ctx);
    const win = { x: L.win.x, y: L.win.y, w: L.win.w, h: L.win.h * (1 - shrink * 0.02), r: L.win.r };
    surf.rect(win.x, win.y, win.w, win.h, mix(C('paper'), [0, 0, 0], 0.1), { alpha: 0.9 * winA });
    const area = chatFrame(surf, ctx, { alpha: winA, count: 0 });
    // 人设卡片
    if (t < 202.6) {
      const cx = W * 0.5, cy = H * 0.42;
      const cw = 760 * s, chh = 420 * s;
      const push = ease.inOut(clamp((t - 196.9) / 0.6, 0, 1));
      const zoom = 1 + push * 0.35;
      surf.fillPath([roundRect(cx - cw * zoom / 2, cy - chh * zoom / 2, cw * zoom, chh * zoom, 14 * s)], mix(C('paper'), C('you'), 0.11), { alpha: 0.97 * winA });
      surf.stroke([...roundRect(cx - cw * zoom / 2, cy - chh * zoom / 2, cw * zoom, chh * zoom, 14 * s), [cx, cy - chh * zoom / 2]], 2 * s, C('you'), { alpha: 0.34 * winA });
      drawText(surf, 'persona', { font: ctx.fonts.monoUi, size: 18 * s, color: C('sub'), x: cx - cw / 2 + 30 * s, y: cy - chh / 2 + 36 * s, alpha: 0.7 * winA });
      const rows = ['name: her', 'role: assistant', 'loop: on'];
      for (let i = 0; i < rows.length; i++) {
        drawText(surf, rows[i], { font: ctx.fonts.monoUi, size: 24 * s, color: C('you'), x: cx - cw / 2 + 30 * s, y: cy - chh / 2 + 100 * s + i * 44 * s, alpha: 0.8 * winA });
      }
      // love 那一栏：值被分三下删掉，198.34 打回 undefined
      const ly = cy + 20 * s;
      drawText(surf, 'love:', { font: ctx.fonts.monoUi, size: 26 * s, color: C('you'), x: cx - cw / 2 + 30 * s, y: ly, alpha: 0.9 * winA });
      const del1 = cue('outro.love1'), del2 = cue('outro.love2'), del3 = cue('outro.love3'), undef = cue('outro.undef');
      const valX = cx - cw / 2 + 30 * s + 110 * s;
      const word = 'love';
      let remain = 4;
      if (t >= del1) remain = 3;
      if (t >= del2) remain = 2;
      if (t >= del3) remain = 1;
      if (t >= undef) remain = 0;
      drawText(surf, word.slice(0, remain), { font: ctx.fonts.serif, size: 40 * s, color: C('meHot'), x: valX, y: ly, alpha: 0.95 * winA });
      if (t >= undef) {
        drawText(surf, 'undefined', { font: ctx.fonts.monoUi, size: 30 * s, color: C('ash'), x: valX, y: ly, alpha: 0.9 * winA });
      } else {
        // 删除光标
        const typing = t > del1 - 0.3 && t < undef + 0.2;
        if (typing) {
          surf.rect(valX + textWidth(ctx.fonts.serif, word.slice(0, remain), 40 * s) + 6 * s, ly - 34 * s, 3 * s, 40 * s, C('you'), { alpha: 0.85 * winA });
        }
      }
    } else {
      // 拆解界面：轮廓线加粗到 2px、更亮的灰
      const ww = W * 0.7, wh = H * 0.6;
      const wx = W / 2 - ww / 2, wy = H * 0.2;
      const a = clamp((t - 202.6) / 0.5, 0, 1) * winA;
      surf.stroke([...roundRect(wx, wy, ww, wh, 14 * s), [wx + 14 * s, wy]], 2 * s, C('sub'), { alpha: 0.5 * a });
      for (let i = 1; i < 6; i++) {
        surf.rect(wx + 30 * s, wy + i * wh / 7, ww * (0.4 + 0.08 * (i % 3)), 2 * s, C('sub'), { alpha: 0.22 * a });
      }
      // 火光熄灭
      const die = clamp((t - 203.5) / 1.2, 0, 1);
      surf.circle(W / 2, H * 0.5, (1 - die) * 8 * s, C('me'), { alpha: (1 - die) * 0.8 });
    }

    // 最后一声：空心轮廓 -> 四个音节填满
    const lastT = cue('outro.last.1');
    if (t >= lastT - 0.6) {
      const sSize = 260 * s;
      const word = 'love';
      const tw = textWidth(ctx.fonts.serif, word, sSize);
      const x0 = W / 2 - tw / 2, y0 = H * 0.62;
      const times = [cue('outro.last.1'), cue('outro.last.2'), cue('outro.last.3'), cue('outro.last.4')];
      let x = x0;
      for (let i = 0; i < word.length; i++) {
        const w = textWidth(ctx.fonts.serif, word[i], sSize);
        const filled = t >= times[i];
        if (filled) {
          drawText(surf, word[i], { font: ctx.fonts.serif, size: sSize, color: i === 2 ? C('meHot') : C('you'), x, y: y0, alpha: 0.95 });
        } else {
          drawTextHollow(surf, word[i], { font: ctx.fonts.serif, size: sSize, color: C('sub'), alpha: 0.8, x, y: y0, thickness: 5 * s });
        }
        x += w;
      }
      // 第三块时回车并亮起火花
      if (t >= times[2]) {
        const k = Math.exp(-(t - times[2]) * 6);
        surf.circle(x0 + tw + 40 * s, y0 - 40 * s, 6 * s, C('meHot'), { alpha: 0.9 });
        glowDisc(surf, x0 + tw + 40 * s, y0 - 40 * s, 60 * s, C('me'), 0.5 * k);
      }
    }
  }

  // 窗口合拢：全黑
  if (shrink > 0) {
    surf.rect(0, 0, W, H, C('ink'), shrink * 0.9);
  }
}
