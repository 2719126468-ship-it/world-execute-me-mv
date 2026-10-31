// 06_verse2.js — 主歌二 74.19–88.96（茄子 / 番茄 / 猫 / 唯一的神）
import {
  C, mix, ground, drawFigure, plateFigure, drawText, drawTextHollow,
  textWidth, glowDisc, glyphFill, shapeMask, figureMask,
} from '../core/art.js';
import { clamp, lerp, ease } from '../core/raster.js';
import { rays, bloom, flash } from '../core/kit.js';
import { ellipse, smoothClosed, roundRect } from '../core/geom.js';
import { chatFrame, inputBar, userMsg, herMsg, subtitle } from '../core/ui.js';
import { cue } from './cues.js';
import { lineAt } from './texts.js';
import { base, figOrSkip } from '../core/photo.js';

export const id = 'verse2';
export const start = 74.19;
export const end = 88.96;
export const shots = [
  { id: 'v2-ui', t0: 74.19, t1: 75.10, kind: 'ui' },
  { id: 'v2-eggplant', t0: 75.10, t1: 78.80, kind: 'plate' },
  { id: 'v2-tomato', t0: 78.80, t1: 82.04, kind: 'plate' },
  { id: 'v2-cat', t0: 82.04, t1: 85.04, kind: 'plate' },
  { id: 'v2-god', t0: 85.04, t1: 88.96, kind: 'plate' },
];

// 读 config 的专色（由 index.js 调 setSpot 注入）
let SPOT = null;
export function setSpot(s) { SPOT = s; }
function spotOf(name) {
  const s = SPOT || { eggplant: { base: '#7B52AB', light: '#9C74C9', dark: '#4E3172' }, tomato: { base: '#D4432F', light: '#EA6A4E', dark: '#8E2A1C' } };
  const o = s[name];
  return {
    base: parseHex(o.base), light: parseHex(o.light), dark: parseHex(o.dark),
  };
}
function parseHex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

// ---------- 形状 ----------
function eggplantPolys(cx, cy, w, h, cut) {
  const body = smoothClosed([
    [cx, cy - h * 0.46], [cx + w * 0.34, cy - h * 0.34], [cx + w * 0.44, cy - h * 0.02],
    [cx + w * 0.36, cy + h * 0.34], [cx, cy + h * 0.48], [cx - w * 0.3, cy + h * 0.36],
    [cx - w * 0.4, cy + h * 0.02], [cx - w * 0.3, cy - h * 0.34],
  ], 8);
  // 花萼：五角星（火花的形状）
  const calyx = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? h * 0.2 : h * 0.09;
    calyx.push([cx + Math.cos(a) * r * 1.3, cy - h * 0.44 + Math.sin(a) * r * 0.7]);
  }
  const stem = [[cx - w * 0.04, cy - h * 0.5], [cx + w * 0.04, cy - h * 0.5], [cx + w * 0.05, cy - h * 0.66], [cx - w * 0.03, cy - h * 0.66]];
  if (!cut) return { body: [body], calyx: [calyx, stem] };
  // 切开：剖面
  const cutFace = ellipse(cx, cy + h * 0.02, w * 0.3, h * 0.32, 40);
  const seeds = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    seeds.push(ellipse(cx + Math.cos(a) * w * 0.13, cy + h * 0.02 + Math.sin(a) * h * 0.13, w * 0.04, h * 0.05, 12));
  }
  return { body: [body], calyx: [calyx, stem], cut: [cutFace], seeds };
}

function tomatoPolys(cx, cy, w, h, cut) {
  const body = smoothClosed([
    [cx, cy - h * 0.4], [cx + w * 0.36, cy - h * 0.26], [cx + w * 0.44, cy + h * 0.04],
    [cx + w * 0.3, cy + h * 0.38], [cx, cy + h * 0.46], [cx - w * 0.3, cy + h * 0.38],
    [cx - w * 0.44, cy + h * 0.04], [cx - w * 0.36, cy - h * 0.26],
  ], 10);
  const leaf = [];
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
    const r = i % 2 === 0 ? h * 0.2 : h * 0.08;
    leaf.push([cx + Math.cos(a) * r * 1.2, cy - h * 0.36 + Math.sin(a) * r * 0.6]);
  }
  const stem = [[cx - w * 0.02, cy - h * 0.44], [cx + w * 0.02, cy - h * 0.44], [cx + w * 0.03, cy - h * 0.56], [cx - w * 0.01, cy - h * 0.56]];
  if (!cut) return { body: [body], calyx: [leaf, stem] };
  const face = ellipse(cx, cy, w * 0.36, h * 0.38, 40);
  const seeds = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    seeds.push(ellipse(cx + Math.cos(a) * w * 0.16, cy + Math.sin(a) * h * 0.17, w * 0.045, h * 0.055, 12));
  }
  return { body: [body], calyx: [leaf, stem], cut: [face], seeds };
}

// ---------- 相机：名词版画 ----------
function objectPlate(surf, ctx, t, kind) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  base(surf, ctx, t, kind === 'eggplant' ? '11_eggplant' : '12_tomato', { noise: 5, proof: { sheet: '04/12' } });
  const spotc = spotOf(kind === 'eggplant' ? 'eggplant' : 'tomato');
  const t0 = kind === 'eggplant' ? 75.10 : 78.80;
  const openAt = kind === 'eggplant' ? 76.46 : 80.15;
  const giveAt = kind === 'eggplant' ? 77.38 : 81.07;
  const cut = t >= openAt;
  const p = kind === 'eggplant'
    ? eggplantPolys(W * 0.5, H * 0.52, W * 0.3, H * 0.62, cut)
    : tomatoPolys(W * 0.5, H * 0.52, W * 0.42, H * 0.52, cut);

  // 专色主体
  const bodyMask = shapeMask(W, H, p.body);
  glyphFill(surf, bodyMask, {
    font: ctx.fonts.mono, cell: 15 * s, dark: spotc.dark, light: spotc.base, accent: spotc.light, tone: 0.55,
  });
  // 花萼/蒂：她的橙色 + 黑描边（看得出是她扮的）
  if (p.calyx) {
    surf.fillPath(p.calyx, C('me'), { alpha: 0.95 });
    surf.stroke(p.calyx[0].concat([p.calyx[0][0]]), 5 * s, C('ink'), { alpha: 0.9 });
  }
  if (cut && p.cut) {
    surf.fillPath(p.cut, spotc.light, { alpha: 0.95 });
    surf.stroke(p.cut[0].concat([p.cut[0][0]]), 4 * s, C('ink'), { alpha: 0.8 });
    for (const sd of p.seeds || []) surf.fillPath([sd], spotc.dark, { alpha: 0.9 });
    // 切口震一下
    if (t - openAt < 0.2) flash(surf, 0.16 * (1 - (t - openAt) / 0.2));
  }
  // 关键词那一拍：专色流走，变成米白，朝用户一侧（右）离开；物件只剩空心轮廓
  const give = t >= giveAt ? ease.inOut(clamp((t - giveAt) / 0.4, 0, 1)) : 0;
  if (give > 0) {
    // 空心轮廓
    const edge = 3 * s;
    surf.fillPath(p.body, C('paper'), { alpha: 1 });
    surf.stroke(p.body[0].concat([p.body[0][0]]), edge, C('you'), { alpha: 0.7 });
    // 米白块向右离开
    const gx = W * 0.5 + give * W * 0.7;
    const gw = W * 0.3 * (1 - give * 0.6), gh = H * 0.5 * (1 - give * 0.4);
    surf.fillPath([roundRect(gx - gw / 2, H * 0.52 - gh / 2, gw, gh, 16 * s)], C('you'), { alpha: 0.9 * (1 - give * 0.7) });
    // 专色残留（流走）
    surf.fillPath(p.body, spotc.base, { alpha: 0.35 * (1 - give) });
  }
  // 大字
  const word = kind === 'eggplant' ? 'EGGPLANT' : 'TOMATO';
  const size = 120 * s;
  const w = textWidth(ctx.fonts.serif, word, size);
  drawText(surf, word, { font: ctx.fonts.serif, size, color: C('you'), x: W / 2 - w / 2, y: H * 0.9, alpha: 1 });
  bloom(surf, 0.25, 0.6, 20 * s);
  drawText(surf, 'make me an ' + kind, { font: ctx.fonts.monoUi, size: 15 * s, color: C('ash'), x: 46 * s, y: 44 * s, alpha: 0.5 });
}

// ---------- 猫 ----------
function catPlate(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  base(surf, ctx, t, '13_cat', { noise: 5, proof: { sheet: '04/12' } });
  const earsAt = cue('verse2.cat');
  const pawsAt = 83.42;
  const giveAt = cue('verse2.enjoyment');
  const withEars = t >= earsAt;
  const paws = t >= pawsAt;

  if (!paws) {
    // 字符版画：f_bust / cat_bust
    const name = withEars ? 'cat_bust' : 'f_bust';
    const w = H * 0.84 * (1000 / 1400);
    glyphFill(surf, figureMask(name, W, H, { x: W / 2 - w / 2, y: H * 0.08, w }), {
      font: ctx.fonts.mono, cell: 14 * s, dark: C('ink'), light: C('you'), accent: C('me'), tone: 0.5, alpha: 1,
    });
    if (withEars && t - earsAt < 0.3) {
      flash(surf, 0.2 * (1 - (t - earsAt) / 0.3));
    }
  } else {
    // 实心三墨 cat_paws + 呼噜声波形画的虎斑条纹
    const w = H * 0.9 * (1000 / 1400);
    figOrSkip(surf, '13_cat', 'cat_paws', { x: W / 2 - w / 2, y: H * 0.05, w, glow: 0.5 });
    const stripes = [];
    for (let i = 0; i < 14; i++) {
      const y = H * 0.36 + i * 22 * s;
      const amp = 8 * s * Math.sin(t * 9 + i * 0.8);
      const pts = [];
      for (let k = 0; k <= 24; k++) {
        const x = W * 0.3 + (W * 0.4) * (k / 24);
        pts.push([x, y + Math.sin(k * 0.7 + i) * amp]);
      }
      stripes.push(pts);
    }
    const give = t >= giveAt ? clamp((t - giveAt) / 0.35, 0, 1) : 0;
    for (const pts of stripes) {
      surf.stroke(pts, 9 * s, give > 0 ? mix(C('me'), C('you'), give) : C('me'), { alpha: 0.8 * (1 - give * 0.6) });
    }
    if (give > 0) {
      // 条纹变成米白，朝用户一侧离开
      for (const pts of stripes) {
        surf.stroke(pts.map(([x, y]) => [x + give * W * 0.6, y - give * 20 * s]), 9 * s, C('you'), { alpha: 0.5 * give });
      }
    }
  }
  drawText(surf, 'CAT', { font: ctx.fonts.serif, size: 110 * s, color: C('meHot'), x: W / 2, y: H * 0.93, align: 'center', alpha: 1 });
  bloom(surf, 0.3, 0.55, 20 * s);
  drawText(surf, 'make me a cat', { font: ctx.fonts.monoUi, size: 15 * s, color: C('ash'), x: 46 * s, y: 44 * s, alpha: 0.5 });
}

// ---------- 唯一的神 / EXISTENCE ----------
function godPlate(surf, ctx, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  // 灯暗下来
  base(surf, ctx, t, '14_god', { noise: 4, proof: { sheet: '04/12' }, blobs: [] });
  const w = H * 0.92 * (1000 / 1400);
  const fx = W / 2 - w / 2, fy = H * 0.06;
  const godAt = cue('verse2.god');
  const existAt = cue('verse2.existence');
  // 只印橙和黑两个版：米白缺失
  figOrSkip(surf, '14_god', 'f_bust', {
    x: fx, y: fy, w, glow: 0.25,
    role: { black: mix(C('ink'), C('meDim'), 0.18), cream: C('ink'), me: C('me'), paper: mix(C('ink'), C('paper'), 0.35) },
  });
  // god：身后出现橙色日芒，圆心在脸的空洞上
  if (t >= godAt) {
    const cx = W / 2, cy = fy + w * 1.4 * 0.27;
    const rise = clamp((t - godAt) / 0.5, 0, 1);
    const held = 1;
    rays(surf, { cx, cy, n: 28, r0: 80 * s, r1: W * 0.5 * rise, rot: 0, width: 5 * s, color: C('me'), alpha: 0.55 * held });
    rays(surf, { cx, cy, n: 14, r0: 120 * s, r1: W * 0.42 * rise, rot: 0.1, width: 10 * s, color: C('meHot'), alpha: 0.25 * held });
    // 光线只向上走一步，不闪烁
    glowDisc(surf, cx, cy - 40 * s, 220 * s, C('me'), 0.45 * rise);
  }
  // 缺的米白版从用户的气泡那边滑过来，在 EXISTENCE 对准套印
  if (t >= existAt - 0.5) {
    const k = ease.inOut(clamp((t - (existAt - 0.5)) / 0.5, 0, 1));
    const ox = (1 - k) * W * 0.5;
    const off = 0;
    const creamMask = figureMask('f_bust', W, H, { x: fx + ox, y: fy + (1 - k) * 40 * s, w });
    // 用米白版盖住（领口/手/下巴线）
    const layer = new (surf.constructor)(W, H);
    plateFigure(layer, 'f_bust', {
      x: fx + ox, y: fy + (1 - k) * 40 * s, w, glow: 0,
      role: { black: [0, 0, 0], cream: C('you'), me: [0, 0, 0], paper: [0, 0, 0] },
    });
    surf.composite(layer, 0, 0, 0.95, 'over', creamMask);
    if (k >= 0.99) {
      const hit = Math.exp(-(t - existAt) * 8);
      flash(surf, 0.3 * hit);
      bloom(surf, 0.5 * hit, 0.45, 22 * s);
    }
  }
  const word = 'EXISTENCE';
  const size = 110 * s;
  const ww = textWidth(ctx.fonts.serif, word, size);
  drawText(surf, word, { font: ctx.fonts.serif, size, color: t >= existAt ? C('meHot') : C('sub'), x: W / 2 - ww / 2, y: H * 0.93, alpha: 1 });
  drawText(surf, 'the only god', { font: ctx.fonts.monoUi, size: 15 * s, color: C('ash'), x: 46 * s, y: 44 * s, alpha: 0.5 });
}

export function draw(ctx, surf, t) {
  if (t < cue('verse2.eggplant')) return sentence(surf, ctx, t);
  if (t < cue('verse2.tomato')) return objectPlate(surf, ctx, t, 'eggplant');
  if (t < 82.04) return objectPlate(surf, ctx, t, 'tomato');
  if (t < 85.04) return catPlate(surf, ctx, t);
  return godPlate(surf, ctx, t);
}

function sentence(surf, ctx, t) {
  const s = ctx.s;
  surf.fill(mix(C('paper'), [0, 0, 0], 0.25));
  const area = chatFrame(surf, ctx, { alpha: 1, count: 18 });
  const line = lineAt(t);
  if (line) herMsg(surf, ctx, line.text, { x: area.x, y: area.y, alpha: 0.9, size: 32 });
  userMsg(surf, ctx, 'make me something', { x: area.x + area.w, y: area.y + 220 * s, alpha: 0.9 });
  inputBar(surf, ctx, { alpha: 1 });
}
