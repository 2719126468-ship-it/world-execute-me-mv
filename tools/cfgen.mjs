// tools/cfgen.mjs — Cloudflare Workers AI (FLUX.1 schnell) 批量出图
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const env = Object.fromEntries(
  fs.readFileSync(path.join(process.env.HOME, '.dsh/.cf-ai.env'), 'utf8')
    .split('\n').filter(Boolean).map((l) => l.split('=').slice(0, 2))
);
const ACCT = env.CF_ACCOUNT_ID, TOKEN = env.CF_AI_TOKEN;
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const url = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/ai/run/${MODEL}`;

export async function gen(prompt, opts = {}) {
  const body = {
    prompt,
    steps: opts.steps ?? 8,
    width: opts.width ?? 1024,
    height: opts.height ?? 1024,
    seed: opts.seed ?? Math.floor(Math.random() * 1e6),
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.result || !j.result.image) throw new Error('gen fail: ' + JSON.stringify(j).slice(0, 300));
  return { buf: Buffer.from(j.result.image, 'base64'), seed: body.seed };
}

if (process.argv[1].endsWith('cfgen.mjs')) {
  const list = JSON.parse(fs.readFileSync(process.argv[2] || 'art/prompts.json', 'utf8'));
  const outDir = process.argv[3] || 'art/gen';
  fs.mkdirSync(outDir, { recursive: true });
  for (const item of list) {
    const out = path.join(outDir, item.id + '.jpg');
    if (fs.existsSync(out) && !process.argv.includes('--force')) { console.log('skip', item.id); continue; }
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        const { buf, seed } = await gen(item.prompt, { width: item.w || 1024, height: item.h || 1024, steps: 8 });
        fs.writeFileSync(out, buf);
        console.log(item.id, buf.length, 'seed', seed);
        ok = true;
      } catch (e) {
        console.log(item.id, 'retry', attempt, e.message.slice(0, 80));
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
    await new Promise((r) => setTimeout(r, 700));
  }
}
