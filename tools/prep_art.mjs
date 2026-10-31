// tools/prep_art.mjs — 把 art/hero/*.jpg 预处理成本地可直读的 raw RGB（CI 与本地同一套）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SRC = 'art/hero';
const OUT = process.env.WEM_ART_CACHE || 'out/artcache';
fs.mkdirSync(OUT, { recursive: true });

const files = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort() : [];
const index = {};
for (const f of files) {
  const base = f.replace(/\.[^.]+$/, '');
  const dst = path.join(OUT, base + '.raw');
  const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(SRC, f)], { encoding: 'utf8' }).trim().split(',');
  const w = parseInt(probe[0], 10), h = parseInt(probe[1], 10);
  if (!fs.existsSync(dst) || fs.statSync(dst).size !== w * h * 3) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(SRC, f), '-f', 'rawvideo', '-pix_fmt', 'rgb24', dst]);
  }
  index[base] = { w, h };
  console.log(base, w + 'x' + h);
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
console.log(`prepped ${Object.keys(index).length} images -> ${OUT}`);
