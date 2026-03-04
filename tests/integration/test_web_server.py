from __future__ import annotations

import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from src.web.weather_page_server import make_handler


def _serve_once(handler_cls):
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_cls)
    host, port = server.server_address
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server, t, f"http://{host}:{port}"


def test_server_api_root_and_asset(monkeypatch):
    sample_payload = {
        "schema_version": "weather_payload_v1",
        "generated_at_utc": "2026-03-03T23:00:00Z",
        "source": "Open-Meteo",
        "model": "ecmwf_ifs025",
        "forecast_days": 15,
        "units": {},
        "cache": {},
        "resorts_count": 1,
        "failed_count": 0,
        "failed": [],
        "reports": [{"query": "A", "daily": []}],
    }
    monkeypatch.setattr("src.web.weather_page_server.load_payload", lambda **kwargs: sample_payload)
    monkeypatch.setattr("src.web.weather_page_server.render_payload_html", lambda payload: "<html>ok</html>")
    monkeypatch.setattr("src.web.weather_page_server.read_asset_bytes", lambda name: b"body{}")

    handler = make_handler(
        cache_file=".cache/x.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=2,
    )
    server, thread, base = _serve_once(handler)
    try:
        api_body = urllib.request.urlopen(f"{base}/api/data", timeout=3).read().decode("utf-8")
        payload = json.loads(api_body)
        assert payload["schema_version"] == "weather_payload_v1"
        assert payload["reports"][0]["query"] == "A"

        root = urllib.request.urlopen(f"{base}/", timeout=3).read().decode("utf-8")
        assert root == "<html>ok</html>"

        asset = urllib.request.urlopen(f"{base}/assets/css/weather_page.css", timeout=3).read()
        assert asset == b"body{}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_server_asset_not_found(monkeypatch):
    monkeypatch.setattr("src.web.weather_page_server.load_payload", lambda **kwargs: {"reports": []})
    monkeypatch.setattr("src.web.weather_page_server.read_asset_bytes", lambda name: (_ for _ in ()).throw(OSError("x")))

    handler = make_handler(
        cache_file=".cache/x.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=2,
    )
    server, thread, base = _serve_once(handler)
    try:
        with pytest.raises(urllib.error.HTTPError) as exc:
            urllib.request.urlopen(f"{base}/assets/css/weather_page.css", timeout=3)
        assert exc.value.code == 404
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_server_query_resort_pass_through(monkeypatch):
    captured = {}

    def fake_load_payload(**kwargs):  # noqa: ANN001
        captured.update(kwargs)
        return {
            "schema_version": "weather_payload_v1",
            "generated_at_utc": "2026-03-03T23:00:00Z",
            "source": "Open-Meteo",
            "model": "ecmwf_ifs025",
            "forecast_days": 15,
            "units": {},
            "cache": {},
            "resorts_count": 0,
            "failed_count": 0,
            "failed": [],
            "reports": [],
        }

    monkeypatch.setattr("src.web.weather_page_server.load_payload", fake_load_payload)
    monkeypatch.setattr("src.web.weather_page_server.render_payload_html", lambda payload: "<html>ok</html>")

    handler = make_handler(
        cache_file=".cache/x.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=2,
    )
    server, thread, base = _serve_once(handler)
    try:
        urllib.request.urlopen(f"{base}/api/data?resort=A&resort=B", timeout=3).read()
        assert captured["mode"] == "local"
        assert captured["resorts"] == ["A", "B"]
        assert captured["source"] == ""
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_server_api_mode_loads_remote_payload(monkeypatch):
    calls = {}

    def fake_load_payload(mode, source, timeout=20, **kwargs):  # noqa: ANN001
        calls["mode"] = mode
        calls["source"] = source
        calls["timeout"] = timeout
        calls["kwargs"] = kwargs
        return {
            "schema_version": "weather_payload_v1",
            "generated_at_utc": "2026-03-03T23:00:00Z",
            "source": "Open-Meteo",
            "model": "ecmwf_ifs025",
            "forecast_days": 15,
            "units": {},
            "cache": {},
            "resorts_count": 0,
            "failed_count": 0,
            "failed": [],
            "reports": [],
        }

    monkeypatch.setattr("src.web.weather_page_server.load_payload", fake_load_payload)
    monkeypatch.setattr("src.web.weather_page_server.render_payload_html", lambda payload: "<html>ok</html>")

    handler = make_handler(
        cache_file=".cache/x.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=2,
        data_mode="api",
        data_source="http://127.0.0.1:8020/api/data",
        data_timeout=11,
    )
    server, thread, base = _serve_once(handler)
    try:
        urllib.request.urlopen(
            f"{base}/api/data?resort=A&resort=B&pass_type=ikon&region=west&country=US&search=snow&include_all=1",
            timeout=3,
        ).read()
        assert calls["mode"] == "api"
        assert "resort=A" in calls["source"]
        assert "resort=B" in calls["source"]
        assert "pass_type=ikon" in calls["source"]
        assert "region=west" in calls["source"]
        assert "country=US" in calls["source"]
        assert "search=snow" in calls["source"]
        assert "include_all=1" in calls["source"]
        assert calls["timeout"] == 11
        assert calls["kwargs"]["resorts"] == ["A", "B"]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_server_local_mode_uses_backend_selection_for_filter_queries(monkeypatch):
    captured = {}

    monkeypatch.setattr(
        "src.web.weather_page_server.select_resorts_from_query",
        lambda qs: (
            ["Snowbird, UT"],
            "",
            {"pass_type": ["ikon"], "region": "west", "country": "US", "search": "snow", "include_all": False},
            {"pass_type": {"ikon": 1}, "region": {"west": 1}, "country": {"US": 1}},
            False,
        ),
    )

    def fake_run_live_payload(**kwargs):  # noqa: ANN001
        captured.update(kwargs)
        return {
            "schema_version": "weather_payload_v1",
            "generated_at_utc": "2026-03-03T23:00:00Z",
            "source": "Open-Meteo",
            "model": "ecmwf_ifs025",
            "forecast_days": 15,
            "units": {},
            "cache": {},
            "resorts_count": 1,
            "failed_count": 0,
            "failed": [],
            "reports": [{"query": "Snowbird, UT", "daily": []}],
        }

    monkeypatch.setattr("src.web.weather_page_server.run_live_payload", fake_run_live_payload)
    monkeypatch.setattr("src.web.weather_page_server.render_payload_html", lambda payload: "<html>ok</html>")

    handler = make_handler(
        cache_file=".cache/x.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=2,
    )
    server, thread, base = _serve_once(handler)
    try:
        body = urllib.request.urlopen(f"{base}/api/data?pass_type=ikon&region=west&country=US&search=snow", timeout=3)
        payload = json.loads(body.read().decode("utf-8"))
        assert captured["resorts"] == ["Snowbird, UT"]
        assert payload["available_filters"]["pass_type"]["ikon"] == 1
        assert payload["applied_filters"]["pass_type"] == ["ikon"]
        assert payload["applied_filters"]["search"] == "snow"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_server_health_endpoint(monkeypatch):
    monkeypatch.setattr("src.web.weather_page_server.load_payload", lambda **kwargs: {"reports": []})
    handler = make_handler(
        cache_file=".cache/x.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=2,
    )
    server, thread, base = _serve_once(handler)
    try:
        health = json.loads(urllib.request.urlopen(f"{base}/api/health", timeout=3).read().decode("utf-8"))
        assert health["ok"] is True
        assert health["mode"] == "local"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_server_requires_data_source_for_api_mode():
    with pytest.raises(ValueError, match="--data-source is required"):
        make_handler(
            cache_file=".cache/x.json",
            geocode_cache_hours=720,
            forecast_cache_hours=3,
            max_workers=2,
            data_mode="api",
            data_source="",
        )


def test_server_hourly_api_and_hourly_page_route(monkeypatch):
    monkeypatch.setattr("src.web.weather_page_server.load_payload", lambda **kwargs: {"reports": []})
    monkeypatch.setattr(
        "src.web.weather_page_server._hourly_payload_for_resort",
        lambda **kwargs: {
            "resort_id": kwargs["resort_id"],
            "query": "Snowbird, UT",
            "timezone": "America/Denver",
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

    handler = make_handler(
        cache_file=".cache/x.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=2,
    )
    server, thread, base = _serve_once(handler)
    try:
        hourly = json.loads(
            urllib.request.urlopen(f"{base}/api/resort-hourly?resort_id=snowbird-ut&hours=2", timeout=3)
            .read()
            .decode("utf-8")
        )
        assert hourly["resort_id"] == "snowbird-ut"
        assert len(hourly["hourly"]["time"]) == 2

        page = urllib.request.urlopen(f"{base}/resort/snowbird-ut", timeout=3).read().decode("utf-8")
        assert "Hourly Forecast" in page
        assert "snowbird-ut" in page
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)
