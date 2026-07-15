from __future__ import annotations

import argparse
import json
from pathlib import Path

import pytest
from src import cli


@pytest.mark.smoke
def test_static_split_pipeline_smoke(monkeypatch, tmp_path, valid_payload):
    valid_payload["reports"][0]["resort_id"] = "snowbird-ut"
    fetch_args = argparse.Namespace(
        resort=[],
        resorts_file="resorts.yml",
        include_all_resorts=False,
        cache_file=".cache/open_meteo_cache.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=4,
        api_retries=2,
        output_json=str(tmp_path / "data.json"),
    )
    hourly_payload = {
        "resort_id": "snowbird-ut",
        "hours": 2,
        "hourly": {
            "time": ["2026-03-04T00:00", "2026-03-04T01:00"],
            "snowfall": [0.0, 0.1],
            "rain": [0.0, 0.0],
            "precipitation_probability": [20, 10],
            "snow_depth": [100, 100],
            "wind_speed_10m": [5.0, 6.0],
            "wind_direction_10m": [120, 110],
            "visibility": [9000, 8800],
        },
    }
    monkeypatch.setattr(
        "src.web.static_site_builder.build_weather_payload_for_request",
        lambda request: valid_payload,
    )
    monkeypatch.setattr(
        "src.web.static_site_builder.build_hourly_payloads_for_resorts",
        lambda **kwargs: {"snowbird-ut": hourly_payload},
    )

    assert cli.run_fetch(fetch_args) == 0
    assert Path(fetch_args.output_json).exists()
    bundle_hourly = tmp_path / "resort" / "snowbird-ut" / "hourly.json"
    assert json.loads(bundle_hourly.read_text(encoding="utf-8")) == hourly_payload

    def fail_if_render_fetches(*args, **kwargs):  # noqa: ANN002, ANN003
        raise AssertionError("render attempted backend or network access")

    monkeypatch.setattr(
        "src.web.static_site_builder.build_weather_payload_for_request",
        fail_if_render_fetches,
    )
    monkeypatch.setattr(
        "src.web.static_site_builder.build_hourly_payloads_for_resorts",
        fail_if_render_fetches,
    )

    render_args = argparse.Namespace(
        input_json=fetch_args.output_json,
        output_dir=str(tmp_path),
    )
    assert cli.run_render(render_args) == 0

    html = Path(render_args.output_dir, "index.html").read_text(encoding="utf-8")
    assert "<!doctype html>" in html
    assert "CloseSnow Mountain Morning Report" in html
    assert "Compare mountain conditions" in html
    assert "Make the call before first chair." not in html
    assert 'src="assets/js/field_guide_homepage.js"' in html
    assert "window.CLOSESNOW_INITIAL_PAYLOAD = {" in html
    assert "Snowbird, Utah" in html
    assert 'id="page-content-root"' in html
    assert "window.CLOSESNOW_PAGE_BOOTSTRAP" in html
    assert '"dataUrl": "./data.json"' in html
    resort_html = Path(render_args.output_dir, "resort", "snowbird-ut", "index.html").read_text(encoding="utf-8")
    assert '"hourlyDataUrl": "./hourly.json"' in resort_html
