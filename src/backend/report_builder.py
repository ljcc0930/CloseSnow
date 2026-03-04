from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.backend.constants import DAYS_PER_WEEK, FORECAST_DAYS, HISTORY_DAYS
from src.backend.models import ResortLocation


def as_float_list(values: List[Any]) -> List[Optional[float]]:
    out: List[Optional[float]] = []
    for value in values:
        try:
            out.append(float(value))
        except Exception:
            out.append(None)
    return out


def as_int_list(values: List[Any]) -> List[Optional[int]]:
    out: List[Optional[int]] = []
    for value in values:
        try:
            out.append(int(value))
        except Exception:
            out.append(None)
    return out


def extract_hhmm(raw: Any) -> Optional[str]:
    if not isinstance(raw, str):
        return None
    value = raw.strip()
    if not value:
        return None
    if "T" in value:
        value = value.split("T", 1)[1]
    if len(value) >= 5 and value[2] == ":" and value[:2].isdigit() and value[3:5].isdigit():
        return value[:5]
    return None


def safe_sum(values: List[Optional[float]]) -> float:
    return float(sum(value for value in values if value is not None))


def build_daily_rows(daily: Dict[str, Any]) -> List[Dict[str, Any]]:
    dates = daily.get("time", [])
    snowfall = as_float_list(daily.get("snowfall_sum", []))
    rain = as_float_list(daily.get("rain_sum", []))
    precipitation = as_float_list(daily.get("precipitation_sum", []))
    tmax = as_float_list(daily.get("temperature_2m_max", []))
    tmin = as_float_list(daily.get("temperature_2m_min", []))
    weather_code = as_int_list(daily.get("weather_code", []))
    sunrise = daily.get("sunrise", [])
    sunset = daily.get("sunset", [])

    rows: List[Dict[str, Any]] = []
    n = max(
        len(dates),
        len(snowfall),
        len(rain),
        len(precipitation),
        len(tmax),
        len(tmin),
        len(weather_code),
        len(sunrise),
        len(sunset),
    )
    for idx in range(n):
        max_v = tmax[idx] if idx < len(tmax) else None
        sunrise_iso = sunrise[idx] if idx < len(sunrise) else None
        sunset_iso = sunset[idx] if idx < len(sunset) else None
        rows.append(
            {
                "date": dates[idx] if idx < len(dates) else None,
                "snowfall_cm": snowfall[idx] if idx < len(snowfall) else None,
                "rain_mm": rain[idx] if idx < len(rain) else None,
                "precipitation_mm": precipitation[idx] if idx < len(precipitation) else None,
                "temperature_max_c": max_v,
                "temperature_min_c": tmin[idx] if idx < len(tmin) else None,
                "weather_code": weather_code[idx] if idx < len(weather_code) else None,
                "sunrise_iso": sunrise_iso,
                "sunset_iso": sunset_iso,
                "sunrise_local_hhmm": extract_hhmm(sunrise_iso),
                "sunset_local_hhmm": extract_hhmm(sunset_iso),
                "above_0": 1 if (max_v is not None and max_v > 0) else 0,
            }
        )
    return rows


def build_report(location: ResortLocation, forecast: Dict[str, Any], history: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    daily = forecast.get("daily", {})
    rows = build_daily_rows(daily)

    snow_w1 = [row.get("snowfall_cm") for row in rows[0:DAYS_PER_WEEK]]
    snow_w2 = [row.get("snowfall_cm") for row in rows[DAYS_PER_WEEK:FORECAST_DAYS]]
    rain_w1 = [row.get("rain_mm") for row in rows[0:DAYS_PER_WEEK]]
    rain_w2 = [row.get("rain_mm") for row in rows[DAYS_PER_WEEK:FORECAST_DAYS]]

    history_daily = (history or {}).get("daily", {})
    history_rows = build_daily_rows(history_daily)[:HISTORY_DAYS]

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
        "past_14d_daily": history_rows,
        "daily": rows,
    }
