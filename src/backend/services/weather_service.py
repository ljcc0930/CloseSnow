from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.backend.pipeline import compute_pipeline_payload


def _normalize_resorts(resorts: Optional[List[str]]) -> List[str]:
    return [r.strip() for r in (resorts or []) if r and r.strip()]


def build_weather_payload(
    resorts: Optional[List[str]] = None,
    resorts_file: str = "",
    include_all_resorts: bool = False,
    cache_file: str = ".cache/open_meteo_cache.json",
    geocode_cache_hours: int = 24 * 30,
    forecast_cache_hours: int = 3,
    max_workers: int = 8,
) -> Dict[str, Any]:
    return compute_pipeline_payload(
        resorts=_normalize_resorts(resorts),
        resorts_file=resorts_file,
        include_all_resorts=include_all_resorts,
        use_default_resorts=False,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
        max_workers=max_workers,
    )
