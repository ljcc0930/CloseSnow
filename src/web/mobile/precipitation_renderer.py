#!/usr/bin/env python3
from __future__ import annotations

from typing import Dict, List

from src.web.split_metric_renderer import render_mobile_split_metric_layout
from src.web.weather_table_styles import rain_color, snow_color


def _render_precipitation_mobile_layout(
    data: List[Dict[str, str]],
    weekly_headers: List[str],
    daily_headers: List[str],
    *,
    table_prefix: str,
    kind: str,
    weekly_suffix: str,
    daily_suffix: str,
) -> str:
    color_fn = snow_color if kind == "snow" else rain_color
    return render_mobile_split_metric_layout(
        data,
        weekly_headers,
        daily_headers,
        table_prefix=table_prefix,
        kind=kind,
        weekly_suffix=weekly_suffix,
        daily_suffix=daily_suffix,
        color_fn=color_fn,
    )


def render_snowfall_mobile_layout(
    data: List[Dict[str, str]],
    weekly_headers: List[str],
    daily_headers: List[str],
) -> str:
    return _render_precipitation_mobile_layout(
        data,
        weekly_headers,
        daily_headers,
        table_prefix="snowfall",
        kind="snow",
        weekly_suffix="_cm",
        daily_suffix="_cm",
    )


def render_rainfall_mobile_layout(
    data: List[Dict[str, str]],
    weekly_headers: List[str],
    daily_headers: List[str],
) -> str:
    return _render_precipitation_mobile_layout(
        data,
        weekly_headers,
        daily_headers,
        table_prefix="rain",
        kind="rain",
        weekly_suffix="_rain_mm",
        daily_suffix="_rain_mm",
    )
