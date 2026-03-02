#!/usr/bin/env python3
from __future__ import annotations

from typing import Any, Dict

from src.web.weather_html_renderer import build_html
from src.web.weather_report_transform import (
    reports_to_rain_rows,
    reports_to_snow_rows,
    reports_to_temp_rows,
)


def render_payload_html(payload: Dict[str, Any]) -> str:
    reports = payload.get("reports", [])
    snow_rows = reports_to_snow_rows(reports)
    rain_rows = reports_to_rain_rows(reports)
    temp_rows = reports_to_temp_rows(reports)
    return build_html(snow_rows, rain_rows, temp_rows)
