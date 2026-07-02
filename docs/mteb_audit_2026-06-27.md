---
title: MTEB DE Dashboard Audit — 2026-06-27
description: Audit of MTEB fetch pipeline migration to MTEB(deu,v1), OpenRouter embedding gap, fail-safe semantics, and speckit task completion status.
dates:
  - created: 2026-06-27
  - updated: 2026-06-27
version: 1.0.0
status: reference
author:
  - name: Jan Ritt
    email: janritt.office@gmail.com
    location: Österreich
    github:
      handle: IxI-Enki
      userpage: 'https://github.com/IxI-Enki'
tags: [ mteb, audit, data-pipeline, embeddings, github-actions ]
repo: IxI-Enki/project-diploma-performance-analysis
relates_to:
  - ../README.md
---

Satellite repo: `24_project_diploma_performance_analysis`
Planning hub: `_IxI-Enki/.specify/specs/mteb-de-dashboard/`

## Executive summary

The live site showed **fail OpenRouter 0 priced** and GH Actions logged **404** on deprecated MTEB URLs. Root causes: (1) MTEB redesigned its API — old `/models` and HF Spaces JSON are gone; (2) OpenRouter lists **zero embedding models**, so 0 priced is expected, not a pipeline failure. This pass migrates the fetch pipeline to `MTEB(deu, v1)` via `/v1/benchmarks/.../scores`, demotes removed fallbacks, fixes debug semantics (warn vs fail), and aligns fail-safe exit codes with SC-004.

## Planned vs implemented

| Area | Spec / tasks | Status | Notes |
|------|--------------|--------|-------|
| **US1** — German MTEB rankings table | FR-001, FR-005, FR-007, T020–T029 | **Done** | Astro static table, scope banner, build-time JSON |
| **US2** — Filter & compare (2–4 models) | FR-003, FR-004, T030–T038 | **Done** | Svelte island, Chart.js, vitest |
| **US3** — Metadata, freshness, picker rules | FR-006, FR-011, T039–T045 | **Done** | Dim/price badges, fallback banner, Pagefind |
| **Data pipeline** — MTEB primary source | plan 1.1, T011 | **Fixed 2026-06-27** | Was on stale `/models` + HF JSON; now `mteb/deu-v1-api` |
| **Enrichment** — HF Hub dims | T012 | **Done** | Plus `mteb_api` dim from leaderboard rows |
| **Enrichment** — LiteLLM pricing | T013 | **Partial** | Works when HF slug matches LiteLLM embedding key; most OSS models unmatched → warn |
| **Enrichment** — OpenRouter pricing | T013 | **N/A (expected)** | OpenRouter has no embedding API catalog (0 models) → **warn**, not fail |
| **Fail-safe** — keep last JSON on outage | FR-009, SC-004, T017 | **Fixed 2026-06-27** | `fetch_mteb_de.py` exit 0 when snapshot kept; workflows use `set +e` |
| **Debug panel** — source status | T052 | **Fixed 2026-06-27** | ok / warn / fail / unknown semantics |
| **Thesis snapshot page** | T053–T054 | **Done** | Extra scope beyond original spec |
| **Daily cron 02:00 UTC** | FR-010, T016 | **Done** | |
| **Legacy index.html retired** | T048 | **Done** | |
| **Polish / graphify** | T046–T050 | **Done** | |

**Speckit tasks.md**: All T001–T054 marked complete. The **only production gap** at audit time was the **stale MTEB upstream URL** (infrastructure change at MTEB, not missing UI work).

## Root cause: HF 404

### Old fetch priority chain (broken)

1. `https://mteb-leaderboard-backend.hf.space/models` → **404** (endpoint removed)
2. `mteb/results` parquet dataset → works but slow; was used as de facto primary
3. `mteb` Python package → optional
4. `huggingface.co/spaces/mteb/leaderboard/.../leaderboard_data.json` → **404** (space redesigned)

### New fetch priority chain (2026-06-27)

1. **Primary**: `GET https://mteb-leaderboard-backend.hf.space/v1/benchmarks/MTEB(deu,%20v1)/scores` — German benchmark rows with `scoresByTaskType`, `embeddingDim`, ranks
2. **Fallback**: `mteb/results` parquet (German task filter)
3. **Fallback**: `mteb` Python package
4. **Last resort**: `data/mteb_de_seed.json` (sets `fallback: true`)
5. **Removed**: HF Spaces `leaderboard_data.json` (404, generic not DE-specific)

Frontend SPA: `https://mteb-leaderboard.hf.space/benchmark/MTEB(deu,%20v1)` — HTML only; JSON is on `-backend.hf.space`.

## Root cause: OpenRouter "fail 0 priced"

- `enrich_pricing()` calls `https://openrouter.ai/api/v1/models` and matches by model id slug.
- OpenRouter catalog (2026-06-27): **339 models, 0 embedding** — chat/completion only.
- MTEB leaderboard models are overwhelmingly **Hugging Face embedding checkpoints**, not OpenRouter API slugs.
- LiteLLM has ~98 embedding keys (`text-embedding-3-small`, `cohere.embed-*`, etc.) but keys rarely match HF `org/model` ids → most rows stay `price_source: unknown`.
- **Fix**: Debug panel shows OpenRouter as **warn** with detail *"N/A — OpenRouter has no embedding API prices"*. LiteLLM 0 matches → **warn**, not fail.

## Constitution / workflow alignment

| Principle | Before | After |
|-----------|--------|-------|
| SC-004 fail-safe | Fetch exit 1 broke `update_data.yml` even when JSON kept | Exit 0 + workflow continues with committed snapshot |
| FR-006 pricing | UI implied failure when no OpenRouter matches | Explicit warn + methodology note |
| Principle V primary source | Wrong endpoint | `MTEB(deu, v1)` scores API |

## Verification checklist

```powershell
cd 24_project_diploma_performance_analysis
python scripts/fetch_mteb_de.py
python scripts/validate_json.py
pytest tests/test_fetch_mteb_de.py
npm run test:unit
npm run build

```

Live site after deploy: debug panel should show **ok** for MTEB(deu, v1) API, **warn** for OpenRouter pricing.
