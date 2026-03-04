#!/usr/bin/env python3
"""
Dynamic weather page server.

Modes:
1. local (default): resolves payload through communication local adapter.
2. api: fetches contract payload from remote API endpoint.
3. file: loads payload contract from local JSON artifact.
"""

from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
from typing import Any, Dict, List
from urllib.parse import parse_qs, urlencode, urlparse, urlsplit, urlunsplit

if str(Path(__file__).resolve().parents[2]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.web.data_sources import load_payload
from src.web.weather_page_assets import ASSET_MIME_TYPES, read_asset_bytes
from src.web.weather_page_render_core import render_payload_html


def _append_resort_query(base_url: str, resorts: List[str]) -> str:
    if not resorts:
        return base_url
    parsed = urlsplit(base_url)
    merged = parse_qs(parsed.query, keep_blank_values=True)
    merged["resort"] = resorts
    query = urlencode(merged, doseq=True)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, parsed.fragment))


def make_handler(
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
    max_workers: int,
    data_mode: str = "local",
    data_source: str = "",
    data_timeout: int = 20,
) -> type[BaseHTTPRequestHandler]:
    if data_mode not in {"local", "api", "file"}:
        raise ValueError(f"Unsupported data mode: {data_mode}")
    if data_mode in {"api", "file"} and not data_source:
        raise ValueError("--data-source is required when --data-mode is api or file")

    class Handler(BaseHTTPRequestHandler):
        def _write(self, code: int, body: bytes, content_type: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _load_request_payload(self, qs: Dict[str, List[str]]) -> Dict[str, Any]:
            resorts = [x.strip() for x in qs.get("resort", []) if x.strip()]
            source = data_source
            if data_mode == "api":
                source = _append_resort_query(data_source, resorts)
            return load_payload(
                mode=data_mode,
                source=source,
                timeout=data_timeout,
                resorts=resorts,
                cache_file=cache_file,
                geocode_cache_hours=geocode_cache_hours,
                forecast_cache_hours=forecast_cache_hours,
                max_workers=max_workers,
            )

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)

            asset_name = parsed.path.lstrip("/")
            if asset_name in ASSET_MIME_TYPES:
                try:
                    body = read_asset_bytes(asset_name)
                except OSError:
                    self._write(404, b"Not Found", "text/plain; charset=utf-8")
                    return
                self._write(200, body, ASSET_MIME_TYPES[asset_name])
                return

            if parsed.path == "/api/health":
                body = json.dumps({"ok": True, "mode": data_mode}, ensure_ascii=False, indent=2).encode("utf-8")
                self._write(200, body, "application/json; charset=utf-8")
                return

            payload = self._load_request_payload(qs)

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
    p.add_argument("--data-mode", choices=["local", "api", "file"], default="local")
    p.add_argument("--data-source", default="")
    p.add_argument("--data-timeout", type=int, default=20)
    p.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p.add_argument("--forecast-cache-hours", type=int, default=3)
    p.add_argument("--max-workers", type=int, default=8)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    handler = make_handler(
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
        data_mode=args.data_mode,
        data_source=args.data_source,
        data_timeout=args.data_timeout,
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving dynamic page at http://{args.host}:{args.port}")
    print(f"Data mode: {args.data_mode}")
    if args.data_mode in {"api", "file"}:
        print(f"Data source: {args.data_source}")
    print("Open / for page, /api/data for raw JSON, /api/health for health check.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
