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
    monkeypatch.setattr("src.web.weather_page_server.run_live_payload", lambda **kwargs: sample_payload)
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
    monkeypatch.setattr("src.web.weather_page_server.run_live_payload", lambda **kwargs: {"reports": []})
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
            "resorts_count": 0,
            "failed_count": 0,
            "failed": [],
            "reports": [],
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
        urllib.request.urlopen(f"{base}/api/data?resort=A&resort=B", timeout=3).read()
        assert captured["resorts"] == ["A", "B"]
        assert captured["resorts_file"] == ""
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)
