from __future__ import annotations

from typing import Any, Dict, List, Literal, TypedDict

SCHEMA_VERSION = "weather_payload_v1"


class CacheInfo(TypedDict):
    file: str
    hits: int
    misses: int
    geocode_cache_hours: int
    forecast_cache_hours: int


class UnitsInfo(TypedDict):
    snowfall_cm: str
    rain_mm: str
    precipitation_mm: str
    temperature_max_c: str
    temperature_min_c: str


class FailedItem(TypedDict):
    query: str
    reason: str


class WeatherPayloadV1(TypedDict):
    schema_version: Literal["weather_payload_v1"]
    generated_at_utc: str
    source: str
    model: str
    forecast_days: int
    units: UnitsInfo
    cache: CacheInfo
    resorts_count: int
    failed_count: int
    failed: List[FailedItem]
    reports: List[Dict[str, Any]]
