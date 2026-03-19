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
            {
                "resort_id": "powder-ridge-mn",
                "query": "Powder Ridge, MN",
                "name": "Powder Ridge",
                "state": "MN",
                "country": "US",
                "region": "east",
                "pass_types": ["indy"],
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
        assert payload["available_filters"]["pass_type"]["epic"] == 1
        assert "subregion" in payload["available_filters"]
        assert "indy" not in payload["available_filters"]["pass_type"]
        assert payload["applied_filters"]["pass_type"] == []
        assert payload["applied_filters"]["subregion"] == []
        assert payload["applied_filters"]["country"] == []
        assert payload["applied_filters"]["search_all"] is True
        assert payload["applied_filters"]["include_all"] is False
        assert health["ok"] is True
        assert health["service"] == "closesnow-backend-data"
        assert resorts["count"] == 1
        assert resorts["items"][0]["resort_id"] == "snowbird-ut"
        assert resorts["items"][0]["display_name"] == "Snowbird, UT"
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
            {
                "resort_id": "powder-ridge-mn",
                "query": "Powder Ridge, MN",
                "name": "Powder Ridge",
                "state": "MN",
                "country": "US",
                "region": "east",
                "pass_types": ["indy"],
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
        assert payload["applied_filters"]["country"] == ["US"]
        assert payload["applied_filters"]["search_all"] is True
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
            {
                "resort_id": "powder-ridge-mn",
                "query": "Powder Ridge, MN",
                "name": "Powder Ridge",
                "state": "MN",
                "country": "US",
                "region": "east",
                "pass_types": ["indy"],
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
        assert "Powder Ridge, MN" not in captured["resorts"]
        assert captured["resorts_file"] == ""
        assert payload["applied_filters"]["include_all"] is True
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_backend_data_server_data_include_default(monkeypatch, valid_payload):
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
                "default_enabled": True,
            },
            {
                "resort_id": "mt-brighton-mi",
                "query": "Mt Brighton, MI",
                "name": "Mt Brighton",
                "state": "MI",
                "country": "US",
                "region": "east",
                "pass_types": ["epic"],
                "default_enabled": False,
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
        payload = json.loads(urllib.request.urlopen(f"{base}/api/data?include_default=1", timeout=3).read().decode("utf-8"))
        assert captured["resorts"] == ["Snowbird, UT"]
        assert captured["resorts_file"] == ""
        assert payload["applied_filters"]["include_default"] is True
        assert payload["applied_filters"]["search_all"] is True
        assert payload["applied_filters"]["include_all"] is False
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_backend_data_server_search_all_ignores_filters(monkeypatch, valid_payload):
    calls = []

    def fake_run_live_payload(**kwargs):  # noqa: ANN001
        calls.append(kwargs)
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
                "default_enabled": True,
            },
            {
                "resort_id": "mt-brighton-mi",
                "query": "Mt Brighton, MI",
                "name": "Mt Brighton",
                "state": "MI",
                "country": "US",
                "region": "east",
                "pass_types": ["epic"],
                "default_enabled": False,
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
            urllib.request.urlopen(
                f"{base}/api/data?include_default=1&pass_type=ikon&region=west&country=US&search=brighton&search_all=1",
                timeout=3,
            )
            .read()
            .decode("utf-8")
        )
        assert calls[-1]["resorts"] == ["Mt Brighton, MI"]
        assert payload["applied_filters"]["include_default"] is True
        assert payload["applied_filters"]["search_all"] is True

        payload_default_scope = json.loads(
            urllib.request.urlopen(
                f"{base}/api/data?include_default=1&pass_type=ikon&region=west&country=US&search=brighton&search_all=0",
                timeout=3,
            )
            .read()
            .decode("utf-8")
        )
        assert payload_default_scope["resorts_count"] == 0
        assert payload_default_scope["applied_filters"]["search_all"] is False
        assert len(calls) == 1
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_backend_data_server_search_supports_long_form_locations(monkeypatch, valid_payload):
    calls = []

    def fake_run_live_payload(**kwargs):  # noqa: ANN001
        calls.append(kwargs)
        return valid_payload

    monkeypatch.setattr("src.backend.weather_data_server.run_live_payload", fake_run_live_payload)
    monkeypatch.setattr(
        "src.backend.weather_data_server.load_resort_catalog",
        lambda path: [
            {
                "resort_id": "arapahoe-basin-co",
                "query": "Arapahoe Basin, CO",
                "name": "Arapahoe Basin",
                "city": "Summit County",
                "address": "Arapahoe Basin, Summit County, Colorado, United States",
                "state": "CO",
                "country": "US",
                "region": "west",
                "pass_types": ["ikon"],
                "default_enabled": False,
            },
            {
                "resort_id": "whistler-blackcomb-bc",
                "query": "Whistler Blackcomb, BC",
                "name": "Whistler Blackcomb",
                "city": "Whistler Resort Municipality",
                "address": "Whistler Resort Municipality, British Columbia, Canada",
                "state": "BC",
                "country": "CA",
                "region": "west",
                "pass_types": ["epic"],
                "default_enabled": False,
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
        urllib.request.urlopen(f"{base}/api/data?search=colorado&search_all=1&include_all=1", timeout=3).read()
        assert calls[-1]["resorts"] == ["Arapahoe Basin, CO"]

        urllib.request.urlopen(f"{base}/api/data?search=canada&search_all=1&include_all=1", timeout=3).read()
        assert calls[-1]["resorts"] == ["Whistler Blackcomb, BC"]

        urllib.request.urlopen(f"{base}/api/data?search=summit+county&search_all=1&include_all=1", timeout=3).read()
        assert calls[-1]["resorts"] == ["Arapahoe Basin, CO"]
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
