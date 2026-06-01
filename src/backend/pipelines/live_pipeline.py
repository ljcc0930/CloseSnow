from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.backend.constants import API_RETRY_TIMES
from src.backend.services.weather_service import build_weather_payload


def run_live_payload(
    resorts: Optional[List[str]] = None,
    resorts_file: str = "",
    include_all_resorts: bool = False,
    cache_file: str = ".cache/open_meteo_cache.json",
    geocode_cache_hours: int = 24 * 30,
    forecast_cache_hours: int = 3,
    max_workers: int = 8,
    api_retries: int = API_RETRY_TIMES,
) -> Dict[str, Any]:
    return build_weather_payload(
        resorts=resorts,
        resorts_file=resorts_file,
        include_all_resorts=include_all_resorts,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
        max_workers=max_workers,
        api_retries=api_retries,
    )
