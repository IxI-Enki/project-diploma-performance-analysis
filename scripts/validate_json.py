#!/usr/bin/env python3
"""Validate JSON data files against schemas."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / "data" / "schemas"


def main() -> int:
    checks = [
        (ROOT / "data" / "mteb_de_leaderboard.json", ROOT / "data" / "schema_mteb_de.json"),
        (ROOT / "data" / "manifest.json", None),
    ]
    ok = True
    for path, schema_path in checks:
        if not path.exists():
            print(f"[ERROR] Missing {path}", file=sys.stderr)
            ok = False
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if schema_path:
            schema = json.loads(schema_path.read_text(encoding="utf-8"))
            jsonschema.validate(data, schema)
            print(f"[OK] {path.name} valid")
        else:
            if "generated_at" not in data:
                print(f"[ERROR] {path.name} missing generated_at", file=sys.stderr)
                ok = False
            else:
                print(f"[OK] {path.name} present")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
