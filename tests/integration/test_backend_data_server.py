from __future__ import annotations

import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from src.backend.weather_data_server import make_handler


def _serve_once(handler_cls):
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_cls)
    host, port = server.server_address
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server, t, f"http://{host}:{port}"


def test_backend_data_server_api_and_health(monkeypatch, valid_payload):
    monkeypatch.setattr("src.backend.weather_data_server.run_live_payload", lambda **kwargs: valid_payload)
    monkeypatch.setattr(
        "src.backend.weather_data_server.load_resort_catalog",
        lambda path: [
            {
                "resort_id": "snowbird-ut",
                "query": "Snowbird, UT",
                "name": "Snowbird",
                "state": "UT",
                "country": "US",
                "region": "west",
                "pass_types": ["ikon"],
            },
            {
                "resort_id": "mt-brighton-mi",
                "query": "Mt Brighton, MI",
                "name": "Mt Brighton",
                "state": "MI",
                "country": "US",
                "region": "east",
                "pass_types": ["epic"],
            },
        ],
    )
    handler = make_handler(
        cache_file=".cache/x.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=2,
    )
    server, thread, base = _serve_once(handler)
    try:
        payload = json.loads(urllib.request.urlopen(f"{base}/api/data", timeout=3).read().decode("utf-8"))
        health = json.loads(urllib.request.urlopen(f"{base}/api/health", timeout=3).read().decode("utf-8"))
        resorts = json.loads(urllib.request.urlopen(f"{base}/api/resorts?search=ikon", timeout=3).read().decode("utf-8"))
        assert payload["schema_version"] == valid_payload["schema_version"]
        assert payload["available_filters"]["pass_type"]["ikon"] == 1
        assert payload["applied_filters"]["pass_type"] == []
        assert payload["applied_filters"]["include_all"] is False
        assert health["ok"] is True
        assert health["service"] == "closesnow-backend-data"
        assert resorts["count"] == 1
        assert resorts["items"][0]["resort_id"] == "snowbird-ut"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_backend_data_server_data_filters(monkeypatch, valid_payload):
    captured = {}

    def fake_run_live_payload(**kwargs):  # noqa: ANN001
        captured.update(kwargs)
        return valid_payload

    monkeypatch.setattr("src.backend.weather_data_server.run_live_payload", fake_run_live_payload)
    monkeypatch.setattr(
        "src.backend.weather_data_server.load_resort_catalog",
        lambda path: [
            {
                "resort_id": "snowbird-ut",
                "query": "Snowbird, UT",
                "name": "Snowbird",
                "state": "UT",
                "country": "US",
                "region": "west",
                "pass_types": ["ikon"],
            },
            {
                "resort_id": "mt-brighton-mi",
                "query": "Mt Brighton, MI",
                "name": "Mt Brighton",
                "state": "MI",
                "country": "US",
                "region": "east",
                "pass_types": ["epic"],
            },
        ],
    )

    handler = make_handler(
        cache_file=".cache/x.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=2,
    )
    server, thread, base = _serve_once(handler)
    try:
        payload = json.loads(
            urllib.request.urlopen(f"{base}/api/data?pass_type=epic&region=east&country=US", timeout=3)
            .read()
            .decode("utf-8")
        )
        assert captured["resorts"] == ["Mt Brighton, MI"]
        assert captured["resorts_file"] == ""
        assert payload["applied_filters"]["pass_type"] == ["epic"]
        assert payload["applied_filters"]["region"] == "east"
        assert payload["applied_filters"]["country"] == "US"
        assert payload["applied_filters"]["include_all"] is False
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_backend_data_server_data_include_all(monkeypatch, valid_payload):
    captured = {}

    def fake_run_live_payload(**kwargs):  # noqa: ANN001
        captured.update(kwargs)
        return valid_payload

    monkeypatch.setattr("src.backend.weather_data_server.run_live_payload", fake_run_live_payload)
    monkeypatch.setattr(
        "src.backend.weather_data_server.load_resort_catalog",
        lambda path: [
            {
                "resort_id": "snowbird-ut",
                "query": "Snowbird, UT",
                "name": "Snowbird",
                "state": "UT",
                "country": "US",
                "region": "west",
                "pass_types": ["ikon"],
            },
            {
                "resort_id": "mt-brighton-mi",
                "query": "Mt Brighton, MI",
                "name": "Mt Brighton",
                "state": "MI",
                "country": "US",
                "region": "east",
                "pass_types": ["epic"],
            },
        ],
    )

    handler = make_handler(
        cache_file=".cache/x.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=2,
    )
    server, thread, base = _serve_once(handler)
    try:
        payload = json.loads(urllib.request.urlopen(f"{base}/api/data?include_all=1", timeout=3).read().decode("utf-8"))
        assert captured["resorts"] == ["Snowbird, UT", "Mt Brighton, MI"]
        assert captured["resorts_file"] == ""
        assert payload["applied_filters"]["include_all"] is True
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_backend_data_server_hourly_endpoint(monkeypatch):
    monkeypatch.setattr("src.backend.weather_data_server.run_live_payload", lambda **kwargs: {"reports": []})

    def fake_hourly(**kwargs):  # noqa: ANN001
        if kwargs["resort_id"] == "unknown":
            return None
        return {
            "resort_id": kwargs["resort_id"],
            "query": "Snowbird, UT",
            "timezone": "America/Denver",
            "model": "ecmwf_ifs025",
            "hours": 3,
            "hourly": {
                "time": ["2026-03-04T00:00", "2026-03-04T01:00", "2026-03-04T02:00"],
                "snowfall": [0.0, 0.2, 0.0],
                "rain": [0.0, 0.0, 0.0],
                "precipitation_probability": [10, 30, 20],
                "snow_depth": [120, 121, 121],
                "wind_speed_10m": [5.0, 6.0, 5.5],
                "wind_direction_10m": [120, 130, 110],
                "visibility": [9000, 8500, 8000],
            },
        }

    monkeypatch.setattr("src.backend.weather_data_server._hourly_payload_for_resort", fake_hourly)
    handler = make_handler(
        cache_file=".cache/x.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=2,
    )
    server, thread, base = _serve_once(handler)
    try:
        hourly = json.loads(
            urllib.request.urlopen(f"{base}/api/resort-hourly?resort_id=snowbird-ut&hours=3", timeout=3)
            .read()
            .decode("utf-8")
        )
        assert hourly["resort_id"] == "snowbird-ut"
        assert len(hourly["hourly"]["time"]) == 3
        assert "visibility" in hourly["hourly"]

        with pytest.raises(urllib.error.HTTPError) as exc:
            urllib.request.urlopen(f"{base}/api/resort-hourly?resort_id=unknown", timeout=3)
        assert exc.value.code == 404
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_backend_data_server_cors_and_404(monkeypatch):
    monkeypatch.setattr(
        "src.backend.weather_data_server.run_live_payload",
        lambda **kwargs: {"schema_version": "weather_payload_v1", "reports": [], "failed": []},
    )
    handler = make_handler(
        cache_file=".cache/x.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=2,
        allow_origin="https://example.test",
    )
    server, thread, base = _serve_once(handler)
    try:
        with urllib.request.urlopen(f"{base}/api/data", timeout=3) as resp:
            assert resp.getheader("Access-Control-Allow-Origin") == "https://example.test"
        try:
            urllib.request.urlopen(f"{base}/nope", timeout=3)
            assert False, "expected HTTPError for unknown path"
        except urllib.error.HTTPError as exc:
            assert exc.code == 404
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)
