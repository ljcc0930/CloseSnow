#!/usr/bin/env python3
from __future__ import annotations

from typing import Dict, List

from src.web.split_metric_renderer import render_mobile_split_metric_layout
from src.web.weather_table_styles import snow_color


def render_snowfall_mobile_layout(
    data: List[Dict[str, str]],
    weekly_headers: List[str],
    daily_headers: List[str],
) -> str:
    return render_mobile_split_metric_layout(
        data,
        weekly_headers,
        daily_headers,
        table_prefix="snowfall",
        kind="snow",
        weekly_suffix="_cm",
        daily_suffix="_cm",
        color_fn=snow_color,
    )
