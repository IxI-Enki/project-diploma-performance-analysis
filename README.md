# MTEB DE Embedding Dashboard

Reference dashboard for **German text embedding models** on the public [MTEB](https://huggingface.co/spaces/mteb/leaderboard) leaderboard (RTEB deu).

**Live:** [ixi-enki.github.io/project-diploma-performance-analysis/](https://ixi-enki.github.io/project-diploma-performance-analysis/)

## Purpose

Independent preparation tool for RAG / retrieval architecture — compares public MTEB scores (retrieval, clustering, classification). **Not** diploma-thesis benchmark data (see [LeoWiki MCP case study](https://ixi-enki.github.io/pages/leowiki-mcp.html) for applied evaluation).

## Planning hub

Feature spec, plan, and tasks: [`_IxI-Enki/.specify/specs/mteb-de-dashboard/`](https://github.com/IxI-Enki/IxI-Enki/tree/004-mteb-de-dashboard/.specify/specs/mteb-de-dashboard/)

## Data

| File | Description |
|------|-------------|
| `data/mteb_de_leaderboard.json` | Top models + task scores |
| `data/manifest.json` | `generated_at`, source, changelog |

Updated **daily** (02:00 UTC) via GitHub Actions (`.github/workflows/update_data.yml`).

## Local data refresh

```powershell
pip install -r scripts/requirements.txt
python scripts/fetch_mteb_de.py
python scripts/validate_json.py
```

Seed-only bootstrap (no network):

```powershell
python scripts/fetch_mteb_de.py --seed-only
python scripts/validate_json.py
```

## Astro build

```powershell
npm ci
npm run dev          # local dev server
npm run build        # static site + Pagefind index
npx astro check      # type check
npm run test:unit    # vitest filter/compare tests
pytest tests/test_fetch_mteb_de.py
```

`prebuild` copies `data/*.json` into `src/lib/data/` for build-time imports.

## Sister dashboard

[AI provider landscape](https://ixi-enki.github.io/artificial-intelligence-provider-analysis/)

## Author

Jan Ritt · [IxI-Enki](https://ixi-enki.github.io/)
