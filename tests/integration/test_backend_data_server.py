from __future__ import annotations

import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from src.backend.weather_data_server import make_handler


def _serve_once(handler_cls):
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_cls)
    host, port = server.server_address
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server, t, f"http://{host}:{port}"


def test_backend_data_server_api_and_health(monkeypatch, valid_payload):
    monkeypatch.setattr("src.backend.weather_data_server.run_live_payload", lambda **kwargs: valid_payload)
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
        assert payload["schema_version"] == valid_payload["schema_version"]
        assert health["ok"] is True
        assert health["service"] == "closesnow-backend-data"
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
