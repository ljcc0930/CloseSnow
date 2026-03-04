#!/usr/bin/env python3
from __future__ import annotations

from typing import Dict, List

from src.web.split_metric_renderer import render_desktop_split_metric_layout
from src.web.weather_table_styles import rain_color


def render_rainfall_desktop_layout(
    data: List[Dict[str, str]],
    weekly_headers: List[str],
    daily_headers: List[str],
) -> str:
    return render_desktop_split_metric_layout(
        data,
        weekly_headers,
        daily_headers,
        table_prefix="rain",
        kind="rain",
        weekly_suffix="_rain_mm",
        daily_suffix="_rain_mm",
        color_fn=rain_color,
    )
