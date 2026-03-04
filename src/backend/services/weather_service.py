from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.backend.pipeline import compute_pipeline_payload
from src.backend.services.request_options import WeatherRequestOptions


def build_weather_payload_for_options(options: WeatherRequestOptions) -> Dict[str, Any]:
    return compute_pipeline_payload(
        resorts=options.resorts,
        resorts_file=options.resorts_file,
        use_default_resorts=False,
        cache_file=options.cache_file,
        geocode_cache_hours=options.geocode_cache_hours,
        forecast_cache_hours=options.forecast_cache_hours,
        max_workers=options.max_workers,
    )


def build_weather_payload(
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
