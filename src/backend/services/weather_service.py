from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.backend.constants import (
    API_RETRY_TIMES,
    DEFAULT_FORECAST_CACHE_HOURS,
    DEFAULT_GEOCODE_CACHE_HOURS,
    DEFAULT_MAX_WORKERS,
    DEFAULT_OPEN_METEO_CACHE_FILE,
)
from src.backend.pipeline import compute_pipeline_payload


def _normalize_resorts(resorts: Optional[List[str]]) -> List[str]:
    return [r.strip() for r in (resorts or []) if r and r.strip()]


def build_weather_payload(
    resorts: Optional[List[str]] = None,
    resorts_file: str = "",
    include_all_resorts: bool = False,
    cache_file: str = DEFAULT_OPEN_METEO_CACHE_FILE,
    geocode_cache_hours: int = DEFAULT_GEOCODE_CACHE_HOURS,
    forecast_cache_hours: int = DEFAULT_FORECAST_CACHE_HOURS,
    max_workers: int = DEFAULT_MAX_WORKERS,
    api_retries: int = API_RETRY_TIMES,
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
        api_retries=api_retries,
    )
