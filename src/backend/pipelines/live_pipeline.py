from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.backend.services.request_options import WeatherRequestOptions
from src.backend.services.weather_service import build_weather_payload_for_options


def run_live_payload(
    resorts: Optional[List[str]] = None,
    resorts_file: str = "",
    cache_file: str = ".cache/open_meteo_cache.json",
    geocode_cache_hours: int = 24 * 30,
    forecast_cache_hours: int = 3,
    max_workers: int = 8,
) -> Dict[str, Any]:
    options = WeatherRequestOptions.from_inputs(
        resorts=list(resorts or []),
        resorts_file=resorts_file,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
        max_workers=max_workers,
    )
    return build_weather_payload_for_options(options)
