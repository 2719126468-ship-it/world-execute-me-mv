// index.js — 段落表与逐帧渲染入口（每帧只由 t 决定）
import fs from 'node:fs';
import path from 'node:path';
import { Surface, hexToRgb, clamp } from './core/raster.js';
import { CFG, loadConfig } from './core/art.js';
import { FONTS, FONT_PATHS } from './core/fonts.js';
import * as preroll from './scenes/00_preroll.js';
import * as boot from './scenes/01_boot.js';
import * as title from './scenes/02_title.js';
import * as pre1 from './scenes/04_pre1.js';
import * as chorus1 from './scenes/05_chorus.js';
import * as verse2 from './scenes/06_verse2.js';
import { setSpot } from './scenes/06_verse2.js';
import * as pre2 from './scenes/07_pre2.js';
import * as chorus2 from './scenes/08_chorus2.js';
import * as alone from './scenes/09_alone.js';
import * as error from './scenes/10_error.js';
import * as execution from './scenes/11_execution.js';
import * as count from './scenes/11_count.js';
import * as last from './scenes/11_last.js';
import * as chorusx from './scenes/12_chorusx.js';
import * as outro from './scenes/12_outro.js';
import * as shutdown from './scenes/13_shutdown.js';
import * as overlay from './scenes/overlay.js';

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
loadConfig(config);
if (setSpot) setSpot(config.spot);

export const SCENES = [
  preroll, boot, title, pre1, chorus1, verse2, pre2, chorus2, alone,
  error, execution, count, last, chorusx, outro, shutdown,
];

export const SONG_END = 211.96;
export const PREROLL = config.safety.preroll;

export function sceneAt(t) {
  for (const sc of SCENES) {
    if (t >= sc.start && t < sc.end) return sc;
  }
  // 兜底：取时间上最近、且真的能画的段
  let best = SCENES[0];
  for (const sc of SCENES) {
    if (typeof sc.draw !== 'function') continue;
    if (sc.start <= t) best = sc;
  }
  return best;
}

export function makeCtx(w, h, t) {
  const s = w / 1920;
  return {
    s, w, h, t,
    fonts: FONTS, fontPaths: FONT_PATHS,
    pal: CFG.palette, spot: CFG.spot,
    config,
    cue: (n) => import('./scenes/cues.js').then((m) => m.cue(n)),
  };
}

// 同步版 cue（场景里用）
import { cue as cueFn, CUES, B, BAR, PREROLL as PRER } from './scenes/cues.js';
export { cueFn as cue, CUES, B, BAR };

export function renderFrame(t, w = 1920, h = 1080) {
  const ctx = makeCtx(w, h, t);
  ctx.cue = cueFn;
  const surf = new Surface(w, h);
  const sc = sceneAt(t);
  sc.draw(ctx, surf, t);
  overlay.post(ctx, surf, t);
  return surf;
}

export function shotList() {
  const out = [];
  for (const sc of SCENES) {
    const shots = typeof sc.shots === 'function' ? sc.shots() : (sc.shots || []);
    for (const sh of shots) {
      out.push({ scene: sc.id, ...sh });
    }
  }
  return out;
}
