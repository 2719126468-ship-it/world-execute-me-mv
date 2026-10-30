// tools/check.mjs — 汇总技术检查
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const run = (label, cmd, args, allowFail = true) => {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
    console.log(`\n=== ${label} ===\n${out.trim()}`);
    return { ok: true, out };
  } catch (e) {
    console.log(`\n=== ${label} ===\n${(e.stdout || '') + (e.stderr || '')}`);
    if (!allowFail) process.exit(1);
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
};

let bad = 0;
// 分镜表
try { execFileSync('node', ['tools/storyboard.mjs'], { stdio: 'inherit' }); }
catch { bad++; console.log('storyboard FAIL'); }

// 闪光
if (fs.existsSync('out/fix_climax.mp4')) {
  const r = run('flash 146–197', 'python3', ['tools/check_flash.py', 'out/fix_climax.mp4', '--start', '0', '--end', '51', '--preroll', '-146']);
  if (!r.ok) bad++;
}
if (fs.existsSync('out/preview_360p30.mp4')) {
  const r = run('flash full', 'python3', ['tools/check_flash.py', 'out/preview_360p30.mp4', '--preroll', '5']);
  if (!r.ok) bad++;
}
// 同步
run('sync', 'python3', ['tools/check_sync.py', 'audio/track.wav', '--cues', 'src/scenes/cues.js']);

console.log(`\ncheck done, failures=${bad}`);
process.exit(bad ? 1 : 0);
