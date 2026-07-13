#!/usr/bin/env python3
"""
Static weather HTML renderer using the same data-to-table logic as weather_page_server.py.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import List

if str(Path(__file__).resolve().parents[2]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.backend.runtime import WeatherPayloadBuildRequest
from src.shared.cli_options import add_cache_runtime_options, add_resort_options
from src.web.static_site_builder import (
    StaticBuildRequest,
    StaticFetchRequest,
    StaticRenderRequest,
    build_static_site,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Render static ski weather HTML using unified backend payload.")
    add_resort_options(
        p,
        resort_help="Resort query (repeatable). If set, --resorts-file is ignored.",
    )
    add_cache_runtime_options(p)
    p.add_argument("--output-dir", default="site")
    return p.parse_args()


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    args = parse_args()

    resorts: List[str] = [r.strip() for r in args.resort if r.strip()]
    resorts_file = "" if resorts else args.resorts_file
    output_json = str(Path(args.output_dir) / "data.json")
    payload_request = WeatherPayloadBuildRequest.from_legacy_options(
        resorts=resorts,
        resorts_file=resorts_file,
        output_json=output_json,
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
        api_retries=args.api_retries,
    )
    result = build_static_site(
        StaticBuildRequest(
            fetch=StaticFetchRequest(payload_request),
            render=StaticRenderRequest(input_json=output_json, output_dir=args.output_dir),
        )
    )
    if result.render_result is None:
        raise RuntimeError("Legacy static renderer did not produce a rendered site")
    print(f"Done: {Path(args.output_dir) / 'index.html'}")
    print(f"Done: {len(result.render_result.hourly_page_paths)} resort hourly page(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
