// tools/storyboard.mjs — 生成 STORYBOARD.md（鏡頭表）
import fs from 'node:fs';
import { SCENES, shotList, SONG_END, PREROLL } from '../src/index.js';
import { CUES } from '../src/scenes/cues.js';

const shots = shotList().filter((s) => s.t1 > s.t0).sort((a, b) => a.t0 - b.t0);
const fmt = (t) => {
  const sign = t < 0 ? '-' : '';
  const a = Math.abs(t);
  const m = Math.floor(a / 60);
  const s = a - m * 60;
  return `${sign}${m}:${s.toFixed(2).padStart(5, '0')}`;
};

let md = `# STORYBOARD — world.execute(me); v4\n\n`;
md += `> 由 \`npm run storyboard\` 從 \`src/scenes/*\` 的鏡頭表生成，不要手改。\n\n`;
md += `- 片長：${(SONG_END + PREROLL).toFixed(2)} 秒（含片頭 ${PREROLL} 秒警告頁，歌曲 ${SONG_END} 秒）\n`;
md += `- 130 BPM，第 0 拍 0.344 秒，一拍 0.4615 秒\n`;
md += `- 畫幅：1920×1080（4K 由同一組向量重繪）\n\n`;

md += `## 段落\n\n| 段落 | 開始 | 結束 | 鏡頭數 |\n| --- | --- | --- | --- |\n`;
for (const sc of SCENES) {
  if (sc.end - sc.start > 1e8) continue;
  const n = (sc.shots || []).length;
  md += `| ${sc.id} | ${fmt(sc.start)} | ${fmt(sc.end)} | ${n} |\n`;
}

md += `\n## 鏡頭\n\n| # | 鏡頭 id | 段落 | 開始 | 結束 | 秒 | 類型 |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
shots.forEach((s, i) => {
  md += `| ${i + 1} | \`${s.id}\` | ${s.scene} | ${fmt(s.t0)} | ${fmt(s.t1)} | ${(s.t1 - s.t0).toFixed(2)} | ${s.kind} |\n`;
});

md += `\n## 拍點與人聲（cues.js）\n\n| 名稱 | 歌曲時間 | 成片時間 | 來源 | 說明 |\n| --- | --- | --- | --- | --- |\n`;
for (const [k, v] of Object.entries(CUES)) {
  md += `| \`${k}\` | ${v.t.toFixed(2)} | ${(v.t + PREROLL).toFixed(2)} | ${v.src} | ${v.note || ''} |\n`;
}

const backfill = shots.filter((s) => s.kind === 'fallback');
md += `\n## 檢查\n\n- 鏡頭總數：${shots.length}\n- 後備鏡頭：${backfill.length}${backfill.length ? '（' + backfill.map((s) => s.id).join(', ') + '）' : ''}\n`;

fs.writeFileSync('STORYBOARD.md', md);
console.log(`STORYBOARD.md  ${shots.length} shots, ${Object.keys(CUES).length} cues, fallback=${backfill.length}`);
if (backfill.length) process.exit(1);
