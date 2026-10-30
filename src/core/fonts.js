// fonts.js — 字体加载（本地系统字体 / CI 可用字体按名回退）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadFont } from './font.js';

const root = process.cwd();
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));

// 字体目录候选：环境变量 > Android 系统 > Linux 发行版常见路径 > 仓库自带
const DIRS = [
  process.env.WEM_FONT_DIR,
  '/system/fonts',
  '/usr/share/fonts/truetype/noto',
  '/usr/share/fonts/truetype/roboto/unhinted',
  '/usr/share/fonts/truetype/roboto',
  '/usr/share/fonts/truetype/dejavu',
  '/usr/share/fonts/truetype',
  path.join(root, 'assets/fonts'),
].filter(Boolean);

function find(names) {
  const list = Array.isArray(names) ? names : [names];
  for (const dir of DIRS) {
    for (const n of list) {
      const p = path.join(dir, n);
      try { if (fs.existsSync(p) && fs.statSync(p).size > 1000) return p; } catch { /* ignore */ }
    }
  }
  return null;
}

// 每一类按顺序找：目标字体 → 同族回退
const SPEC = {
  serif: ['NotoSerif-Regular.ttf', 'NotoSerif-Regular.otf', 'DejaVuSerif.ttf', 'LiberationSerif-Regular.ttf'],
  script: ['DancingScript-Regular.ttf', 'DancingScript-Regular.otf'],
  sans: ['Roboto-Regular.ttf', 'DejaVuSans.ttf', 'LiberationSans-Regular.ttf'],
  sansBold: ['Roboto-Bold.ttf', 'DejaVuSans-Bold.ttf', 'LiberationSans-Bold.ttf'],
  mono: ['CutiveMono.ttf', 'DejaVuSansMono.ttf', 'LiberationMono-Regular.ttf'],
  monoUi: ['DroidSansMono.ttf', 'DejaVuSansMono.ttf', 'LiberationMono-Regular.ttf'],
  cjk: ['DroidSansChinese.ttf', 'NotoSansCJK-Regular.ttc', 'NotoSansSC-Regular.otf', 'NotoSansCJKjp-Regular.otf', 'wqy-zenhei.ttc'],
};

export const FONT_PATHS = {};
export const FONTS = {};
for (const [key, names] of Object.entries(SPEC)) {
  const p = find(names) || find(names);
  FONT_PATHS[key] = p;
  if (p) {
    try { FONTS[key] = loadFont(p); } catch (e) { FONTS[key] = null; }
  } else {
    FONTS[key] = null;
  }
}
// 缺字体时用同类回退，保证任何环境都能出画面
for (const [key, alts] of Object.entries({ sansBold: ['sans'], monoUi: ['mono'], script: ['serif'], cjk: ['sans'], serif: ['sans'] })) {
  if (!FONTS[key]) for (const a of alts) if (FONTS[a]) { FONTS[key] = FONTS[a]; FONT_PATHS[key] = FONT_PATHS[a]; break; }
}

globalThis.__MONO = FONTS.monoUi || FONTS.mono || FONTS.sans;

if (process.env.WEM_FONT_REPORT) {
  for (const k of Object.keys(SPEC)) console.log(k.padEnd(9), FONT_PATHS[k] || '(fallback/none)');
}
