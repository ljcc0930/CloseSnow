from __future__ import annotations

import json
import threading
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from src.web.weather_page_server import make_handler


def _start_server(handler_cls):
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_cls)
    host, port = server.server_address
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread, f"http://{host}:{port}"


@pytest.mark.smoke
def test_dynamic_server_smoke(monkeypatch, valid_payload):
    monkeypatch.setattr("src.web.weather_page_server.load_payload", lambda **kwargs: valid_payload)

    handler = make_handler(
        cache_file=".cache/open_meteo_cache.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=4,
    )
    server, thread, base = _start_server(handler)
    try:
        html = urllib.request.urlopen(f"{base}/", timeout=3).read().decode("utf-8")
        payload = json.loads(urllib.request.urlopen(f"{base}/api/data", timeout=3).read().decode("utf-8"))
        assert "<!doctype html>" in html
        assert payload["schema_version"] == valid_payload["schema_version"]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)
