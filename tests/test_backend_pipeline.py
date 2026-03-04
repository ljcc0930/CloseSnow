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
    p = tmp_path / "resorts.txt"
    p.write_text("Snowbird, UT\n# comment\n\nSnowbasin, UT\n", encoding="utf-8")
    assert pipeline.read_resorts(str(p)) == ["Snowbird, UT", "Snowbasin, UT"]


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

    async def fake_run_pipeline_async(**kwargs):  # noqa: ANN001
        captured["selected"] = deepcopy(kwargs["selected"])
        return {
            "reports": [{"query": "A", "daily": []}],
            "failed": [{"query": "B", "reason": "boom"}],
        }

    validate_calls = {}
    monkeypatch.setattr("src.backend.pipeline._run_pipeline_async", fake_run_pipeline_async)
    monkeypatch.setattr(
        "src.backend.pipeline.validate_weather_payload_v1",
        lambda payload: validate_calls.setdefault("payload", payload),
    )
    monkeypatch.setattr("src.backend.pipeline.write_unified_json", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError))
    monkeypatch.setattr("src.backend.pipeline.write_snow_csv", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError))
    monkeypatch.setattr("src.backend.pipeline.write_rain_csv", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError))
    monkeypatch.setattr("src.backend.pipeline.write_temp_csv", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError))

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
    assert ".cache/resorts_weather_unified.json" in seed_calls


def test_run_pipeline_writes_outputs_when_enabled(monkeypatch, tmp_path):
    _patch_pipeline_primitives(monkeypatch, tmp_path)

    async def fake_run_pipeline_async(**kwargs):  # noqa: ANN001
        return {"reports": [{"query": "A", "daily": []}], "failed": []}

    monkeypatch.setattr("src.backend.pipeline._run_pipeline_async", fake_run_pipeline_async)
    monkeypatch.setattr("src.backend.pipeline.validate_weather_payload_v1", lambda payload: None)
    calls = []
    monkeypatch.setattr("src.backend.pipeline.write_unified_json", lambda path, payload: calls.append(("json", path)))
    monkeypatch.setattr("src.backend.pipeline.write_snow_csv", lambda path, reports: calls.append(("snow", path)))
    monkeypatch.setattr("src.backend.pipeline.write_rain_csv", lambda path, reports: calls.append(("rain", path)))
    monkeypatch.setattr("src.backend.pipeline.write_temp_csv", lambda path, reports: calls.append(("temp", path)))

    pipeline.run_pipeline(
        resorts=["A"],
        resorts_file="",
        output_json="o.json",
        snow_csv="s.csv",
        rain_csv="r.csv",
        temp_csv="t.csv",
        write_outputs=True,
    )
    assert calls == [("json", "o.json"), ("snow", "s.csv"), ("rain", "r.csv"), ("temp", "t.csv")]


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

