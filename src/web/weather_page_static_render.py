#!/usr/bin/env python3
"""
Static weather HTML renderer using the same data-to-table logic as weather_page_server.py.
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path
import shutil
import sys
from typing import List

if str(Path(__file__).resolve().parents[2]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.shared.config import DEFAULT_RESORTS_FILE
from src.backend.pipelines.static_pipeline import fetch_static_payload
from src.web.pipelines import render_compare_page, render_hourly_pages, render_html


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Render static ski weather HTML using unified backend payload."
    )
    p.add_argument(
        "--resort",
        action="append",
        default=[],
        help="Resort query (repeatable). If set, --resorts-file is ignored.",
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
    p.add_argument("--output-dir", default="site")
    return p.parse_args()


def _copy_static_assets(output_dir: str) -> None:
    root = Path(output_dir).resolve() / "assets"
    for name in ("css", "js"):
        shutil.copytree(Path("assets") / name, root / name, dirs_exist_ok=True)


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
    )

    output_html = str(Path(args.output_dir) / "index.html")
    out = render_html(output_html, payload)
    render_compare_page(output_html)
    hourly_pages = render_hourly_pages(
        output_html,
        payload,
        include_hourly_data=True,
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
    )
    _copy_static_assets(args.output_dir)
    print(f"Done: {out}")
    print(f"Done: {len(hourly_pages)} resort hourly page(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
