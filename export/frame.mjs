// export/frame.mjs — 渲染单帧 PNG
import fs from 'node:fs';
import { renderFrame } from '../src/index.js';

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
}
const t = parseFloat(arg('t', '0'));
const w = parseInt(arg('w', '1920'), 10);
const h = parseInt(arg('h', '1080'), 10);
const out = arg('out', `out/frame_${t.toFixed(2)}.png`);

const t0 = Date.now();
const surf = renderFrame(t, w, h);
const png = surf.toPNG();
fs.mkdirSync(out.replace(/\/[^/]+$/, '') || '.', { recursive: true });
fs.writeFileSync(out, png);
console.log(`${out}  ${w}x${h}  t=${t}  ${Date.now() - t0}ms  mean=${surf.meanLuma().toFixed(3)}`);
