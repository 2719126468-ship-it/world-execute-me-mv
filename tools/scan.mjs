// tools/scan.mjs — 全片抽样渲染，检查报错与耗时
import { renderFrame } from '../src/index.js';
const w = parseInt(process.argv[2] || '480', 10);
const h = Math.round(w * 9 / 16);
const step = parseFloat(process.argv[3] || '5');
let worst = 0, worstT = 0, total = 0, n = 0;
for (let t = -5; t < 212; t += step) {
  const a = Date.now();
  try {
    const surf = renderFrame(t, w, h);
    const m = surf.meanLuma();
    const dt = Date.now() - a;
    total += dt; n++;
    if (dt > worst) { worst = dt; worstT = t; }
    console.log(`t=${t.toFixed(1).padStart(6)}  ${String(dt).padStart(5)}ms  mean=${m.toFixed(3)}`);
  } catch (e) {
    console.log(`t=${t.toFixed(1)}  ERROR: ${e.message}`);
    console.log(e.stack.split('\n').slice(0, 4).join('\n'));
  }
}
console.log(`\n平均 ${(total / n).toFixed(0)}ms  最慢 ${worst}ms @ t=${worstT}`);
