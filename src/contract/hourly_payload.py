from __future__ import annotations

from typing import Any, Dict, List, Mapping, Optional, Tuple, TypedDict

from src.contract.weather_payload_v1 import JsonNumber, NearbyAirport

HOURLY_METRIC_KEYS: tuple[str, ...] = (
    "snowfall",
    "rain",
    "precipitation_probability",
    "snow_depth",
    "wind_speed_10m",
    "wind_direction_10m",
    "visibility",
)


class HourlySeries(TypedDict, total=False):
    time: List[str]
    snowfall: List[Optional[JsonNumber]]
    rain: List[Optional[JsonNumber]]
    precipitation_probability: List[Optional[JsonNumber]]
    snow_depth: List[Optional[JsonNumber]]
    wind_speed_10m: List[Optional[JsonNumber]]
    wind_direction_10m: List[Optional[JsonNumber]]
    visibility: List[Optional[JsonNumber]]


class HourlyPayload(TypedDict, total=False):
    error: str
    resort_id: str
    query: str
    display_name: str
    website: str
    matched_name: str
    country: object
    region: object
    subregion: object
    pass_types: object
    timezone: object
    model: str
    input_latitude: JsonNumber
    input_longitude: JsonNumber
    resolved_latitude: object
    resolved_longitude: object
    nearby_airports: List[NearbyAirport]
    hours: int
    hourly: HourlySeries


def trim_hourly_payload(payload: Mapping[str, Any], hours: int) -> Tuple[int, Dict[str, object]]:
    hourly = payload.get("hourly", {}) if isinstance(payload, Mapping) else {}
    hourly_mapping = hourly if isinstance(hourly, Mapping) else {}
    raw_times = hourly_mapping.get("time", [])
    times = list(raw_times) if isinstance(raw_times, list) else []
    requested_hours = max(1, int(hours))
    n = min(requested_hours, len(times))
    trimmed_hourly: Dict[str, object] = {"time": times[:n]}
    for key in HOURLY_METRIC_KEYS:
        values = hourly_mapping.get(key, [])
        trimmed_hourly[key] = values[:n] if isinstance(values, list) else []
    return n, trimmed_hourly
