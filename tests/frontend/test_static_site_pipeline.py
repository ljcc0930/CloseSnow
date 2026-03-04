from __future__ import annotations

import json

from src.web.pipelines.static_site import render_hourly_pages, render_html, write_payload_json


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


def test_render_hourly_pages(tmp_path):
    p = tmp_path / "site" / "index.html"
    payload = {
        "reports": [
            {"resort_id": "snowbird-ut"},
            {"resort_id": "snowbird-ut"},
            {"resort_id": "alta-ut"},
        ]
    }
    outputs = render_hourly_pages(str(p), payload)
    assert [x.relative_to(tmp_path / "site").as_posix() for x in outputs] == [
        "resort/snowbird-ut/index.html",
        "resort/alta-ut/index.html",
    ]
    html = outputs[0].read_text(encoding="utf-8")
    assert "../../assets/css/resort_hourly.css" in html
    assert 'window.CLOSESNOW_HOURLY_CONTEXT = {' in html
    assert '"resortId": "snowbird-ut"' in html
    assert 'id="hourly-charts"' in html


def test_render_hourly_pages_with_static_hourly_data(tmp_path, monkeypatch):
    p = tmp_path / "site" / "index.html"
    payload = {"reports": [{"resort_id": "snowbird-ut"}]}

    monkeypatch.setattr(
        "src.web.pipelines.static_site._build_hourly_payload",
        lambda **kwargs: {
            "resort_id": kwargs["resort_id"],
            "query": "Snowbird, UT",
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
        },
    )

    outputs = render_hourly_pages(
        str(p),
        payload,
        include_hourly_data=True,
        cache_file=".cache/x.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
    )
    assert len(outputs) == 1
    hourly_json = tmp_path / "site" / "resort" / "snowbird-ut" / "hourly.json"
    assert hourly_json.exists()
    html = outputs[0].read_text(encoding="utf-8")
    assert '"hourlyDataUrl": "./hourly.json"' in html
