from __future__ import annotations

import argparse

from src.backend.constants import (
    API_RETRY_TIMES,
    DEFAULT_FORECAST_CACHE_HOURS,
    DEFAULT_GEOCODE_CACHE_HOURS,
    DEFAULT_MAX_WORKERS,
    DEFAULT_OPEN_METEO_CACHE_FILE,
)
from src.shared.config import DEFAULT_RESORTS_FILE


def add_resort_options(
    parser: argparse.ArgumentParser,
    *,
    resort_help: str = "Resort query (repeatable). If set, resorts file is ignored.",
    resorts_file_help: str = "Input resorts file when --resort is not provided.",
    include_all_resorts: bool = False,
    use_default_resorts: bool = False,
) -> None:
    parser.add_argument("--resort", action="append", default=[], help=resort_help)
    parser.add_argument("--resorts-file", default=DEFAULT_RESORTS_FILE, help=resorts_file_help)
    if include_all_resorts:
        parser.add_argument(
            "--include-all-resorts",
            action="store_true",
            help="Include all resorts from --resorts-file, including default_enabled=false entries.",
        )
    if use_default_resorts:
        parser.add_argument("--use-default-resorts", action="store_true", help="Use built-in resort list.")


def add_cache_runtime_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--cache-file", default=DEFAULT_OPEN_METEO_CACHE_FILE)
    parser.add_argument("--geocode-cache-hours", type=int, default=DEFAULT_GEOCODE_CACHE_HOURS)
    parser.add_argument("--forecast-cache-hours", type=int, default=DEFAULT_FORECAST_CACHE_HOURS)
    parser.add_argument("--max-workers", type=int, default=DEFAULT_MAX_WORKERS)
    parser.add_argument("--api-retries", type=int, default=API_RETRY_TIMES)


def add_server_bind_options(parser: argparse.ArgumentParser, *, default_port: int) -> None:
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=default_port)
