#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

from src.web.weather_table_renderer import (
    render_rain_table,
    render_snowfall_table,
    render_sun_table,
    render_temperature_table,
    render_weather_table,
)

_PAGE_TEMPLATE = (Path(__file__).resolve().parent / "templates" / "weather_page.html").read_text(encoding="utf-8")


def build_html(
    snowfall: List[Dict[str, str]],
    rain: List[Dict[str, str]],
    weather: List[Dict[str, str]],
    sun: List[Dict[str, str]],
    temp: List[Dict[str, str]],
) -> str:
    snow_table = render_snowfall_table(snowfall)
    rain_table = render_rain_table(rain)
    weather_table = render_weather_table(weather)
    sun_table = render_sun_table(sun)
    temp_table = render_temperature_table(temp)
    now_utc = datetime.now(timezone.utc)
    generated_utc_iso = now_utc.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return (
        _PAGE_TEMPLATE.replace("{{generated_utc_iso}}", generated_utc_iso)
        .replace("{{snow_table}}", snow_table)
        .replace("{{rain_table}}", rain_table)
        .replace("{{weather_table}}", weather_table)
        .replace("{{sun_table}}", sun_table)
        .replace("{{temp_table}}", temp_table)
    )
