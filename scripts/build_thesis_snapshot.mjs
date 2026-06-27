import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CAPTURED_AT = '2026-02-16';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = join(root, 'data', 'thesis_mteb_leaderboard_2026-02-16.csv');
const outData = join(root, 'data', 'thesis_mteb_snapshot.json');
const outLib = join(root, 'src', 'lib', 'data', 'thesis_mteb_snapshot.json');

if (!existsSync(csvPath)) {
  console.error(`[ERROR] Missing thesis CSV: ${csvPath}`);
  process.exit(1);
}

function parseModelCell(cell) {
  const match = cell.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (match) return { name: match[1], url: match[2] };
  return { name: cell.trim(), url: null };
}

function parseCsvLine(line) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

const raw = readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
const header = parseCsvLine(raw[0]);
const rows = raw.slice(1).map((line) => {
  const cols = parseCsvLine(line);
  const model = parseModelCell(cols[2] ?? '');
  return {
    rank: Number(cols[1]),
    model_name: model.name,
    model_url: model.url,
    memory_mb: cols[3] === '' ? null : Number(cols[3]),
    params_b: cols[4] === '' ? null : Number(cols[4]),
    embedding_dim: cols[5] === '' ? null : Number(cols[5]),
    max_tokens: cols[6] === '' ? null : Number(cols[6]),
    mean_task: cols[7] === '' ? null : Number(cols[7]),
  };
});

const payload = {
  schema_version: 1,
  captured_at: CAPTURED_AT,
  source_file: 'mteb_leaderboard_results_2026-02-16.csv',
  source_note:
    'Frozen MTEB leaderboard export captured for diploma thesis citation. Not live data.',
  built_at: new Date().toISOString(),
  row_count: rows.length,
  rows,
  columns: header.slice(1),
};

const json = `${JSON.stringify(payload, null, 2)}\n`;
writeFileSync(outData, json, 'utf8');
mkdirSync(dirname(outLib), { recursive: true });
writeFileSync(outLib, json, 'utf8');
console.log(`[OK] Wrote thesis snapshot (${rows.length} rows) -> data/ and src/lib/data/`);
