from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.backend.pipelines.live_pipeline import run_live_payload
from src.web.weather_page_render_core import render_payload_html


def fetch_static_payload(
    resorts: Optional[List[str]] = None,
    resorts_file: str = "",
    cache_file: str = ".cache/open_meteo_cache.json",
    geocode_cache_hours: int = 24 * 30,
    forecast_cache_hours: int = 3,
    max_workers: int = 8,
) -> Dict[str, Any]:
    return run_live_payload(
        resorts=resorts,
        resorts_file=resorts_file,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
        max_workers=max_workers,
    )


def write_payload_json(path: str, payload: Dict[str, Any]) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


def render_html(path: str, payload: Dict[str, Any]) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_payload_html(payload), encoding="utf-8")
    return out
