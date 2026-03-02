#!/usr/bin/env python3
from __future__ import annotations

import argparse
from http.server import ThreadingHTTPServer
from pathlib import Path
import sys
from typing import List

if str(Path(__file__).resolve().parents[1]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.backend.ecmwf_unified_backend import DEFAULT_RESORTS_FILE, run_pipeline
from src.web.weather_page_render_core import render_payload_html
from src.web.weather_page_server import make_handler


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="CloseSnow unified CLI.")
    sub = p.add_subparsers(dest="command", required=True)

    p_static = sub.add_parser("static", help="Render static HTML.")
    p_static.add_argument(
        "--resort",
        action="append",
        default=[],
        help="Resort query (repeatable). If set, resorts file is ignored.",
    )
    p_static.add_argument(
        "--resorts-file",
        default=DEFAULT_RESORTS_FILE,
        help="Input resorts file when --resort is not provided.",
    )
    p_static.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p_static.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p_static.add_argument("--forecast-cache-hours", type=int, default=3)
    p_static.add_argument("--output-html", default="index.html")

    p_serve = sub.add_parser("serve", help="Run dynamic weather HTTP server.")
    p_serve.add_argument("--host", default="127.0.0.1")
    p_serve.add_argument("--port", type=int, default=8010)
    p_serve.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p_serve.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p_serve.add_argument("--forecast-cache-hours", type=int, default=3)

    return p


def run_static(args: argparse.Namespace) -> int:
    resorts: List[str] = [r.strip() for r in args.resort if r.strip()]
    resorts_file = "" if resorts else args.resorts_file
    payload = run_pipeline(
        resorts=resorts,
        resorts_file=resorts_file,
        use_default_resorts=False,
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        write_outputs=False,
    )

    out = Path(args.output_html)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_payload_html(payload), encoding="utf-8")
    print(f"Done: {out}")
    return 0


def run_server(args: argparse.Namespace) -> int:
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


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "static":
        return run_static(args)
    if args.command == "serve":
        return run_server(args)
    raise ValueError(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
