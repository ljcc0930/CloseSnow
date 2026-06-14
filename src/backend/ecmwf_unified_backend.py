#!/usr/bin/env python3
"""Compatibility entrypoint for unified ski weather backend."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

if str(Path(__file__).resolve().parents[2]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.backend.constants import DEFAULT_RESORTS, DEFAULT_UNIFIED_PAYLOAD_FILE
from src.backend.pipeline import read_resorts, run_pipeline
from src.shared.cli_options import add_cache_runtime_options, add_resort_options
from src.shared.config import DEFAULT_RESORTS_FILE


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Unified ECMWF backend pipeline for ski weather.")
    add_resort_options(
        p,
        resort_help="Resort name (repeatable).",
        resorts_file_help="Resort catalog file (.yml/.json) or plain text file with one resort query per line.",
        use_default_resorts=True,
    )
    p.add_argument("--output-json", default=DEFAULT_UNIFIED_PAYLOAD_FILE)
    p.add_argument("--snow-csv", default=".cache/resorts_snowfall_daily.csv")
    p.add_argument("--rain-csv", default=".cache/resorts_rainfall_daily.csv")
    p.add_argument("--temp-csv", default=".cache/resorts_temperature_daily.csv")
    add_cache_runtime_options(p)
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
