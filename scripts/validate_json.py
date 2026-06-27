#!/usr/bin/env python3
"""Validate JSON data files against schemas."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "data" / "schema_mteb_de.json"
LEADERBOARD_PATH = ROOT / "data" / "mteb_de_leaderboard.json"
MANIFEST_PATH = ROOT / "data" / "manifest.json"

EXCLUDED_PREFIXES = ("Octen/",)
MIN_AVG_SCORE_COVERAGE = 0.95


def main() -> int:
    ok = True

    if not LEADERBOARD_PATH.exists():
        print(f"[ERROR] Missing {LEADERBOARD_PATH}", file=sys.stderr)
        return 1

    if not SCHEMA_PATH.exists():
        print(f"[ERROR] Missing schema {SCHEMA_PATH}", file=sys.stderr)
        return 1

    data = json.loads(LEADERBOARD_PATH.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    jsonschema.validate(data, schema)
    print(f"[OK] {LEADERBOARD_PATH.name} valid against schema_mteb_de.json")

    models = data.get("models", [])
    for model in models:
        mid = model.get("model_id", "")
        if mid.startswith(EXCLUDED_PREFIXES):
            print(f"[ERROR] Excluded model in output: {mid}", file=sys.stderr)
            ok = False

    if models:
        with_score = sum(1 for m in models if isinstance(m.get("avg_score"), (int, float)))
        ratio = with_score / len(models)
        if ratio < MIN_AVG_SCORE_COVERAGE:
            print(
                f"[ERROR] Only {ratio:.1%} models have avg_score (need >= {MIN_AVG_SCORE_COVERAGE:.0%})",
                file=sys.stderr,
            )
            ok = False
        else:
            print(f"[OK] avg_score coverage {ratio:.1%}")

    if not MANIFEST_PATH.exists():
        print(f"[ERROR] Missing {MANIFEST_PATH}", file=sys.stderr)
        ok = False
    else:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        if "generated_at" not in manifest:
            print(f"[ERROR] manifest.json missing generated_at", file=sys.stderr)
            ok = False
        else:
            print(f"[OK] manifest.json present")

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
