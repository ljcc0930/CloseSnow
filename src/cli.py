#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import List, Tuple

if str(Path(__file__).resolve().parents[1]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.backend.runtime import WeatherPayloadBuildRequest
from src.backend.weather_data_server import make_handler as make_data_handler
from src.shared.cli_options import add_cache_runtime_options, add_resort_options, add_server_bind_options
from src.shared.config import DATA_API_URL_ENV, DEFAULT_DATA_API_URL
from src.web.static_site_builder import (
    StaticBuildRequest,
    StaticFetchRequest,
    StaticRenderRequest,
    build_static_site,
    fetch_static_bundle,
    render_static_bundle,
)
from src.web.weather_page_server import make_handler


def _add_fetch_options(p: argparse.ArgumentParser) -> None:
    add_resort_options(p, include_all_resorts=True)
    add_cache_runtime_options(p)


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

    p_serve_static = sub.add_parser(
        "serve-static", help="Build and serve generated static site files from a directory."
    )
    _add_fetch_options(p_serve_static)
    add_server_bind_options(p_serve_static, default_port=8011)
    p_serve_static.add_argument("--directory", default="site")
    p_serve_static.add_argument("--skip-fetch", action="store_true")
    p_serve_static.add_argument("--skip-render", action="store_true")

    p_serve = sub.add_parser("serve", help="Run dynamic weather HTTP server.")
    add_server_bind_options(p_serve, default_port=8010)
    add_cache_runtime_options(p_serve)

    p_serve_data = sub.add_parser("serve-data", help="Run backend data API server only.")
    add_server_bind_options(p_serve_data, default_port=8020)
    add_cache_runtime_options(p_serve_data)
    p_serve_data.add_argument("--allow-origin", default="*")

    p_serve_web = sub.add_parser("serve-web", help="Run frontend web server with configurable data source.")
    add_server_bind_options(p_serve_web, default_port=8010)
    p_serve_web.add_argument("--data-mode", choices=["local", "api", "file"], default="api")
    p_serve_web.add_argument("--data-source", default=os.getenv(DATA_API_URL_ENV, DEFAULT_DATA_API_URL))
    p_serve_web.add_argument("--data-timeout", type=int, default=20)
    add_cache_runtime_options(p_serve_web)

    return p


def _payload_build_request(args: argparse.Namespace, *, output_json: str) -> WeatherPayloadBuildRequest:
    resorts, resorts_file, include_all_resorts = _resolve_resorts(args)
    return WeatherPayloadBuildRequest.from_legacy_options(
        resorts=resorts,
        resorts_file=resorts_file,
        include_all_resorts=include_all_resorts,
        output_json=output_json,
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
        api_retries=args.api_retries,
    )


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


def _require_existing_static_bundle(output_json: str) -> None:
    path = Path(output_json)
    if not path.exists():
        raise FileNotFoundError(
            f"Static payload JSON does not exist: {path}. "
            "The static --skip-fetch command can only render an existing payload. "
            "Run without --skip-fetch to create it, or pass --output-json to an existing JSON file."
        )


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
    request = StaticFetchRequest(_payload_build_request(args, output_json=args.output_json))
    result = fetch_static_bundle(request)
    print(f"Done: {args.output_json}")
    print(f"Done: {len(result.hourly_json_paths)} resort hourly artifact(s)")
    return 0


def run_render(args: argparse.Namespace) -> int:
    result = render_static_bundle(StaticRenderRequest(input_json=args.input_json, output_dir=args.output_dir))
    print(f"Done: {_index_html_for_output_dir(args.output_dir, input_json=args.input_json)}")
    print(f"Done: {len(result.hourly_page_paths)} resort hourly page(s)")
    print(f"Done: copied assets -> {', '.join(str(path) for path in result.asset_directories)}")
    return 0


def run_static(args: argparse.Namespace) -> int:
    output_json = _static_output_json(args)
    if args.skip_fetch and not args.skip_render:
        _require_existing_static_bundle(output_json)
    request = StaticBuildRequest(
        fetch=StaticFetchRequest(_payload_build_request(args, output_json=output_json)),
        render=StaticRenderRequest(input_json=output_json, output_dir=args.output_dir),
        skip_fetch=args.skip_fetch,
        skip_render=args.skip_render,
    )
    result = build_static_site(request)
    if result.fetch_result is not None:
        print(f"Done: {output_json}")
        print(f"Done: {len(result.fetch_result.hourly_json_paths)} resort hourly artifact(s)")
    if result.render_result is not None:
        print(f"Done: {_index_html_for_output_dir(args.output_dir)}")
        print(f"Done: {len(result.render_result.hourly_page_paths)} resort hourly page(s)")
        print("Done: copied assets -> " + ", ".join(str(path) for path in result.render_result.asset_directories))
    return 0


def _static_outputs_for_directory(directory: str) -> tuple[str, str]:
    root = Path(directory)
    return str(root / "data.json"), str(root / "index.html")


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
        api_retries=args.api_retries,
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
        api_retries=args.api_retries,
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
        api_retries=args.api_retries,
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
        try:
            return run_static(args)
        except FileNotFoundError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            return 2
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
