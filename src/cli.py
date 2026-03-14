#!/usr/bin/env python3
from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import shutil
import sys
from typing import Any, Dict, List, Tuple

if str(Path(__file__).resolve().parents[1]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.shared.config import DATA_API_URL_ENV, DEFAULT_DATA_API_URL, DEFAULT_RESORTS_FILE
from src.web.data_sources import load_payload
from src.web.pipelines import render_hourly_pages, render_html, write_payload_json
from src.web.weather_page_server import make_handler
from src.backend.pipelines.static_pipeline import fetch_static_payload
from src.backend.weather_data_server import make_handler as make_data_handler


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
    p.add_argument(
        "--include-all-resorts",
        action="store_true",
        help="Include all resorts from --resorts-file, including default_enabled=false entries.",
    )
    p.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p.add_argument("--forecast-cache-hours", type=int, default=3)
    p.add_argument("--max-workers", type=int, default=8)


def _resolve_resorts(args: argparse.Namespace) -> Tuple[List[str], str, bool]:
    resorts = [r.strip() for r in args.resort if r.strip()]
    include_all_resorts = bool(getattr(args, "include_all_resorts", False))
    if resorts:
        include_all_resorts = False
    resorts_file = "" if resorts else args.resorts_file
    return resorts, resorts_file, include_all_resorts


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="CloseSnow unified CLI.")
    sub = p.add_subparsers(dest="command", required=True)

    p_fetch = sub.add_parser("fetch", help="Fetch payload and write JSON artifact.")
    _add_fetch_options(p_fetch)
    p_fetch.add_argument("--output-json", default="site/data.json")

    p_render = sub.add_parser("render", help="Render HTML from payload JSON artifact.")
    p_render.add_argument("--input-json", default="site/data.json")
    p_render.add_argument("--output-dir", default=None)

    p_static = sub.add_parser("static", help="Run fetch + render in one command.")
    _add_fetch_options(p_static)
    p_static.add_argument("--output-json", default=None)
    p_static.add_argument("--output-dir", default="site")
    p_static.add_argument("--skip-fetch", action="store_true")
    p_static.add_argument("--skip-render", action="store_true")

    p_serve_static = sub.add_parser("serve-static", help="Build and serve generated static site files from a directory.")
    _add_fetch_options(p_serve_static)
    p_serve_static.add_argument("--host", default="127.0.0.1")
    p_serve_static.add_argument("--port", type=int, default=8011)
    p_serve_static.add_argument("--directory", default="site")
    p_serve_static.add_argument("--skip-fetch", action="store_true")
    p_serve_static.add_argument("--skip-render", action="store_true")

    p_serve = sub.add_parser("serve", help="Run dynamic weather HTTP server.")
    p_serve.add_argument("--host", default="127.0.0.1")
    p_serve.add_argument("--port", type=int, default=8010)
    p_serve.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p_serve.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p_serve.add_argument("--forecast-cache-hours", type=int, default=3)
    p_serve.add_argument("--max-workers", type=int, default=8)

    p_serve_data = sub.add_parser("serve-data", help="Run backend data API server only.")
    p_serve_data.add_argument("--host", default="127.0.0.1")
    p_serve_data.add_argument("--port", type=int, default=8020)
    p_serve_data.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p_serve_data.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p_serve_data.add_argument("--forecast-cache-hours", type=int, default=3)
    p_serve_data.add_argument("--max-workers", type=int, default=8)
    p_serve_data.add_argument("--allow-origin", default="*")

    p_serve_web = sub.add_parser("serve-web", help="Run frontend web server with configurable data source.")
    p_serve_web.add_argument("--host", default="127.0.0.1")
    p_serve_web.add_argument("--port", type=int, default=8010)
    p_serve_web.add_argument("--data-mode", choices=["local", "api", "file"], default="api")
    p_serve_web.add_argument("--data-source", default=os.getenv(DATA_API_URL_ENV, DEFAULT_DATA_API_URL))
    p_serve_web.add_argument("--data-timeout", type=int, default=20)
    p_serve_web.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p_serve_web.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p_serve_web.add_argument("--forecast-cache-hours", type=int, default=3)
    p_serve_web.add_argument("--max-workers", type=int, default=8)

    return p


def _fetch_payload(args: argparse.Namespace) -> Dict[str, Any]:
    resorts, resorts_file, include_all_resorts = _resolve_resorts(args)
    return fetch_static_payload(
        resorts=resorts,
        resorts_file=resorts_file,
        include_all_resorts=include_all_resorts,
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
    )


def _relative_url(from_html_path: str, target_path: str) -> str:
    from_dir = Path(from_html_path).resolve().parent
    target = Path(target_path).resolve()
    rel = os.path.relpath(target, start=from_dir).replace(os.sep, "/")
    if not rel.startswith("."):
        return f"./{rel}"
    return rel


def _index_html_for_output_dir(output_dir: str | None, *, input_json: str | None = None) -> str:
    if output_dir:
        return str(Path(output_dir) / "index.html")
    if input_json:
        return str(Path(input_json).resolve().parent / "index.html")
    return str(Path("site") / "index.html")


def _static_output_json(args: argparse.Namespace) -> str:
    if getattr(args, "output_json", None):
        return str(args.output_json)
    return str(Path(args.output_dir) / "data.json")


def _serve_http_server(
    host: str,
    port: int,
    handler: type,
    lines: List[str],
) -> int:
    server = ThreadingHTTPServer((host, port), handler)
    for line in lines:
        print(line)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def run_fetch(args: argparse.Namespace) -> int:
    payload = _fetch_payload(args)
    out = write_payload_json(args.output_json, payload)
    print(f"Done: {out}")
    return 0


def run_render(args: argparse.Namespace) -> int:
    payload = load_payload(mode="file", source=args.input_json)
    output_html = _index_html_for_output_dir(args.output_dir, input_json=args.input_json)
    out = render_html(output_html, payload, data_url=_relative_url(output_html, args.input_json))
    hourly_pages = render_hourly_pages(output_html, payload)
    output_dir = str(Path(output_html).parent)
    copied_assets = _copy_static_assets(output_dir)
    print(f"Done: {out}")
    print(f"Done: {len(hourly_pages)} resort hourly page(s)")
    print(f"Done: copied assets -> {', '.join(str(path) for path in copied_assets)}")
    return 0


def run_static(args: argparse.Namespace) -> int:
    output_json = _static_output_json(args)
    output_html = _index_html_for_output_dir(args.output_dir)
    payload: Dict[str, Any] | None = None
    if not args.skip_fetch:
        payload = _fetch_payload(args)
        write_payload_json(output_json, payload)
        print(f"Done: {output_json}")

    if not args.skip_render:
        if payload is None:
            payload = load_payload(mode="file", source=output_json)
        out = render_html(output_html, payload, data_url=_relative_url(output_html, output_json))
        hourly_pages = render_hourly_pages(
            output_html,
            payload,
            include_hourly_data=True,
            cache_file=args.cache_file,
            geocode_cache_hours=args.geocode_cache_hours,
            forecast_cache_hours=args.forecast_cache_hours,
        )
        print(f"Done: {out}")
        print(f"Done: {len(hourly_pages)} resort hourly page(s)")
    copied_assets = _copy_static_assets(args.output_dir)
    print(f"Done: copied assets -> {', '.join(str(path) for path in copied_assets)}")
    return 0


def _static_outputs_for_directory(directory: str) -> tuple[str, str]:
    root = Path(directory)
    return str(root / "data.json"), str(root / "index.html")


def _copy_static_assets(directory: str) -> List[Path]:
    root = Path(directory).resolve()
    assets_root = root / "assets"
    copied: List[Path] = []
    for name in ("css", "js"):
        source = Path("assets") / name
        target = assets_root / name
        shutil.copytree(source, target, dirs_exist_ok=True)
        copied.append(target)
    return copied


def run_static_server(args: argparse.Namespace) -> int:
    static_args = argparse.Namespace(**vars(args))
    static_args.output_dir = args.directory
    run_static(static_args)

    directory = Path(args.directory).resolve()
    if not directory.exists():
        raise FileNotFoundError(f"Static directory does not exist: {directory}")
    if not directory.is_dir():
        raise NotADirectoryError(f"Static path is not a directory: {directory}")
    output_json, output_html = _static_outputs_for_directory(args.directory)

    handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
    return _serve_http_server(
        args.host,
        args.port,
        handler,
        [
            f"Serving static site at http://{args.host}:{args.port}",
            f"Static root: {directory}",
            f"Static payload: {Path(output_json).resolve()}",
            f"Static build: {Path(output_html).resolve()}",
            "Open / for index.html and /resort/<resort_id>/ for generated hourly pages.",
        ],
    )


def run_server(args: argparse.Namespace) -> int:
    handler = make_handler(
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
        data_mode="local",
        data_source="",
        data_timeout=20,
    )
    return _serve_http_server(
        args.host,
        args.port,
        handler,
        [
            f"Serving dynamic page at http://{args.host}:{args.port}",
            "Open / for page, /api/data for raw JSON, /api/health for health check.",
        ],
    )


def run_data_server(args: argparse.Namespace) -> int:
    handler = make_data_handler(
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
        allow_origin=args.allow_origin,
    )
    return _serve_http_server(
        args.host,
        args.port,
        handler,
        [
            f"Serving backend data API at http://{args.host}:{args.port}",
            "Open /api/data for payload, /api/health for health check.",
        ],
    )


def run_web_server(args: argparse.Namespace) -> int:
    data_source = args.data_source
    if args.data_mode == "local":
        data_source = ""
    handler = make_handler(
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
        data_mode=args.data_mode,
        data_source=data_source,
        data_timeout=args.data_timeout,
    )
    lines = [
        f"Serving frontend web at http://{args.host}:{args.port}",
        f"Data mode: {args.data_mode}",
    ]
    if args.data_mode in {"api", "file"}:
        lines.append(f"Data source: {data_source}")
    lines.append("Open / for page, /api/data for raw JSON, /api/health for health check.")
    return _serve_http_server(args.host, args.port, handler, lines)


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "fetch":
        return run_fetch(args)
    if args.command == "render":
        return run_render(args)
    if args.command == "static":
        return run_static(args)
    if args.command == "serve-static":
        return run_static_server(args)
    if args.command == "serve":
        return run_server(args)
    if args.command == "serve-data":
        return run_data_server(args)
    if args.command == "serve-web":
        return run_web_server(args)
    raise ValueError(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
