from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.backend.pipeline import compute_pipeline_payload


def build_weather_payload(
    resorts: Optional[List[str]] = None,
    resorts_file: str = "",
    cache_file: str = ".cache/open_meteo_cache.json",
    geocode_cache_hours: int = 24 * 30,
    forecast_cache_hours: int = 3,
    max_workers: int = 8,
) -> Dict[str, Any]:
    selected = [r.strip() for r in (resorts or []) if r and r.strip()]
    return compute_pipeline_payload(
        resorts=selected,
        resorts_file=resorts_file,
        use_default_resorts=False,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
        max_workers=max_workers,
    )
