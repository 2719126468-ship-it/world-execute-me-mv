// tools/cfgen2.mjs — 用 Cloudflare FLUX.1 schnell 重画插画（无 Google 依赖）
import fs from 'node:fs';
import path from 'node:path';

const env = Object.fromEntries(
  fs.readFileSync(path.join(process.env.HOME, '.dsh/.cf-ai.env'), 'utf8')
    .split('\n').filter(Boolean).map((l) => l.split('=').slice(0, 2))
);
const ACCT = env.CF_ACCOUNT_ID, TOKEN = env.CF_AI_TOKEN;
const URL = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/ai/run/@cf/black-forest-labs/flux-1-schnell`;

const CHAR = ("anime illustration of a single girl, long deep blue hair, small whale-fin shaped ears, "
  + "navy blue maid dress with a white apron, whale tail, pale skin, calm expression, "
  + "cel shading, clean linework, deep navy and white colour palette, cinematic rim light, film still, high detail");

export async function gen(prompt, seed) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: `${CHAR}. ${prompt}`, steps: 8 }),
  });
  const j = await r.json();
  if (!j.result || !j.result.image) throw new Error(JSON.stringify(j).slice(0, 200));
  return Buffer.from(j.result.image, 'base64');
}

if (process.argv[1].endsWith('cfgen2.mjs')) {
  const list = JSON.parse(fs.readFileSync('art/redo.json', 'utf8'));
  const outDir = 'art/hero';
  for (const item of list) {
    const out = path.join(outDir, item.id + '.jpg');
    let ok = false;
    for (let a = 0; a < 3 && !ok; a++) {
      try {
        const buf = await gen(item.prompt, item.seed ?? 1234);
        fs.writeFileSync(out, buf);
        console.log('ok', item.id, buf.length);
        ok = true;
      } catch (e) {
        console.log('retry', item.id, e.message.slice(0, 90));
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    if (!ok) console.log('FAIL', item.id);
    await new Promise((r) => setTimeout(r, 800));
  }
}
