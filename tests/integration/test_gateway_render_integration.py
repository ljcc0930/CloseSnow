from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from src.web.data_sources.gateway import load_payload
from src.web.pipelines.static_site import write_payload_json
from src.web.weather_page_render_core import render_payload_html


@pytest.mark.integration
def test_file_gateway_to_renderer_integration(tmp_path, valid_payload):
    payload_path = write_payload_json(str(tmp_path / "data.json"), valid_payload)
    payload = load_payload(mode="file", source=str(payload_path))
    html = render_payload_html(payload)
    assert "<!doctype html>" in html
    assert "Snowfall" in html
    assert 'id="page-content-root"' in html
    assert "window.CLOSESNOW_PAGE_BOOTSTRAP" in html
    assert '"dataUrl": "./data.json"' in html


@pytest.mark.integration
def test_api_gateway_to_renderer_integration(valid_payload):
    body = json.dumps(valid_payload).encode("utf-8")

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format, *args):  # noqa: A003, ANN001
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    host, port = server.server_address
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        payload = load_payload(mode="api", source=f"http://{host}:{port}/api/data", timeout=3)
        html = render_payload_html(payload)
        assert payload["schema_version"] == valid_payload["schema_version"]
        assert "Ski Resorts Weather Forecast" in html
        assert "./data.json" in html
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)
