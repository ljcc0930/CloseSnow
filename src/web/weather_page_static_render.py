#!/usr/bin/env python3
"""
Static weather HTML renderer using the same data-to-table logic as weather_page_server.py.
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path
import sys
from typing import List

if str(Path(__file__).resolve().parents[2]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.backend.ecmwf_unified_backend import run_pipeline
from src.web.weather_page_render_core import render_payload_html

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RESORTS_FILE = str(REPO_ROOT / "resorts.txt")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Render static ski weather HTML using unified backend payload."
    )
    p.add_argument(
        "--resort",
        action="append",
        default=[],
        help="Resort query (repeatable). If set, resorts.txt is ignored.",
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
    p.add_argument("--output-html", default="index.html")
    return p.parse_args()


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    args = parse_args()

    resorts: List[str] = [r.strip() for r in args.resort if r.strip()]
    resorts_file = "" if resorts else args.resorts_file

    payload = run_pipeline(
        resorts=resorts,
        resorts_file=resorts_file,
        use_default_resorts=False,
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
        write_outputs=False,
    )

    out = Path(args.output_html)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_payload_html(payload), encoding="utf-8")
    print(f"Done: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
