#!/usr/bin/env python3
from __future__ import annotations

from typing import Callable, Dict, List, Optional

from src.web.desktop.rainfall_renderer import render_rainfall_desktop_layout
from src.web.desktop.snowfall_renderer import render_snowfall_desktop_layout
from src.web.desktop.temperature_renderer import render_temperature_desktop_layout

try:
    from src.web.mobile.rainfall_renderer import render_rainfall_mobile_layout
except ModuleNotFoundError:
    render_rainfall_mobile_layout = None

try:
    from src.web.mobile.snowfall_renderer import render_snowfall_mobile_layout
except ModuleNotFoundError:
    render_snowfall_mobile_layout = None

LayoutRenderer = Callable[[List[Dict[str, str]], List[str], List[str]], str]


def _render_desktop_and_mobile(
    data: List[Dict[str, str]],
    weekly_headers: List[str],
    daily_headers: List[str],
    desktop_renderer: LayoutRenderer,
    mobile_renderer: Optional[LayoutRenderer],
) -> str:
    desktop_layout = desktop_renderer(data, weekly_headers, daily_headers)
    if mobile_renderer is None:
        # If mobile renderer does not exist, reuse desktop as fallback.
        return desktop_layout
    mobile_layout = mobile_renderer(data, weekly_headers, daily_headers)
    return desktop_layout + mobile_layout


def render_rain_table(data: List[Dict[str, str]]) -> str:
    if not data:
        return "<section><h2>Rainfall (mm)</h2><p>No data</p></section>"

    headers = [h for h in data[0].keys() if h != "matched_name"]
    weekly_headers = [h for h in headers if h.startswith("week")]
    daily_headers = [h for h in headers if h.startswith("day_")]
    layout = _render_desktop_and_mobile(
        data,
        weekly_headers,
        daily_headers,
        desktop_renderer=render_rainfall_desktop_layout,
        mobile_renderer=render_rainfall_mobile_layout,
    )
    return f"""
    <section>
      <div class="section-header">
        <h2>Rainfall</h2>
        <div class="unit-toggle" role="group" aria-label="Rainfall unit system" data-target-kind="rain">
          <button type="button" class="unit-btn is-active" data-unit-mode="metric">mm</button>
          <button type="button" class="unit-btn" data-unit-mode="imperial">in</button>
        </div>
      </div>
      {layout}
    </section>
    """


def render_snowfall_table(data: List[Dict[str, str]]) -> str:
    if not data:
        return "<section><h2>Snowfall (cm)</h2><p>No data</p></section>"
    headers = [h for h in data[0].keys() if h != "matched_name"]
    weekly_headers = [h for h in headers if h.startswith("week")]
    daily_headers = [h for h in headers if h.startswith("day_")]
    layout = _render_desktop_and_mobile(
        data,
        weekly_headers,
        daily_headers,
        desktop_renderer=render_snowfall_desktop_layout,
        mobile_renderer=render_snowfall_mobile_layout,
    )
    return f"""
    <section>
      <div class="section-header">
        <h2>Snowfall</h2>
        <div class="unit-toggle" role="group" aria-label="Snowfall unit system" data-target-kind="snow">
          <button type="button" class="unit-btn is-active" data-unit-mode="metric">cm</button>
          <button type="button" class="unit-btn" data-unit-mode="imperial">in</button>
        </div>
      </div>
      {layout}
    </section>
    """


def render_temperature_table(data: List[Dict[str, str]]) -> str:
    if not data:
        return "<section><h2>Temperature (°C)</h2><p>No data</p></section>"

    # Temperature currently has no mobile renderer; fallback is desktop layout.
    return f"""
    <section>
      <div class="section-header">
        <h2>Temperature</h2>
        <div class="unit-toggle" role="group" aria-label="Temperature unit system" data-target-kind="temp">
          <button type="button" class="unit-btn is-active" data-unit-mode="metric">°C</button>
          <button type="button" class="unit-btn" data-unit-mode="imperial">°F</button>
        </div>
      </div>
      {render_temperature_desktop_layout(data)}
    </section>
    """
