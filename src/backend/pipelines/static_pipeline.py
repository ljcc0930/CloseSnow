from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.backend.pipelines.live_pipeline import run_live_payload


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
