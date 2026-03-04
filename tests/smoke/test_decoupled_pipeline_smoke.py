from __future__ import annotations

import json
import threading
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from src.backend.weather_data_server import make_handler as make_data_handler
from src.web.weather_page_server import make_handler as make_web_handler


def _start(handler_cls):
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_cls)
    host, port = server.server_address
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread, host, port


@pytest.mark.smoke
def test_decoupled_pipeline_smoke(monkeypatch, valid_payload):
    monkeypatch.setattr("src.backend.weather_data_server.run_live_payload", lambda **kwargs: valid_payload)

    data_handler = make_data_handler(
        cache_file=".cache/open_meteo_cache.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=4,
    )
    data_server, data_thread, data_host, data_port = _start(data_handler)
    web_server = None
    web_thread = None
    try:
        web_handler = make_web_handler(
            cache_file=".cache/open_meteo_cache.json",
            geocode_cache_hours=720,
            forecast_cache_hours=3,
            max_workers=4,
            data_mode="api",
            data_source=f"http://{data_host}:{data_port}/api/data",
            data_timeout=3,
        )
        web_server, web_thread, web_host, web_port = _start(web_handler)

        html = urllib.request.urlopen(f"http://{web_host}:{web_port}/", timeout=3).read().decode("utf-8")
        payload = json.loads(
            urllib.request.urlopen(f"http://{web_host}:{web_port}/api/data", timeout=3).read().decode("utf-8")
        )
        assert "<!doctype html>" in html
        assert payload["schema_version"] == valid_payload["schema_version"]
    finally:
        if web_server is not None:
            web_server.shutdown()
            web_server.server_close()
        if web_thread is not None:
            web_thread.join(timeout=3)
        data_server.shutdown()
        data_server.server_close()
        data_thread.join(timeout=3)
