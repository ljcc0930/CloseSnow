from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.backend.constants import DAYS_PER_WEEK, FORECAST_DAYS
from src.backend.models import ResortLocation


def as_float_list(values: List[Any]) -> List[Optional[float]]:
    out: List[Optional[float]] = []
    for value in values:
        try:
            out.append(float(value))
        except Exception:
            out.append(None)
    return out


def safe_sum(values: List[Optional[float]]) -> float:
    return float(sum(value for value in values if value is not None))


def build_report(location: ResortLocation, forecast: Dict[str, Any]) -> Dict[str, Any]:
    daily = forecast.get("daily", {})
    dates = daily.get("time", [])
    snowfall = as_float_list(daily.get("snowfall_sum", []))
    rain = as_float_list(daily.get("rain_sum", []))
    precipitation = as_float_list(daily.get("precipitation_sum", []))
    tmax = as_float_list(daily.get("temperature_2m_max", []))
    tmin = as_float_list(daily.get("temperature_2m_min", []))

    rows: List[Dict[str, Any]] = []
    n = max(len(dates), len(snowfall), len(rain), len(precipitation), len(tmax), len(tmin))
    for idx in range(n):
        max_v = tmax[idx] if idx < len(tmax) else None
        rows.append(
            {
                "date": dates[idx] if idx < len(dates) else None,
                "snowfall_cm": snowfall[idx] if idx < len(snowfall) else None,
                "rain_mm": rain[idx] if idx < len(rain) else None,
                "precipitation_mm": precipitation[idx] if idx < len(precipitation) else None,
                "temperature_max_c": max_v,
                "temperature_min_c": tmin[idx] if idx < len(tmin) else None,
                "above_0": 1 if (max_v is not None and max_v > 0) else 0,
            }
        )

    snow_w1 = snowfall[0:DAYS_PER_WEEK]
    snow_w2 = snowfall[DAYS_PER_WEEK:FORECAST_DAYS]
    rain_w1 = rain[0:DAYS_PER_WEEK]
    rain_w2 = rain[DAYS_PER_WEEK:FORECAST_DAYS]

    return {
        "query": location.query,
        "matched_name": location.name,
        "country": location.country,
        "admin1": location.admin1,
        "input_latitude": location.latitude,
        "input_longitude": location.longitude,
        "model": "ecmwf_ifs025",
        "forecast_timezone": forecast.get("timezone"),
        "resolved_latitude": forecast.get("latitude"),
        "resolved_longitude": forecast.get("longitude"),
        "week1_total_snowfall_cm": safe_sum(snow_w1),
        "week2_total_snowfall_cm": safe_sum(snow_w2),
        "week1_total_rain_mm": safe_sum(rain_w1),
        "week2_total_rain_mm": safe_sum(rain_w2),
        "daily": rows,
    }
