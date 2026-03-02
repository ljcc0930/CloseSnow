#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from typing import Dict

ASSET_MIME_TYPES: Dict[str, str] = {
    "assets/css/weather_page.css": "text/css; charset=utf-8",
    "assets/js/weather_page.js": "application/javascript; charset=utf-8",
}


def asset_path(name: str) -> Path:
    return Path(__file__).parent / name


def read_asset_bytes(name: str) -> bytes:
    return asset_path(name).read_bytes()
