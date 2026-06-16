#!/usr/bin/env python3
"""Fetch MTEB German-relevant embedding scores for showcase dashboard."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import jsonschema
import requests

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUT_FILE = DATA_DIR / "mteb_de_leaderboard.json"
MANIFEST_FILE = DATA_DIR / "manifest.json"
SCHEMA_FILE = DATA_DIR / "schema_mteb_de.json"
SEED_FILE = DATA_DIR / "mteb_de_seed.json"

HF_RESULTS_URL = (
    "https://huggingface.co/spaces/mteb/leaderboard/resolve/main/"
    "leaderboard_data/leaderboard_data.json"
)
SOURCE_URL = "https://huggingface.co/spaces/mteb/leaderboard"
SCHEMA_VERSION = "1.0.0"

# Thesis-adjacent models must not appear on this public reference dashboard
EXCLUDED_MODEL_PREFIXES = ("Octen/",)

PICKER_RULES = [
    {
        "task": "retrieval",
        "resources": "high",
        "model_id": "intfloat/multilingual-e5-large-instruct",
        "reason_en": "Strong multilingual retrieval with instruct tuning; good default for German RAG.",
        "reason_de": "Starkes multilinguales Retrieval mit Instruct-Tuning; solider Default fuer Deutsch-RAG.",
    },
    {
        "task": "retrieval",
        "resources": "low",
        "model_id": "intfloat/multilingual-e5-base",
        "reason_en": "Smaller footprint while keeping competitive retrieval scores.",
        "reason_de": "Kleineres Modell bei weiterhin konkurrenzfaehigen Retrieval-Werten.",
    },
    {
        "task": "clustering",
        "resources": "high",
        "model_id": "deutsche-telekom/gbert-large",
        "reason_en": "German-focused encoder; strong on monolingual clustering benchmarks.",
        "reason_de": "Deutsch-spezifischer Encoder; stark bei monolingualen Clustering-Benchmarks.",
    },
    {
        "task": "clustering",
        "resources": "low",
        "model_id": "sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
        "reason_en": "Lightweight multilingual baseline for grouping German text.",
        "reason_de": "Leichtes multilinguales Basismodell zum Gruppieren deutscher Texte.",
    },
    {
        "task": "classification",
        "resources": "high",
        "model_id": "intfloat/multilingual-e5-large-instruct",
        "reason_en": "Balanced task coverage across MTEB classification suites.",
        "reason_de": "Ausgewogene Task-Abdeckung ueber MTEB-Klassifikations-Suites.",
    },
    {
        "task": "classification",
        "resources": "low",
        "model_id": "intfloat/multilingual-e5-small",
        "reason_en": "Efficient option when latency and VRAM matter more than peak accuracy.",
        "reason_de": "Effiziente Option wenn Latenz und VRAM wichtiger sind als Spitzen-Accuracy.",
    },
]


def is_excluded(model_id: str) -> bool:
    return model_id.startswith(EXCLUDED_MODEL_PREFIXES)


def load_seed_models() -> list[dict]:
    seed = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    return [m for m in seed["models"] if not is_excluded(m["model_id"])]


def _task_score(entry: dict, keywords: tuple[str, ...]) -> float | None:
    scores: list[float] = []
    for task_name, value in entry.items():
        if not isinstance(value, (int, float)):
            continue
        if any(k in task_name for k in keywords):
            scores.append(float(value))
    return round(sum(scores) / len(scores), 2) if scores else None


def parse_hf_leaderboard(payload: list | dict) -> list[dict]:
    rows = payload if isinstance(payload, list) else payload.get("data", [])
    models: dict[str, dict] = {}

    for row in rows:
        if not isinstance(row, dict):
            continue
        model_id = row.get("model_name") or row.get("Model") or row.get("model")
        if not model_id or is_excluded(model_id):
            continue

        retrieval = _task_score(row, ("Retrieval", "retrieval", "GermanRetrieval"))
        clustering = _task_score(row, ("Clustering", "clustering", "GermanClustering"))
        classification = _task_score(row, ("Classification", "classification"))
        sts = _task_score(row, ("STS", "sts", "GermanSTSBenchmark"))

        task_vals = [v for v in (retrieval, clustering, classification, sts) if v is not None]
        avg_score = row.get("Average") or row.get("avg_score")
        if avg_score is None and task_vals:
            avg_score = round(sum(task_vals) / len(task_vals), 2)
        if avg_score is None:
            continue

        models[model_id] = {
            "model_id": model_id,
            "avg_score": round(float(avg_score), 2),
            "params_m": row.get("Number of Parameters (B)") or row.get("params_m"),
            "license": row.get("License") or row.get("license"),
            "updated": row.get("Model Revision") or row.get("updated"),
            "tasks": {
                "retrieval": retrieval,
                "clustering": clustering,
                "classification": classification,
                "sts": sts,
            },
        }

    ranked = sorted(models.values(), key=lambda m: m["avg_score"], reverse=True)
    return ranked[:20]


def fetch_live_mteb_package() -> list[dict] | None:
    try:
        import mteb
    except ImportError:
        return None

    task_map = {"Retrieval": "retrieval", "Clustering": "clustering", "Classification": "classification"}
    try:
        tasks = mteb.get_tasks(languages=["deu"], script=["Latin"])
        results = mteb.load_results()
        rows: dict[str, dict] = {}
        for model_result in results:
            mid = model_result.model_name
            if is_excluded(mid):
                continue
            if mid not in rows:
                rows[mid] = {
                    "model_id": mid,
                    "tasks": {"retrieval": None, "clustering": None, "classification": None, "sts": None},
                    "scores": [],
                    "params_m": None,
                    "license": None,
                    "updated": None,
                }
            for task_result in model_result.task_results:
                ttype = None
                for tr in tasks:
                    if tr.metadata.name == task_result.task_name:
                        ttype = tr.metadata.type
                        break
                key = task_map.get(ttype or "")
                if not key:
                    continue
                main = task_result.scores.get("test", [{}])
                if main and isinstance(main, list) and main[0]:
                    score = main[0].get("main_score")
                    if score is not None:
                        val = round(float(score) * 100, 2) if score <= 1 else round(float(score), 2)
                        rows[mid]["tasks"][key] = val
                        rows[mid]["scores"].append(val)

        models = []
        for row in rows.values():
            if not row["scores"]:
                continue
            row["avg_score"] = round(sum(row["scores"]) / len(row["scores"]), 2)
            del row["scores"]
            models.append(row)
        models.sort(key=lambda m: m["avg_score"], reverse=True)
        return models[:20] if len(models) >= 5 else None
    except Exception as exc:
        print(f"[WARN] mteb package fetch failed: {exc}", file=sys.stderr)
        return None


def fetch_live_hf() -> list[dict]:
    resp = requests.get(HF_RESULTS_URL, timeout=90)
    resp.raise_for_status()
    models = parse_hf_leaderboard(resp.json())
    if len(models) < 5:
        raise RuntimeError(f"Too few models parsed from HF leaderboard ({len(models)})")
    return models


def fetch_live() -> list[dict]:
    models = fetch_live_mteb_package()
    if models:
        return models
    return fetch_live_hf()


def build_payload(models: list[dict], source: str) -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source": source,
        "source_url": SOURCE_URL,
        "benchmark": "MTEB RTEB (deu) reference",
        "models": models,
        "picker_rules": PICKER_RULES,
    }


def validate_payload(payload: dict) -> None:
    schema = json.loads(SCHEMA_FILE.read_text(encoding="utf-8"))
    jsonschema.validate(payload, schema)
    for model in payload["models"]:
        if is_excluded(model["model_id"]):
            raise jsonschema.ValidationError(f"Excluded thesis model in output: {model['model_id']}")


def write_outputs(payload: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": payload["generated_at"],
        "sources": [payload["source"]],
        "source_urls": [payload.get("source_url", SOURCE_URL)],
        "files": ["mteb_de_leaderboard.json"],
        "changelog": [{"generated_at": payload["generated_at"], "source": payload["source"]}],
    }
    if MANIFEST_FILE.exists():
        try:
            prev = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
            manifest["changelog"] = manifest["changelog"] + prev.get("changelog", [])[:4]
        except json.JSONDecodeError:
            pass
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch MTEB DE leaderboard JSON")
    parser.add_argument("--seed-only", action="store_true", help="Write curated seed snapshot only")
    args = parser.parse_args()

    if args.seed_only:
        payload = build_payload(load_seed_models(), "seed/curated")
        validate_payload(payload)
        write_outputs(payload)
        print(f"[OK] Wrote seed snapshot to {OUT_FILE}")
        return 0

    try:
        models = fetch_live()
        source = "mteb/huggingface-leaderboard"
        print(f"[OK] Fetched {len(models)} models from live sources")
    except Exception as exc:
        print(f"[ERROR] Live fetch failed: {exc}", file=sys.stderr)
        if OUT_FILE.exists():
            print("[WARN] Keeping existing committed JSON (no overwrite)")
            return 1
        print("[WARN] Bootstrapping from seed (first run)")
        models = load_seed_models()
        source = "seed/curated (bootstrap)"

    payload = build_payload(models, source)
    validate_payload(payload)
    write_outputs(payload)
    print(f"[OK] Wrote {OUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
