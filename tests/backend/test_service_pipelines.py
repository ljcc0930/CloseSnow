from __future__ import annotations

from src.backend.pipelines.live_pipeline import run_live_payload
from src.backend.pipelines.static_pipeline import fetch_static_payload
from src.backend.services.weather_service import build_weather_payload


def test_build_weather_payload_calls_run_pipeline(monkeypatch):
    captured = {}

    def fake_compute_pipeline_payload(**kwargs):  # noqa: ANN001
        captured.update(kwargs)
        return {"ok": True}

    monkeypatch.setattr(
        "src.backend.services.weather_service.compute_pipeline_payload",
        fake_compute_pipeline_payload,
    )
    out = build_weather_payload(
        resorts=["A"],
        resorts_file="resorts.yml",
        include_all_resorts=True,
        cache_file=".cache/a.json",
        geocode_cache_hours=100,
        forecast_cache_hours=2,
        max_workers=4,
    )
    assert out == {"ok": True}
    assert captured["resorts"] == ["A"]
    assert captured["resorts_file"] == "resorts.yml"
    assert captured["include_all_resorts"] is True
    assert captured["max_workers"] == 4


def test_run_live_payload_calls_build_weather_payload(monkeypatch):
    monkeypatch.setattr(
        "src.backend.pipelines.live_pipeline.build_weather_payload",
        lambda **kwargs: {"called": kwargs},
    )
    out = run_live_payload(resorts=["A"], resorts_file="x", include_all_resorts=True)
    assert out["called"]["resorts"] == ["A"]
    assert out["called"]["resorts_file"] == "x"
    assert out["called"]["include_all_resorts"] is True


def test_fetch_static_payload_aliases_live_pipeline():
    assert fetch_static_payload is run_live_payload
