from __future__ import annotations

import json

from src.backend.pipelines.live_pipeline import run_live_payload
from src.backend.pipelines.static_pipeline import fetch_static_payload
from src.backend.services.weather_service import build_weather_payload
from src.web.pipelines.static_site import render_html, write_payload_json


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
        resorts_file="resorts.txt",
        cache_file=".cache/a.json",
        geocode_cache_hours=100,
        forecast_cache_hours=2,
        max_workers=4,
    )
    assert out == {"ok": True}
    assert captured["resorts"] == ["A"]
    assert captured["resorts_file"] == "resorts.txt"
    assert captured["max_workers"] == 4


def test_run_live_payload_calls_build_weather_payload(monkeypatch):
    monkeypatch.setattr(
        "src.backend.pipelines.live_pipeline.build_weather_payload",
        lambda **kwargs: {"called": kwargs},
    )
    out = run_live_payload(resorts=["A"], resorts_file="x")
    assert out["called"]["resorts"] == ["A"]
    assert out["called"]["resorts_file"] == "x"


def test_fetch_static_payload_delegates_to_live_pipeline(monkeypatch):
    monkeypatch.setattr(
        "src.backend.pipelines.static_pipeline.run_live_payload",
        lambda **kwargs: {"called": kwargs},
    )
    out = fetch_static_payload(resorts=["A"], resorts_file="r.txt")
    assert out["called"]["resorts"] == ["A"]
    assert out["called"]["resorts_file"] == "r.txt"


def test_write_payload_json(tmp_path):
    p = tmp_path / "site" / "data.json"
    out = write_payload_json(str(p), {"a": 1})
    assert out == p
    assert json.loads(p.read_text(encoding="utf-8")) == {"a": 1}


def test_render_html(tmp_path, monkeypatch):
    p = tmp_path / "site" / "index.html"
    monkeypatch.setattr("src.web.pipelines.static_site.render_payload_html", lambda payload: "<html>x</html>")
    out = render_html(str(p), {"a": 1})
    assert out == p
    assert p.read_text(encoding="utf-8") == "<html>x</html>"
