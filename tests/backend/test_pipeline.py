from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

from src.backend import pipeline


class _DummyJsonCache:
    def __init__(self, path):  # noqa: ANN001
        self.path = path
        self.hits = 2
        self.misses = 1
        self.saved = False

    def save(self):
        self.saved = True


class _DummyCoordCache:
    def __init__(self, path):  # noqa: ANN001
        self.path = path
        self.saved = False
        self.set_calls = []

    def set(self, key, value):  # noqa: ANN001
        self.set_calls.append((key, value))

    def save(self):
        self.saved = True


def test_read_resorts_ignores_comments_and_blanks(tmp_path):
    p = tmp_path / "plain_resorts.txt"
    p.write_text("Snowbird, UT\n# comment\n\nSnowbasin, UT\n", encoding="utf-8")
    assert pipeline.read_resorts(str(p)) == ["Snowbird, UT", "Snowbasin, UT"]


def test_read_resorts_from_yml_catalog(tmp_path):
    p = tmp_path / "resorts.yml"
    p.write_text(
        '[{"resort_id":"snowbird-ut","query":"Snowbird, UT"},{"resort_id":"solitude-ut","query":"Solitude, UT"}]',
        encoding="utf-8",
    )
    assert pipeline.read_resorts(str(p)) == ["Snowbird, UT", "Solitude, UT"]


def test_read_resorts_from_yml_catalog_include_all(tmp_path):
    p = tmp_path / "resorts.yml"
    p.write_text(
        (
            '[{"resort_id":"snowbird-ut","query":"Snowbird, UT","default_enabled":true},'
            '{"resort_id":"alta-ut","query":"Alta Ski Area, UT","default_enabled":false}]'
        ),
        encoding="utf-8",
    )
    assert pipeline.read_resorts(str(p)) == ["Snowbird, UT"]
    assert pipeline.read_resorts(str(p), include_all=True) == ["Snowbird, UT", "Alta Ski Area, UT"]


def test_seed_coordinate_cache_from_unified(tmp_path):
    cache = _DummyCoordCache("x")
    payload = {
        "reports": [
            {
                "query": "A",
                "matched_name": "AA",
                "input_latitude": 1.1,
                "input_longitude": 2.2,
                "country": "US",
                "admin1": "X",
            },
            {
                "query": "B",
                "name": "BB",
                "latitude": 3.3,
                "longitude": 4.4,
            },
            {"query": "", "latitude": 1, "longitude": 2},
            {"query": "C", "latitude": "bad", "longitude": 2},
        ]
    }
    f = tmp_path / "payload.json"
    f.write_text(json.dumps(payload), encoding="utf-8")
    pipeline.seed_coordinate_cache_from_unified(cache, str(f))
    assert len(cache.set_calls) == 2
    assert cache.set_calls[0][0] == "A"
    assert cache.set_calls[1][0] == "B"
    assert cache.set_calls[1][1]["name"] == "BB"


def test_seed_coordinate_cache_from_unified_handles_missing_or_bad_file(tmp_path):
    cache = _DummyCoordCache("x")
    pipeline.seed_coordinate_cache_from_unified(cache, str(tmp_path / "missing.json"))
    assert cache.set_calls == []

    broken = tmp_path / "broken.json"
    broken.write_text("{oops", encoding="utf-8")
    pipeline.seed_coordinate_cache_from_unified(cache, str(broken))
    assert cache.set_calls == []


def _patch_pipeline_primitives(monkeypatch, tmp_path):
    monkeypatch.setattr("src.backend.pipeline.dated_cache_path", lambda path: str(tmp_path / "dated_cache.json"))
    monkeypatch.setattr("src.backend.pipeline.JsonCache", _DummyJsonCache)
    monkeypatch.setattr("src.backend.pipeline.ResortCoordinateCache", _DummyCoordCache)
    seed_calls = []
    monkeypatch.setattr(
        "src.backend.pipeline.seed_coordinate_cache_from_unified",
        lambda cache, path: seed_calls.append(path),
    )
    return seed_calls


def test_run_pipeline_builds_contract_and_dedupes(monkeypatch, tmp_path):
    seed_calls = _patch_pipeline_primitives(monkeypatch, tmp_path)
    captured = {}
    monkeypatch.setattr(
        "src.backend.pipeline.load_resort_catalog",
        lambda path: [
            {
                "resort_id": "a-id",
                "query": "A",
                "display_name": "Alpha Resort",
                "region": "west",
                "country": "US",
                "pass_types": ["ikon"],
                "state": "UT",
                "default_enabled": True,
            }
        ],
    )

    async def fake_run_pipeline_async(**kwargs):  # noqa: ANN001
        captured["selected"] = deepcopy(kwargs["selected"])
        return {
            "reports": [
                {
                    "query": "A",
                    "country": "United States",
                    "resolved_latitude": 40.58,
                    "resolved_longitude": -111.65,
                    "week1_total_snowfall_cm": 6.0,
                    "daily": [
                        {"snowfall_cm": 1.0},
                        {"snowfall_cm": 2.0},
                        {"snowfall_cm": 3.0},
                    ],
                }
            ],
            "failed": [{"query": "B", "reason": "boom"}],
        }

    validate_calls = {}
    monkeypatch.setattr("src.backend.pipeline._run_pipeline_async", fake_run_pipeline_async)
    monkeypatch.setattr(
        "src.backend.pipeline.validate_weather_payload_v1",
        lambda payload: validate_calls.setdefault("payload", payload),
    )

    out = pipeline.run_pipeline(
        resorts=["A", "A", " ", "B"],
        resorts_file="",
        use_default_resorts=False,
        write_outputs=False,
        max_workers=3,
    )
    assert captured["selected"] == ["A", "B"]
    assert out["schema_version"] == pipeline.SCHEMA_VERSION
    assert out["generated_at_utc"].endswith("Z")
    assert out["resorts_count"] == 1
    assert out["failed_count"] == 1
    assert out["cache"]["file"].endswith("dated_cache.json")
    assert validate_calls["payload"]["schema_version"] == pipeline.SCHEMA_VERSION
    assert out["reports"][0]["resort_id"] == "a-id"
    assert out["reports"][0]["pass_types"] == ["ikon"]
    assert out["reports"][0]["region"] == "west"
    assert out["reports"][0]["country_code"] == "US"
    assert out["reports"][0]["map_context"] == {
        "eligible": True,
        "latitude": 40.58,
        "longitude": -111.65,
        "today_snowfall_cm": 1.0,
        "next_72h_snowfall_cm": 6.0,
        "week1_total_snowfall_cm": 6.0,
    }
    assert out["reports"][0]["ljcc_favorite"] is True
    assert out["reports"][0]["display_name"] == "Alpha Resort"
    assert ".cache/resorts_weather_unified.json" in seed_calls


def test_run_pipeline_writes_outputs_when_enabled(monkeypatch, tmp_path):
    _patch_pipeline_primitives(monkeypatch, tmp_path)

    async def fake_run_pipeline_async(**kwargs):  # noqa: ANN001
        return {"reports": [{"query": "A", "daily": []}], "failed": []}

    monkeypatch.setattr("src.backend.pipeline._run_pipeline_async", fake_run_pipeline_async)
    monkeypatch.setattr("src.backend.pipeline.validate_weather_payload_v1", lambda payload: None)
    calls = []
    monkeypatch.setattr(
        "src.backend.pipeline.export_payload_artifacts",
        lambda payload, output_json, snow_csv, rain_csv, temp_csv: calls.append(
            ("export", output_json, snow_csv, rain_csv, temp_csv)
        ),
    )

    pipeline.run_pipeline(
        resorts=["A"],
        resorts_file="",
        output_json="o.json",
        snow_csv="s.csv",
        rain_csv="r.csv",
        temp_csv="t.csv",
        write_outputs=True,
    )
    assert calls == [("export", "o.json", "s.csv", "r.csv", "t.csv")]


def test_run_pipeline_uses_default_resorts_when_empty(monkeypatch, tmp_path):
    _patch_pipeline_primitives(monkeypatch, tmp_path)
    monkeypatch.setattr("src.backend.pipeline.DEFAULT_RESORTS", ["D1", "D1", "D2"])
    captured = {}

    async def fake_run_pipeline_async(**kwargs):  # noqa: ANN001
        captured["selected"] = kwargs["selected"]
        return {"reports": [], "failed": []}

    monkeypatch.setattr("src.backend.pipeline._run_pipeline_async", fake_run_pipeline_async)
    monkeypatch.setattr("src.backend.pipeline.validate_weather_payload_v1", lambda payload: None)

    pipeline.run_pipeline(resorts=[], resorts_file="", use_default_resorts=False, write_outputs=False)
    assert captured["selected"] == ["D1", "D2"]
