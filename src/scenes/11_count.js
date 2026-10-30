// 11_count.js — 数数 159.11–161.88（六张卡片，整拍）
import { C, mix, drawText, textWidth, ground, glowDisc } from '../core/art.js';
import { clamp, ease } from '../core/raster.js';
import { bloom, scanlines } from '../core/kit.js';
import { mulberry32, hash32 } from '../core/prng.js';

export const id = 'count';
export const start = 159.11;
export const end = 161.88;
export const shots = [
  { id: 'count-1', t0: 159.11, t1: 159.58, kind: 'code' },
  { id: 'count-2', t0: 159.58, t1: 160.04, kind: 'code' },
  { id: 'count-3', t0: 160.04, t1: 160.50, kind: 'code' },
  { id: 'count-4', t0: 160.50, t1: 160.96, kind: 'code' },
  { id: 'count-5', t0: 160.96, t1: 161.42, kind: 'code' },
  { id: 'count-6', t0: 161.42, t1: 161.88, kind: 'code' },
];

const LANGS = [
  { n: 1, word: 'eins', lang: 'de' },
  { n: 2, word: 'dos', lang: 'es' },
  { n: 3, word: 'trois', lang: 'fr' },
  { n: 4, word: 'hana', lang: 'ko' },
  { n: 5, word: 'ett', lang: 'sv' },
  { n: 6, word: 'yi', lang: 'zh' },
];
const T0 = 159.11, BEAT = 0.4615384615;

// 六张卡，六种印刷缺陷——同一句话在六种纸上印六次，没有一次印得干净
const DEFECT = ['misreg', 'spit', 'halftone', 'showthrough', 'tear', 'bleed'];

function applyDefect(surf, ctx, kind, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  if (kind === 'misreg') {
    // 套印偏移：三个版彼此错开，边缘露红
    surf.rgbSplit(Math.round(3 * s));
    for (let i = 0; i < 3; i++) {
      surf.stroke([[...Array(5)].map((_, k) => [W * (0.1 + i * 0.02) + k * 40 * s, H * 0.82 + i * 8 * s])], 1.2 * s, i === 0 ? C('err') : C('me'), { alpha: 0.35 });
    }
  } else if (kind === 'spit') {
    // 飞墨：随机的墨点溅在画面下半
    const rnd = mulberry32(hash32(77));
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W, y = H * 0.55 + rnd() * H * 0.45;
      const r = (0.6 + rnd() * 3.2) * s;
      surf.circle(x, y, r, rnd() > 0.75 ? C('err') : C('ink'), { alpha: 0.5 + rnd() * 0.4 });
    }
  } else if (kind === 'halftone') {
    // 网点过重：整幅叠一层半调
    const step = 7 * s;
    for (let y = 0; y < H; y += step) {
      for (let x = (Math.floor(y / step) % 2) * step / 2; x < W; x += step) {
        const k = 0.12 + 0.1 * Math.sin(x * 0.01 + y * 0.02);
        surf.circle(x, y, step * 0.28, C('ink'), { alpha: k });
      }
    }
  } else if (kind === 'showthrough') {
    // 背面透印：镜像的暗字
    const size = 150 * s;
    const msg = 'replies 0';
    const tw = textWidth(ctx.fonts.mono, msg, size);
    for (let i = 0; i < msg.length; i++) {
      drawText(surf, msg[i], {
        font: ctx.fonts.mono, size, color: C('ink'),
        x: W - 80 * s - i * tw / msg.length, y: H * 0.55, alpha: 0.22,
      });
    }
    surf.rect(0, 0, W, H, C('paper'), 0.08);
  } else if (kind === 'tear') {
    // 撕边：上下纸边锯齿轮廓
    const rnd = mulberry32(hash32(31));
    for (let x = 0; x < W; x += 6 * s) {
      const h = (2 + rnd() * 10) * s;
      surf.rect(x, 0, 6 * s, h, C('ink'), { alpha: 0.9 });
      surf.rect(x, H - h, 6 * s, h, C('ink'), { alpha: 0.9 });
    }
  } else if (kind === 'bleed') {
    // 墨流：数字边缘的墨晕
    const g = surf.clone().brightPass(0.35);
    g.blur(Math.round(7 * s));
    surf.composite(g, 0, 0, 0.55, 'add');
  }
}


export function draw(ctx, surf, t) {
  const s = ctx.s, W = ctx.w, H = ctx.h;
  const idx = clamp(Math.floor((t - T0) / BEAT + 1e-6), 0, 5);
  const local = clamp((t - (T0 + idx * BEAT)) / 0.12, 0, 1);
  const cur = LANGS[idx];
  ground(surf, t, { noise: 4, proof: { sheet: '08/12' }, blobs: [] });
  scanlines(surf, 0.05, 3);

  // 左上：^C + 调用行
  drawText(surf, '^C', { font: ctx.fonts.mono, size: 22 * s, color: C('err'), x: W * 0.06, y: H * 0.1, alpha: 0.9 });
  drawText(surf, '> for (lang of [de, es, fr, ko, sv, zh]) say(love, lang);', {
    font: ctx.fonts.mono, size: 20 * s, color: C('sub'), x: W * 0.06, y: H * 0.15, alpha: 0.65,
  });
  // 当前语言高亮，说过的划掉
  for (let i = 0; i < LANGS.length; i++) {
    const lx = W * 0.06 + i * 130 * s;
    drawText(surf, LANGS[i].lang, {
      font: ctx.fonts.mono, size: 20 * s, color: i === idx ? C('meHot') : C('ash'),
      x: lx, y: H * 0.2, alpha: i === idx ? 1 : 0.55,
    });
    if (i < idx) surf.rect(lx, H * 0.2 - 7 * s, textWidth(ctx.fonts.mono, LANGS[i].lang, 20 * s), 2 * s, C('err'), { alpha: 0.7 });
  }

  // 中央大数字（她的衬线体，橙）
  const scale = 1 + (1 - ease.out(local)) * 0.6;
  drawText(surf, String(cur.n), {
    font: ctx.fonts.serif, size: 380 * s * scale, color: C('you'),
    x: W / 2, y: H * 0.66, align: 'center', alpha: 1,
  });
  // 一侧原文数词（米白），另一侧语言名（作为字符串参数）
  drawText(surf, cur.word, { font: ctx.fonts.serif, size: 74 * s, color: C('meHot'), x: W * 0.2, y: H * 0.62, alpha: 0.95 });
  drawText(surf, 'say(love, "' + cur.lang + '")', { font: ctx.fonts.mono, size: 24 * s, color: C('sub'), x: W * 0.78, y: H * 0.62, alpha: 0.8 });

  // 底部：replies 0 / n
  drawText(surf, 'replies 0 / ' + cur.n, { font: ctx.fonts.mono, size: 26 * s, color: C('you'), x: W / 2, y: H * 0.9, align: 'center', alpha: 0.85 });
  glowDisc(surf, W / 2, H * 0.55, 340 * s, C('me'), 0.18);
  applyDefect(surf, ctx, DEFECT[idx], t);
  bloom(surf, 0.25, 0.55, 18 * s);
}
