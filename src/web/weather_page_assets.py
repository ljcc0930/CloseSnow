#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from typing import Dict

REPO_ROOT = Path(__file__).resolve().parents[2]

ASSET_MIME_TYPES: Dict[str, str] = {
    "assets/css/weather_page.css": "text/css; charset=utf-8",
    "assets/js/compact_daily_summary.js": "application/javascript; charset=utf-8",
    "assets/js/compare_selection.js": "application/javascript; charset=utf-8",
    "assets/js/weather_page.js": "application/javascript; charset=utf-8",
    "assets/css/resort_hourly.css": "text/css; charset=utf-8",
    "assets/js/resort_hourly.js": "application/javascript; charset=utf-8",
}


def asset_path(name: str) -> Path:
    return REPO_ROOT / name


def read_asset_bytes(name: str) -> bytes:
    return asset_path(name).read_bytes()
