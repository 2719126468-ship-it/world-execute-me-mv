// texts.js — 歌词与文案（歌词只从这里取）
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const LYR = JSON.parse(fs.readFileSync(path.join(root, 'docs/v4/lyrics.json'), 'utf8'));

export const LINES = LYR.lines;

export function text(i) {
  const l = LINES.find((x) => x.id === i);
  return l ? l.text : '';
}

export function lineAt(t) {
  let cur = null;
  for (const l of LINES) {
    if (t >= l.t0 && t < l.t1) { cur = l; break; }
  }
  return cur;
}

export function lineById(id) { return LINES.find((l) => l.id === id) || null; }

// 行内逐词出现：返回 [{word, start}]
export function wordsWithTimes(line) {
  const words = String(line.text).split(' ');
  const span = line.t1 - line.t0;
  const dur = Math.min(span * 0.72, words.length * 0.42);
  const step = dur / Math.max(1, words.length);
  return words.map((w, i) => ({ word: w, start: line.t0 + i * step }));
}

// 字幕带文案：非关键词行在开唱后出现
export function subtitleAt(t, band = [88.96, 103.73]) {
  const l = lineAt(t);
  if (!l || l.kw) return null;
  return { text: l.text, t0: l.t0, t1: l.t1 };
}
