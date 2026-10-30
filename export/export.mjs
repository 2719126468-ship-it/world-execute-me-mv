// export/export.mjs — 逐帧渲染并通过管道交给 ffmpeg
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { renderFrame } from '../src/index.js';

const args = process.argv.slice(2);
const A = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const start = parseFloat(A('start', '0'));
const end = parseFloat(A('end', '211.96'));
const width = parseInt(A('width', '1920'), 10);
const height = parseInt(A('height', '1080'), 10);
const fps = parseFloat(A('fps', '60'));
const out = A('out', 'out/preview.mp4');
const crf = A('crf', '20');
const preset = A('preset', 'veryfast');
const audio = A('audio', 'audio/track.wav');
const withAudio = A('noaudio', null) === null;

fs.mkdirSync(path.dirname(out) || '.', { recursive: true });
const frames = Math.max(1, Math.round((end - start) * fps));
const dur = end - start;

const ffArgs = ['-y', '-v', 'error'];
ffArgs.push('-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${width}x${height}`, '-r', String(fps), '-i', '-');
if (withAudio && fs.existsSync(audio)) {
  // 片头 preroll：歌曲时间 0 对应成片 5 秒
  const songStart = Math.max(0, start);
  ffArgs.push('-ss', String(songStart), '-t', String(dur), '-i', audio);
  if (start < 0) ffArgs.push('-af', `adelay=${Math.round(-start * 1000)}|${Math.round(-start * 1000)}`);
}
ffArgs.push('-c:v', 'libx264', '-preset', preset, '-crf', crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
if (withAudio && fs.existsSync(audio)) ffArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
ffArgs.push(out);

const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
let written = 0;
let closed = false;
ff.on('close', (code) => { closed = true; console.log(`\nffmpeg exit ${code}  ${out}`); });

const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  const t = start + i / fps;
  const surf = renderFrame(t, width, height);
  const buf = Buffer.from(surf.data.buffer, surf.data.byteOffset, surf.data.length);
  if (!ff.stdin.write(buf)) {
    await new Promise((r) => ff.stdin.once('drain', r));
  }
  written++;
  if (i % Math.max(1, Math.round(fps * 2)) === 0) {
    const el = (Date.now() - t0) / 1000;
    const eta = (el / (i + 1)) * (frames - i - 1);
    process.stdout.write(`\r${path.basename(out)}  ${i + 1}/${frames}  ${(el / (i + 1) * 1000).toFixed(0)}ms/f  eta ${(eta / 60).toFixed(1)}min   `);
  }
}
ff.stdin.end();
await new Promise((r) => (closed ? r() : ff.on('close', r)));
console.log(`done ${out}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
