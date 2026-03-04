#!/usr/bin/env python3
from __future__ import annotations

import argparse
from http.server import ThreadingHTTPServer
from pathlib import Path
import sys
from typing import Any, Dict, List, Tuple

if str(Path(__file__).resolve().parents[1]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.backend.constants import DEFAULT_RESORTS_FILE
from src.web.data_sources import load_static_payload
from src.web.pipelines import render_html, write_payload_json
from src.web.weather_page_server import make_handler
from src.backend.pipelines.static_pipeline import fetch_static_payload


def _add_fetch_options(p: argparse.ArgumentParser) -> None:
    p.add_argument(
        "--resort",
        action="append",
        default=[],
        help="Resort query (repeatable). If set, resorts file is ignored.",
    )
    p.add_argument(
        "--resorts-file",
        default=DEFAULT_RESORTS_FILE,
        help="Input resorts file when --resort is not provided.",
    )
    p.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p.add_argument("--forecast-cache-hours", type=int, default=3)
    p.add_argument("--max-workers", type=int, default=8)


def _resolve_resorts(args: argparse.Namespace) -> Tuple[List[str], str]:
    resorts = [r.strip() for r in args.resort if r.strip()]
    resorts_file = "" if resorts else args.resorts_file
    return resorts, resorts_file


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="CloseSnow unified CLI.")
    sub = p.add_subparsers(dest="command", required=True)

    p_fetch = sub.add_parser("fetch", help="Fetch payload and write JSON artifact.")
    _add_fetch_options(p_fetch)
    p_fetch.add_argument("--output-json", default="site/data.json")

    p_render = sub.add_parser("render", help="Render HTML from payload JSON artifact.")
    p_render.add_argument("--input-json", default="site/data.json")
    p_render.add_argument("--output-html", default="index.html")

    p_static = sub.add_parser("static", help="Run fetch + render in one command.")
    _add_fetch_options(p_static)
    p_static.add_argument("--output-json", default=".cache/static_payload.json")
    p_static.add_argument("--output-html", default="index.html")
    p_static.add_argument("--skip-fetch", action="store_true")
    p_static.add_argument("--skip-render", action="store_true")

    p_serve = sub.add_parser("serve", help="Run dynamic weather HTTP server.")
    p_serve.add_argument("--host", default="127.0.0.1")
    p_serve.add_argument("--port", type=int, default=8010)
    p_serve.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p_serve.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p_serve.add_argument("--forecast-cache-hours", type=int, default=3)
    p_serve.add_argument("--max-workers", type=int, default=8)

    return p


def _fetch_payload(args: argparse.Namespace) -> Dict[str, Any]:
    resorts, resorts_file = _resolve_resorts(args)
    return fetch_static_payload(
        resorts=resorts,
        resorts_file=resorts_file,
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
    )


def run_fetch(args: argparse.Namespace) -> int:
    payload = _fetch_payload(args)
    out = write_payload_json(args.output_json, payload)
    print(f"Done: {out}")
    return 0


def run_render(args: argparse.Namespace) -> int:
    payload = load_static_payload(args.input_json)
    out = render_html(args.output_html, payload)
    print(f"Done: {out}")
    return 0


def run_static(args: argparse.Namespace) -> int:
    payload: Dict[str, Any] | None = None
    if not args.skip_fetch:
        payload = _fetch_payload(args)
        write_payload_json(args.output_json, payload)
        print(f"Done: {args.output_json}")

    if not args.skip_render:
        if payload is None:
            payload = load_static_payload(args.output_json)
        out = render_html(args.output_html, payload)
        print(f"Done: {out}")
    return 0


def run_server(args: argparse.Namespace) -> int:
    handler = make_handler(
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
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
    if args.command == "fetch":
        return run_fetch(args)
    if args.command == "render":
        return run_render(args)
    if args.command == "static":
        return run_static(args)
    if args.command == "serve":
        return run_server(args)
    raise ValueError(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
