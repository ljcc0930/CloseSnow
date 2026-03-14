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
    monkeypatch.setattr("src.web.weather_page_server.render_payload_html", lambda payload, **kwargs: "<html>ok</html>")
    asset_bodies = {
        "assets/css/weather_page.css": b"body{}",
        "assets/js/favorites_alerts.js": b"window.CloseSnowFavoritesAlerts={};",
        "assets/js/favorites_alerts_sw.js": b"self.addEventListener('notificationclick',()=>{});",
    }
    monkeypatch.setattr("src.web.weather_page_server.read_asset_bytes", lambda name: asset_bodies.get(name, b"body{}"))

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
        asset_with_prefix = urllib.request.urlopen(f"{base}/CloseSnow/assets/css/weather_page.css", timeout=3).read()
        assert asset_with_prefix == b"body{}"
        favorites_asset = urllib.request.urlopen(f"{base}/assets/js/favorites_alerts.js", timeout=3).read()
        assert favorites_asset == b"window.CloseSnowFavoritesAlerts={};"
        favorites_sw_asset = urllib.request.urlopen(f"{base}/assets/js/favorites_alerts_sw.js", timeout=3).read()
        assert favorites_sw_asset == b"self.addEventListener('notificationclick',()=>{});"
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
    monkeypatch.setattr("src.web.weather_page_server.render_payload_html", lambda payload, **kwargs: "<html>ok</html>")

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
    monkeypatch.setattr("src.web.weather_page_server.render_payload_html", lambda payload, **kwargs: "<html>ok</html>")

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
            f"{base}/api/data?resort=A&resort=B&pass_type=ikon&region=west&country=US&search=snow&include_all=1&search_all=0",
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
        assert "search_all=0" in calls["source"]
        assert calls["timeout"] == 11
        assert calls["kwargs"]["resorts"] == ["A", "B"]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_server_root_ignores_filter_query_in_local_mode(monkeypatch):
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
    monkeypatch.setattr(
        "src.web.weather_page_server.select_resorts_from_query",
        lambda qs: (_ for _ in ()).throw(AssertionError("select_resorts_from_query should not be used for HTML root")),
    )
    monkeypatch.setattr("src.web.weather_page_server.render_payload_html", lambda payload, **kwargs: "<html>ok</html>")

    handler = make_handler(
        cache_file=".cache/x.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=2,
    )
    server, thread, base = _serve_once(handler)
    try:
        body = urllib.request.urlopen(
            f"{base}/?pass_type=ikon&region=west&country=US&search=snow&include_default=0&search_all=0",
            timeout=3,
        ).read()
        assert body.decode("utf-8") == "<html>ok</html>"
        assert captured["mode"] == "local"
        assert captured["source"] == ""
        assert captured["resorts"] == []
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_server_root_api_mode_does_not_forward_filter_query(monkeypatch):
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
    monkeypatch.setattr("src.web.weather_page_server.render_payload_html", lambda payload, **kwargs: "<html>ok</html>")

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
            f"{base}/?resort=A&pass_type=ikon&region=west&country=US&search=snow&include_all=1&search_all=0",
            timeout=3,
        ).read()
        assert calls["mode"] == "api"
        assert "resort=A" in calls["source"]
        assert "pass_type=ikon" not in calls["source"]
        assert "region=west" not in calls["source"]
        assert "country=US" not in calls["source"]
        assert "search=snow" not in calls["source"]
        assert "include_all=1" not in calls["source"]
        assert "search_all=0" not in calls["source"]
        assert calls["timeout"] == 11
        assert calls["kwargs"]["resorts"] == ["A"]
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
    monkeypatch.setattr("src.web.weather_page_server.render_payload_html", lambda payload, **kwargs: "<html>ok</html>")

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
    monkeypatch.setattr(
        "src.web.weather_page_server.load_payload",
        lambda **kwargs: {
            "reports": [
                {
                    "resort_id": "snowbird-ut",
                    "query": "Snowbird, UT",
                    "daily": [{"date": "2026-03-13", "weather_code": 3, "temperature_max_c": 4, "temperature_min_c": -5, "snowfall_cm": 1.2, "rain_mm": 0.0}],
                    "past_14d_daily": [
                        {"date": "2026-03-01", "weather_code": 45},
                        {"date": "2026-03-02", "weather_code": 3},
                        {"date": "2026-03-03", "weather_code": 61},
                        {"date": "2026-03-04", "weather_code": 71},
                        {"date": "2026-03-05", "weather_code": 3},
                        {"date": "2026-03-06", "weather_code": 1},
                        {"date": "2026-03-07", "weather_code": 2},
                        {"date": "2026-03-08", "weather_code": 0},
                        {"date": "2026-03-09", "weather_code": 45},
                        {"date": "2026-03-10", "weather_code": 3},
                        {"date": "2026-03-11", "weather_code": 61},
                        {"date": "2026-03-12", "weather_code": 71},
                        {"date": "2026-03-13", "weather_code": 3},
                        {"date": "2026-03-14", "weather_code": 1},
                    ],
                }
            ]
        },
    )
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

        hourly_with_prefix = json.loads(
            urllib.request.urlopen(f"{base}/CloseSnow/api/resort-hourly?resort_id=snowbird-ut&hours=2", timeout=3)
            .read()
            .decode("utf-8")
        )
        assert hourly_with_prefix["resort_id"] == "snowbird-ut"

        page = urllib.request.urlopen(f"{base}/resort/snowbird-ut", timeout=3).read().decode("utf-8")
        assert "Resort Forecast" in page
        assert "snowbird-ut" in page
        assert "Resort Forecast: snowbird-ut" not in page
        assert '"dailySummary": {' in page
        assert "../assets/js/resort_hourly.js" in page
        assert "../assets/js/compact_daily_summary.js" in page
        assert 'id="resort-timeline-section"' in page
        assert 'id="resort-daily-summary-section"' not in page
        assert 'id="resort-history-section"' not in page
        assert "Past 14 days + forecast" in page
        assert 'id="hourly-charts"' in page
        assert '"past14dDaily": [' in page
        assert '"date": "2026-03-01"' in page
        assert '"date": "2026-03-14"' in page

        prefixed_page = urllib.request.urlopen(f"{base}/CloseSnow/resort/snowbird-ut", timeout=3).read().decode("utf-8")
        assert "Resort Forecast" in prefixed_page
        assert "snowbird-ut" in prefixed_page
        assert "Resort Forecast: snowbird-ut" not in prefixed_page
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)
