from __future__ import annotations

from typing import Any, Dict, Mapping, Tuple

HOURLY_METRIC_KEYS: tuple[str, ...] = (
    "snowfall",
    "rain",
    "precipitation_probability",
    "snow_depth",
    "wind_speed_10m",
    "wind_direction_10m",
    "visibility",
)


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
