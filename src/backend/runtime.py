from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Sequence, Tuple

from src.backend.constants import (
    API_RETRY_TIMES,
    DEFAULT_FORECAST_CACHE_HOURS,
    DEFAULT_GEOCODE_CACHE_HOURS,
    DEFAULT_MAX_WORKERS,
    DEFAULT_OPEN_METEO_CACHE_FILE,
    DEFAULT_UNIFIED_PAYLOAD_FILE,
)
from src.shared.config import DEFAULT_RESORTS_FILE


@dataclass(frozen=True)
class WeatherRuntimeOptions:
    cache_file: str = DEFAULT_OPEN_METEO_CACHE_FILE
    geocode_cache_hours: int = DEFAULT_GEOCODE_CACHE_HOURS
    forecast_cache_hours: int = DEFAULT_FORECAST_CACHE_HOURS
    max_workers: int = DEFAULT_MAX_WORKERS
    api_retries: int = API_RETRY_TIMES


@dataclass(frozen=True)
class WeatherPayloadBuildRequest:
    resorts: Tuple[str, ...] = ()
    resorts_file: str = DEFAULT_RESORTS_FILE
    include_all_resorts: bool = False
    use_default_resorts: bool = False
    output_json: str = DEFAULT_UNIFIED_PAYLOAD_FILE
    runtime: WeatherRuntimeOptions = field(default_factory=WeatherRuntimeOptions)

    @classmethod
    def from_legacy_options(
        cls,
        *,
        resorts: Optional[Sequence[str]] = None,
        resorts_file: str = DEFAULT_RESORTS_FILE,
        include_all_resorts: bool = False,
        use_default_resorts: bool = False,
        output_json: str = DEFAULT_UNIFIED_PAYLOAD_FILE,
        cache_file: str = DEFAULT_OPEN_METEO_CACHE_FILE,
        geocode_cache_hours: int = DEFAULT_GEOCODE_CACHE_HOURS,
        forecast_cache_hours: int = DEFAULT_FORECAST_CACHE_HOURS,
        max_workers: int = DEFAULT_MAX_WORKERS,
        api_retries: int = API_RETRY_TIMES,
    ) -> "WeatherPayloadBuildRequest":
        return cls(
            resorts=tuple(resorts or ()),
            resorts_file=resorts_file,
            include_all_resorts=include_all_resorts,
            use_default_resorts=use_default_resorts,
            output_json=output_json,
            runtime=WeatherRuntimeOptions(
                cache_file=cache_file,
                geocode_cache_hours=geocode_cache_hours,
                forecast_cache_hours=forecast_cache_hours,
                max_workers=max_workers,
                api_retries=api_retries,
            ),
        )


__all__ = [
    "WeatherPayloadBuildRequest",
    "WeatherRuntimeOptions",
]
