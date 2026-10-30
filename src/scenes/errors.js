import fs from 'node:fs';
import path from 'node:path';
const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs/v4/errors.json'), 'utf8'));
export const ERRORS = j.errors;
