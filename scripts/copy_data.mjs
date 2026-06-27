import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const destDir = join(root, 'src', 'lib', 'data');
mkdirSync(destDir, { recursive: true });

for (const name of ['mteb_de_leaderboard.json', 'manifest.json']) {
  const src = join(root, 'data', name);
  const dest = join(destDir, name);
  if (!existsSync(src)) {
    console.error(`[ERROR] Missing ${src}`);
    process.exit(1);
  }
  copyFileSync(src, dest);
  console.log(`[OK] Copied ${name} -> src/lib/data/`);
}
