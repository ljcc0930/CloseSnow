from __future__ import annotations

from typing import List, Optional

from src.backend.constants import (
    API_RETRY_TIMES,
    DEFAULT_FORECAST_CACHE_HOURS,
    DEFAULT_GEOCODE_CACHE_HOURS,
    DEFAULT_MAX_WORKERS,
    DEFAULT_OPEN_METEO_CACHE_FILE,
)
from src.backend.runtime import WeatherPayloadBuildRequest
from src.backend.services.weather_service import build_weather_payload_for_request
from src.contract import WeatherPayloadV1


def run_live_payload(
    resorts: Optional[List[str]] = None,
    resorts_file: str = "",
    include_all_resorts: bool = False,
    cache_file: str = DEFAULT_OPEN_METEO_CACHE_FILE,
    geocode_cache_hours: int = DEFAULT_GEOCODE_CACHE_HOURS,
    forecast_cache_hours: int = DEFAULT_FORECAST_CACHE_HOURS,
    max_workers: int = DEFAULT_MAX_WORKERS,
    api_retries: int = API_RETRY_TIMES,
) -> WeatherPayloadV1:
    request = WeatherPayloadBuildRequest.from_legacy_options(
        resorts=resorts,
        resorts_file=resorts_file,
        include_all_resorts=include_all_resorts,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
        max_workers=max_workers,
        api_retries=api_retries,
    )
    return build_weather_payload_for_request(request)
