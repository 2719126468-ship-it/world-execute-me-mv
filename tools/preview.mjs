// tools/preview.mjs — 把 PNG 变成终端字符画，用于「看」构图
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const args = process.argv.slice(2);
const file = args[0];
const width = parseInt(args[args.indexOf('--w') + 1] || '120', 10) || 120;
const ci = args.indexOf('--crop');
const crop = ci >= 0 ? args[ci + 1] : null;
const RAMP = ' .:-=+*#%@';

const vf = (crop ? `crop=${crop},` : '') + `scale=${width}:-1:flags=area,format=gray`;
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', vf, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 });
const h = Math.round(raw.length / width);
let out = '';
for (let y = 0; y < h; y++) {
  let line = '';
  for (let x = 0; x < width; x++) {
    const v = raw[y * width + x] / 255;
    line += RAMP[Math.min(RAMP.length - 1, Math.floor(Math.pow(v, 0.8) * RAMP.length))];
  }
  out += line + '\n';
}
console.log(out);
const st = fs.statSync(file);
console.log(`${file}  ${st.size} bytes  ${width}x${h}`);
