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

from src.backend.pipelines.static_pipeline import fetch_static_payload
from src.shared.cli_options import add_cache_runtime_options, add_resort_options
from src.web.pipelines import render_hourly_pages, render_html
from src.web.static_assets import copy_static_assets


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

    payload = fetch_static_payload(
        resorts=resorts,
        resorts_file=resorts_file,
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
        api_retries=args.api_retries,
    )

    output_html = str(Path(args.output_dir) / "index.html")
    out = render_html(output_html, payload)
    hourly_pages = render_hourly_pages(
        output_html,
        payload,
        include_hourly_data=True,
        hourly_mode="local",
        hourly_source="",
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        hourly_max_workers=args.max_workers,
        api_retries=args.api_retries,
    )
    copy_static_assets(args.output_dir)
    print(f"Done: {out}")
    print(f"Done: {len(hourly_pages)} resort hourly page(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
