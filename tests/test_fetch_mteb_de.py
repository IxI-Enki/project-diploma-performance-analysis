"""Unit tests for scripts/fetch_mteb_de.py"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

import scripts.fetch_mteb_de as fetch

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"


@pytest.fixture
def tmp_data(tmp_path, monkeypatch):
    monkeypatch.setattr(fetch, "DATA_DIR", tmp_path)
    monkeypatch.setattr(fetch, "OUT_FILE", tmp_path / "mteb_de_leaderboard.json")
    monkeypatch.setattr(fetch, "MANIFEST_FILE", tmp_path / "manifest.json")
    monkeypatch.setattr(fetch, "SCHEMA_FILE", DATA_DIR / "schema_mteb_de.json")
    monkeypatch.setattr(fetch, "SEED_FILE", DATA_DIR / "mteb_de_seed.json")
    monkeypatch.setattr(fetch, "ASTRO_DATA_DIR", tmp_path / "astro_data")
    return tmp_path


def test_failsafe_preserves_previous_json_and_manifest(tmp_data):
    """SC-004: API failure keeps previous leaderboard and manifest generated_at."""
    prev_payload = {
        "schema_version": "2.0.0",
        "generated_at": "2026-01-01T00:00:00+00:00",
        "source": "mteb/backend-api",
        "models": [{"model_id": "test/model", "avg_score": 50.0, "tasks": {"retrieval": 50.0}}],
        "picker_rules": [],
    }
    prev_manifest = {"generated_at": "2026-01-01T00:00:00+00:00", "sources": ["mteb/backend-api"]}
    fetch.OUT_FILE.write_text(json.dumps(prev_payload), encoding="utf-8")
    fetch.MANIFEST_FILE.write_text(json.dumps(prev_manifest), encoding="utf-8")

    with patch.object(fetch, "fetch_live", side_effect=RuntimeError("API down")):
        rc = fetch.main([])

    assert rc == 1
    assert json.loads(fetch.OUT_FILE.read_text())["generated_at"] == "2026-01-01T00:00:00+00:00"
    assert json.loads(fetch.MANIFEST_FILE.read_text())["generated_at"] == "2026-01-01T00:00:00+00:00"


def test_mteb_backend_maps_task_scores():
    """Primary MTEB backend response maps retrieval/clustering/classification."""
    payload = [
        {
            "model_name": "intfloat/multilingual-e5-large",
            "Average": 56.8,
            "GermanRetrieval": 54.1,
            "GermanClustering": 45.8,
            "Classification": 71.9,
        }
    ]
    models = fetch.parse_mteb_backend(payload)
    assert len(models) == 1
    m = models[0]
    assert m["model_id"] == "intfloat/multilingual-e5-large"
    assert m["tasks"]["retrieval"] == 54.1
    assert m["tasks"]["clustering"] == 45.8
    assert m["tasks"]["classification"] == 71.9


def test_enrichment_sets_dim_and_price_sources():
    """HF Hub + LiteLLM enrichment sets dim_source and price_source enums."""
    model = {"model_id": "intfloat/multilingual-e5-base", "avg_score": 50.0, "tasks": {}}
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"hidden_size": 768}
    mock_session = MagicMock()
    mock_session.get.return_value = mock_resp

    fetch.enrich_hf_hub_dim(model, mock_session)
    assert model["embedding_dim"] == 768
    assert model["dim_source"] == "hf_hub"

    models = [model]
    with patch.object(fetch, "_load_litellm_prices", return_value={"intfloat/multilingual-e5-base": {"input_cost_per_token": 0.0000001}}):
        with patch.object(fetch, "_load_openrouter_prices", return_value={}):
            fetch.enrich_pricing(models, mock_session)
    assert model["price_source"] == "litellm"
    assert model["price_input_per_mtok"] is not None


def test_seed_bootstrap_sets_fallback_flag(tmp_data):
    """First-run seed bootstrap sets fallback: true in payload."""
    with patch.object(fetch, "fetch_live", side_effect=RuntimeError("no network")):
        rc = fetch.main([])

    assert rc == 0
    payload = json.loads(fetch.OUT_FILE.read_text())
    assert payload.get("fallback") is True
    assert payload["source"].startswith("seed/")
