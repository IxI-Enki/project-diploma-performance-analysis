# MTEB DE Embedding Dashboard

Reference dashboard for **German text embedding models** on the public [MTEB](https://huggingface.co/spaces/mteb/leaderboard) leaderboard (RTEB deu).

**Live:** [ixi-enki.github.io/project-diploma-performance-analysis/](https://ixi-enki.github.io/project-diploma-performance-analysis/)

## Purpose

Independent preparation tool for RAG / retrieval architecture — compares public MTEB scores (retrieval, clustering, classification). **Not** diploma-thesis benchmark data (see [LeoWiki MCP case study](https://ixi-enki.github.io/pages/leowiki-mcp.html) for applied evaluation).

## Data

| File | Description |
|------|-------------|
| `data/mteb_de_leaderboard.json` | Top models + task scores |
| `data/manifest.json` | `generated_at`, source, changelog |

Updated **weekly** (Monday 06:00 UTC) via GitHub Actions (`.github/workflows/update_data.yml`).

## Local refresh

```powershell
pip install -r scripts/requirements.txt
python scripts/fetch_mteb_de.py --allow-seed
python scripts/validate_json.py
```

## Sister dashboard

[AI provider landscape](https://ixi-enki.github.io/artificial-intelligence-provider-analysis/)

## Author

Jan Ritt · [IxI-Enki](https://ixi-enki.github.io/)
