#!/usr/bin/env python3
"""
Dynamic weather page server.

Open the page, and it will run the unified pipeline immediately
(cache hit => local read; miss => API call), then render the report.
"""

from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import List
from urllib.parse import parse_qs, urlparse

from ecmwf_unified_backend import run_pipeline
from weather_page_assets import ASSET_MIME_TYPES, read_asset_bytes
from weather_page_render_core import render_payload_html


def make_handler(
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def _write(self, code: int, body: bytes, content_type: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            resorts: List[str] = []
            resorts_file = "resorts.txt"

            asset_name = parsed.path.lstrip("/")
            if asset_name in ASSET_MIME_TYPES:
                try:
                    body = read_asset_bytes(asset_name)
                except OSError:
                    self._write(404, b"Not Found", "text/plain; charset=utf-8")
                    return
                self._write(200, body, ASSET_MIME_TYPES[asset_name])
                return

            if "resort" in qs:
                resorts = [x.strip() for x in qs.get("resort", []) if x.strip()]
                resorts_file = ""

            payload = run_pipeline(
                resorts=resorts,
                resorts_file=resorts_file,
                use_default_resorts=False,
                cache_file=cache_file,
                geocode_cache_hours=geocode_cache_hours,
                forecast_cache_hours=forecast_cache_hours,
                write_outputs=False,
            )

            if parsed.path == "/api/data":
                body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
                self._write(200, body, "application/json; charset=utf-8")
                return

            html = render_payload_html(payload)
            self._write(200, html.encode("utf-8"), "text/html; charset=utf-8")

    return Handler


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Serve dynamic ski weather page.")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8010)
    p.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p.add_argument("--forecast-cache-hours", type=int, default=3)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    handler = make_handler(
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving dynamic page at http://{args.host}:{args.port}")
    print("Open / for page, /api/data for raw JSON.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
