import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const FORBIDDEN = [
  /https?:\/\/mteb-leaderboard-backend\.hf\.space/i,
  /https?:\/\/huggingface\.co\/api\//i,
  /https?:\/\/openrouter\.ai\//i,
  /https?:\/\/raw\.githubusercontent\.com\/BerriAI\/litellm/i,
  /https?:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js/i,
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (['.html', '.js', '.css', '.json'].includes(extname(p))) files.push(p);
  }
  return files;
}

if (!statSync(dist, { throwIfNoEntry: false })?.isDirectory()) {
  console.error('[ERROR] dist/ not found — run npm run build first');
  process.exit(1);
}

const hits = [];
for (const file of walk(dist)) {
  const text = readFileSync(file, 'utf8');
  for (const pattern of FORBIDDEN) {
    if (pattern.test(text)) hits.push({ file, pattern: pattern.source });
  }
}

if (hits.length) {
  console.error('[ERROR] Runtime third-party API URLs found in dist/:');
  for (const h of hits) console.error(`  ${h.file}: ${h.pattern}`);
  process.exit(1);
}

console.log('[OK] verify:static — no forbidden third-party API URLs in dist/');
