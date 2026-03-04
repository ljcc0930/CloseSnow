from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass(frozen=True)
class WeatherRequestOptions:
    resorts: List[str] = field(default_factory=list)
    resorts_file: str = ""
    cache_file: str = ".cache/open_meteo_cache.json"
    geocode_cache_hours: int = 24 * 30
    forecast_cache_hours: int = 3
    max_workers: int = 8

    @classmethod
    def from_inputs(
        cls,
        resorts: List[str] | None = None,
        resorts_file: str = "",
        cache_file: str = ".cache/open_meteo_cache.json",
        geocode_cache_hours: int = 24 * 30,
        forecast_cache_hours: int = 3,
        max_workers: int = 8,
    ) -> "WeatherRequestOptions":
        normalized = [r.strip() for r in (resorts or []) if r and r.strip()]
        return cls(
            resorts=normalized,
            resorts_file=resorts_file,
            cache_file=cache_file,
            geocode_cache_hours=geocode_cache_hours,
            forecast_cache_hours=forecast_cache_hours,
            max_workers=max_workers,
        )
