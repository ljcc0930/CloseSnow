#!/usr/bin/env python3
from __future__ import annotations

from typing import Any, Dict

from src.web.weather_html_renderer import build_html
from src.web.weather_report_transform import (
    reports_to_rain_rows,
    reports_to_snow_rows,
    reports_to_sun_rows,
    reports_to_temp_rows,
    reports_to_weather_rows,
)


def render_payload_html(payload: Dict[str, Any]) -> str:
    reports = payload.get("reports", [])
    forecast_days = payload.get("forecast_days")
    display_days = 14
    if isinstance(forecast_days, int) and forecast_days > 0:
        display_days = max(0, forecast_days - 1)
    snow_rows = reports_to_snow_rows(reports, display_days=display_days)
    rain_rows = reports_to_rain_rows(reports, display_days=display_days)
    weather_rows = reports_to_weather_rows(reports, display_days=display_days)
    sun_rows = reports_to_sun_rows(reports, display_days=display_days)
    temp_rows = reports_to_temp_rows(reports, display_days=display_days)
    return build_html(snow_rows, rain_rows, weather_rows, sun_rows, temp_rows)
