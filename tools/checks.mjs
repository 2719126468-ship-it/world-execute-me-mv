// tools/checks.mjs — 第七节重点自查：出单帧并给出数值结论
import fs from 'node:fs';
import path from 'node:path';
import { Surface, hexToRgb } from '../src/core/raster.js';
import { CFG, loadConfig, C, mix, ground, drawText, textWidth } from '../src/core/art.js';
import { FONTS } from '../src/core/fonts.js';
import { objectPlate, catPlate, godPlate, setSpot } from '../src/scenes/06_verse2.js';
import { satis, stim } from '../src/scenes/05_chorus.js';
import { plateRole, plateGender } from '../src/scenes/07_pre2.js';
import { shotEye, shotBust, shotHand } from '../src/scenes/12_chorusx.js';
import { proof } from '../src/scenes/12_outro.js';
import { heartCurve } from '../src/core/geom.js';
import { rays } from '../src/core/kit.js';

const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
loadConfig(cfg);
setSpot(cfg.spot);
const outDir = 'out/checks';
fs.mkdirSync(outDir, { recursive: true });

const W = 1920, H = 1080;
const ctx = { s: 1, w: W, h: H, fonts: FONTS, pal: CFG.palette, spot: CFG.spot, config: cfg };
const results = [];

function shot(name, fn, w = W, h = H, extra = {}) {
  const surf = new Surface(w, h);
  const c = { ...ctx, s: w / 1920, w, h };
  const t0 = Date.now();
  fn(surf, c);
  const mean = surf.meanLuma();
  let min = 255, max = 0, sum = 0, n = 0;
  for (let i = 0; i < surf.data.length; i += 3) {
    const v = surf.data[i] * 0.299 + surf.data[i + 1] * 0.587 + surf.data[i + 2] * 0.114;
    if (v < min) min = v; if (v > max) max = v; sum += v; n++;
  }
  const p = path.join(outDir, name + '.png');
  fs.writeFileSync(p, surf.toPNG());
  results.push({ name, file: p, mean: +mean.toFixed(3), min: Math.round(min), max: Math.round(max), ms: Date.now() - t0, ...extra });
  return surf;
}

// 1. 茄子 / 番茄：完整与切开（不带歌词）
shot('eggplant_full', (s, c) => objectPlate(s, { ...c, t: 75.6 }, 75.6, 'eggplant'));
shot('eggplant_cut', (s, c) => objectPlate(s, c, 76.7, 'eggplant'));
shot('tomato_full', (s, c) => objectPlate(s, c, 79.3, 'tomato'));
shot('tomato_cut', (s, c) => objectPlate(s, c, 80.6, 'tomato'));

// 2. 专色色卡：茄紫 / 番茄红 / 她的橙 / 错误红，并排暗底
shot('color_chip', (s, c) => {
  ground(s, 0, { noise: 4, marks: false });
  const cols = [
    ['eggplant', hexToRgb(cfg.spot.eggplant.base)],
    ['tomato', hexToRgb(cfg.spot.tomato.base)],
    ['me', C('me')],
    ['err', C('err')],
  ];
  const w = W / 4;
  for (let i = 0; i < 4; i++) {
    s.rect(i * w + 20, H * 0.28, w - 40, H * 0.34, cols[i][1], { alpha: 1 });
    drawText(s, cols[i][0], { font: c.fonts.monoUi, size: 26, color: C('you'), x: i * w + 40, y: H * 0.72, alpha: 0.9 });
    const [r, g, b] = cols[i][1];
    drawText(s, `R/(R+G+B)=${(r / (r + g + b)).toFixed(2)}`, { font: c.fonts.monoUi, size: 20, color: C('sub'), x: i * w + 40, y: H * 0.76, alpha: 0.8 });
  }
});

// 3. 时间旅行带：整条带缩到 640 宽（由调用方看缩略图）
shot('era_band', (s, c) => {
  // 直接复用 pre1 的 dateScene 会带文字，这里单独画一条带
  ground(s, 0, { noise: 4 });
  const bandY = H * 0.1, bandH = H * 0.8;
  s.rect(0, bandY, W, bandH, mix(C('paper'), [0, 0, 0], 0.2), { alpha: 0.96 });
  const eras = ['tower', 'spire', 'colonnade', 'pyramid'];
  for (let i = 0; i < 10; i++) {
    const x = W * 0.1 + i * W * 0.3;
    const kind = eras[i % 4];
    const h = bandH * 0.42;
    const y = bandY + bandH * 0.8;
    let p;
    if (kind === 'tower') p = [[x - 70, y], [x - 70, y - h * 0.72], [x - 20, y - h * 0.86], [x - 20, y - h], [x + 30, y - h * 0.9], [x + 70, y - h * 0.62], [x + 70, y]];
    else if (kind === 'spire') p = [[x - 56, y], [x - 32, y - h * 0.4], [x - 12, y - h * 0.9], [x, y - h], [x + 12, y - h * 0.9], [x + 32, y - h * 0.4], [x + 56, y]];
    else if (kind === 'colonnade') p = [[x - 95, y], [x - 95, y - h * 0.7], [x + 95, y - h * 0.7], [x + 95, y]];
    else p = [[x - 115, y], [x - 32, y - h], [x + 32, y - h], [x + 115, y]];
    s.fillPath([p], mix(C('ink'), C('meDim'), 0.35), { alpha: 0.92 });
    s.fillPath([p.map(([px, py]) => [px + 8, py + 8])], C('meDim'), { alpha: 0.25 });
  }
  s.rect(0, bandY + bandH * 0.8, W, 3, C('you'), { alpha: 0.2 });
});

// 4. SATISFACTION 圆盘：按下前 / 按下后
shot('satis_before', (s, c) => satis(s, c, 65.6));
shot('satis_after', (s, c) => satis(s, c, 66.0));

// 5. 软塌的 M：停住那一帧
shot('m_sag', (s, c) => plateRole(s, c, 99.7));

// 6. 眼睛 / 手：1080p 参考（4K 另出）
shot('eye_1080', (s, c) => shotEye(s, c, 163.2));
shot('hand_1080', (s, c) => shotHand(s, c, 171.2));

// 7. 最后一帧与停留
const final1 = shot('final_frame', (s, c) => proof(s, c, 192.1));
const fA = new Surface(W, H); proof(fA, ctx, 191.78);
const fB = new Surface(W, H); proof(fB, ctx, 192.3);
let diff = 0, big = 0;
for (let i = 0; i < fA.data.length; i += 3) {
  const d = Math.abs(fA.data[i] - fB.data[i]) + Math.abs(fA.data[i + 1] - fB.data[i + 1]) + Math.abs(fA.data[i + 2] - fB.data[i + 2]);
  diff += d; if (d > 6) big++;
}
const stay = { meanDiff: +(diff / (fA.data.length / 3)).toFixed(2), changedPct: +(100 * big / (fA.data.length / 3)).toFixed(2), span: 0.52 };

// 8. 关键词版画（坏版）
shot('stim_broken', (s, c) => stim(s, c, 165.3));

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ results, stay }, null, 2));
console.log('name                 mean   min  max   ms');
for (const r of results) console.log(r.name.padEnd(20), String(r.mean).padStart(5), String(r.min).padStart(4), String(r.max).padStart(4), String(r.ms).padStart(5));
console.log('\n最后一帧停留 191.78→192.30:', JSON.stringify(stay));
