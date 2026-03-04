#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
from typing import List
from urllib.parse import parse_qs, urlparse

if str(Path(__file__).resolve().parents[2]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.backend.pipelines.live_pipeline import run_live_payload
from src.shared.config import DEFAULT_RESORTS_FILE


def _append_common_headers(handler: BaseHTTPRequestHandler, allow_origin: str) -> None:
    handler.send_header("Access-Control-Allow-Origin", allow_origin)
    handler.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")


def make_handler(
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
    max_workers: int,
    allow_origin: str = "*",
) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def _write_json(self, code: int, payload: dict) -> None:
            body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
            self.send_response(code)
            _append_common_headers(self, allow_origin)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _selected_resorts(self, qs: dict) -> tuple[List[str], str]:
            resorts = [x.strip() for x in qs.get("resort", []) if x.strip()]
            resorts_file = "" if resorts else DEFAULT_RESORTS_FILE
            return resorts, resorts_file

        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_response(204)
            _append_common_headers(self, allow_origin)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            if parsed.path == "/api/health":
                self._write_json(
                    200,
                    {
                        "ok": True,
                        "service": "closesnow-backend-data",
                        "time_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                    },
                )
                return
            if parsed.path != "/api/data":
                self._write_json(404, {"error": "Not Found"})
                return

            resorts, resorts_file = self._selected_resorts(qs)
            payload = run_live_payload(
                resorts=resorts,
                resorts_file=resorts_file,
                cache_file=cache_file,
                geocode_cache_hours=geocode_cache_hours,
                forecast_cache_hours=forecast_cache_hours,
                max_workers=max_workers,
            )
            self._write_json(200, payload)

    return Handler


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Serve backend weather payload API.")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8020)
    p.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p.add_argument("--forecast-cache-hours", type=int, default=3)
    p.add_argument("--max-workers", type=int, default=8)
    p.add_argument("--allow-origin", default="*")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    handler = make_handler(
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
        allow_origin=args.allow_origin,
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving backend data API at http://{args.host}:{args.port}")
    print("Open /api/data for payload, /api/health for health check.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
