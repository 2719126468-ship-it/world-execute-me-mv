// tools/inspect.mjs — 网格亮度 / 区域对比度（数值「看」图）
import { execFileSync } from 'node:child_process';

const file = process.argv[2];
const W = 1920, H = 1080;
const b = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=192:108:flags=area,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 });
const gw = 192, gh = 108;
const GX = 16, GY = 9;
let out = '    ';
for (let gx = 0; gx < GX; gx++) out += String(gx).padStart(3);
out += '\n';
for (let gy = 0; gy < GY; gy++) {
  out += String(gy).padStart(3) + ' ';
  for (let gx = 0; gx < GX; gx++) {
    let sum = 0, n = 0, mn = 255, mx = 0;
    for (let y = Math.floor(gy * gh / GY); y < Math.floor((gy + 1) * gh / GY); y++) {
      for (let x = Math.floor(gx * gw / GX); x < Math.floor((gx + 1) * gw / GX); x++) {
        const v = b[y * gw + x];
        sum += v; n++; if (v < mn) mn = v; if (v > mx) mx = v;
      }
    }
    const mean = sum / n / 255;
    out += String(Math.round(mean * 9)).padStart(3);
  }
  out += '\n';
}
console.log(out);
let min = 255, max = 0;
for (const v of b) { if (v < min) min = v; if (v > max) max = v; }
console.log(`${file}  mean=${(b.reduce((a, v) => a + v, 0) / b.length / 255).toFixed(3)} min=${min} max=${max}`);
