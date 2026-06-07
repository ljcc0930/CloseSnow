#!/usr/bin/env python3
"""Compatibility entrypoint for unified ski weather backend."""

from __future__ import annotations

import argparse
import sys

from src.backend.constants import (
    API_RETRY_TIMES,
    DEFAULT_FORECAST_CACHE_HOURS,
    DEFAULT_GEOCODE_CACHE_HOURS,
    DEFAULT_MAX_WORKERS,
    DEFAULT_OPEN_METEO_CACHE_FILE,
    DEFAULT_RESORTS,
    DEFAULT_UNIFIED_PAYLOAD_FILE,
)
from src.backend.pipeline import read_resorts, run_pipeline
from src.shared.config import DEFAULT_RESORTS_FILE


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Unified ECMWF backend pipeline for ski weather.")
    p.add_argument("--resort", action="append", default=[], help="Resort name (repeatable).")
    p.add_argument(
        "--resorts-file",
        default=DEFAULT_RESORTS_FILE,
        help="Resort catalog file (.yml/.json) or plain text file with one resort query per line.",
    )
    p.add_argument("--use-default-resorts", action="store_true", help="Use built-in resort list.")
    p.add_argument("--output-json", default=DEFAULT_UNIFIED_PAYLOAD_FILE)
    p.add_argument("--snow-csv", default=".cache/resorts_snowfall_daily.csv")
    p.add_argument("--rain-csv", default=".cache/resorts_rainfall_daily.csv")
    p.add_argument("--temp-csv", default=".cache/resorts_temperature_daily.csv")
    p.add_argument("--cache-file", default=DEFAULT_OPEN_METEO_CACHE_FILE)
    p.add_argument("--geocode-cache-hours", type=int, default=DEFAULT_GEOCODE_CACHE_HOURS)
    p.add_argument("--forecast-cache-hours", type=int, default=DEFAULT_FORECAST_CACHE_HOURS)
    p.add_argument("--max-workers", type=int, default=DEFAULT_MAX_WORKERS)
    p.add_argument("--api-retries", type=int, default=API_RETRY_TIMES)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    out = run_pipeline(
        resorts=args.resort,
        resorts_file=args.resorts_file,
        use_default_resorts=args.use_default_resorts,
        output_json=args.output_json,
        snow_csv=args.snow_csv,
        rain_csv=args.rain_csv,
        temp_csv=args.temp_csv,
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
        api_retries=args.api_retries,
        write_outputs=True,
    )
    cache_info = out["cache"]

    print(f"Done. JSON: {args.output_json}")
    print(f"Done. Snow CSV: {args.snow_csv}")
    print(f"Done. Rain CSV: {args.rain_csv}")
    print(f"Done. Temp CSV: {args.temp_csv}")
    print(
        f"Cache: hits={cache_info['hits']}, misses={cache_info['misses']}, file={cache_info['file']}",
        file=sys.stderr,
    )
    if out["failed"]:
        print(f"Warnings: {len(out['failed'])} resort(s) failed.", file=sys.stderr)
    return 0


__all__ = [
    "DEFAULT_RESORTS",
    "DEFAULT_RESORTS_FILE",
    "read_resorts",
    "run_pipeline",
    "parse_args",
    "main",
]


if __name__ == "__main__":
    raise SystemExit(main())
