#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
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


@dataclass(frozen=True)
class MetricViewConfig:
    title: str
    kind: str
    metric_unit: str
    imperial_unit: str
    desktop_renderer: LayoutRenderer
    mobile_renderer: Optional[LayoutRenderer]
    has_weekly: bool = True


def _render_temperature_desktop_adapter(
    data: List[Dict[str, str]],
    weekly_headers: List[str],
    daily_headers: List[str],
) -> str:
    del weekly_headers, daily_headers
    return render_temperature_desktop_layout(data)


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


def _extract_headers(data: List[Dict[str, str]], has_weekly: bool) -> tuple[List[str], List[str]]:
    headers = [h for h in data[0].keys() if h != "matched_name"]
    weekly_headers = [h for h in headers if h.startswith("week")] if has_weekly else []
    daily_headers = [h for h in headers if h.startswith("day_")]
    return weekly_headers, daily_headers


def _render_section_layout(data: List[Dict[str, str]], cfg: MetricViewConfig) -> str:
    weekly_headers, daily_headers = _extract_headers(data, has_weekly=cfg.has_weekly)
    layout = _render_desktop_and_mobile(
        data,
        weekly_headers,
        daily_headers,
        desktop_renderer=cfg.desktop_renderer,
        mobile_renderer=cfg.mobile_renderer,
    )
    return layout


def _render_metric_section(data: List[Dict[str, str]], cfg: MetricViewConfig) -> str:
    if not data:
        return f"<section><h2>{cfg.title}</h2><p>No data</p></section>"

    layout = _render_section_layout(data, cfg)
    return f"""
    <section>
      <div class="section-header">
        <h2>{cfg.title}</h2>
        <div class="unit-toggle" role="group" aria-label="{cfg.title} unit system" data-target-kind="{cfg.kind}">
          <button type="button" class="unit-btn is-active" data-unit-mode="metric">{cfg.metric_unit}</button>
          <button type="button" class="unit-btn" data-unit-mode="imperial">{cfg.imperial_unit}</button>
        </div>
      </div>
      {layout}
    </section>
    """


_RAINFALL_VIEW = MetricViewConfig(
    title="Rainfall",
    kind="rain",
    metric_unit="mm",
    imperial_unit="in",
    desktop_renderer=render_rainfall_desktop_layout,
    mobile_renderer=render_rainfall_mobile_layout,
)

_SNOWFALL_VIEW = MetricViewConfig(
    title="Snowfall",
    kind="snow",
    metric_unit="cm",
    imperial_unit="in",
    desktop_renderer=render_snowfall_desktop_layout,
    mobile_renderer=render_snowfall_mobile_layout,
)

_TEMPERATURE_VIEW = MetricViewConfig(
    title="Temperature",
    kind="temp",
    metric_unit="°C",
    imperial_unit="°F",
    desktop_renderer=_render_temperature_desktop_adapter,
    mobile_renderer=None,
    has_weekly=False,
)


def render_rain_table(data: List[Dict[str, str]]) -> str:
    return _render_metric_section(data, _RAINFALL_VIEW)


def render_snowfall_table(data: List[Dict[str, str]]) -> str:
    return _render_metric_section(data, _SNOWFALL_VIEW)


def render_temperature_table(data: List[Dict[str, str]]) -> str:
    return _render_metric_section(data, _TEMPERATURE_VIEW)
