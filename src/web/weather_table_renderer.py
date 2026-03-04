#!/usr/bin/env python3
from __future__ import annotations

import html
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional
from urllib.parse import quote

from src.web.desktop.precipitation_renderer import (
    render_rainfall_desktop_layout,
    render_snowfall_desktop_layout,
)
from src.web.desktop.sun_renderer import render_sunrise_sunset_desktop_layout
from src.web.desktop.temperature_renderer import render_temperature_desktop_layout
from src.web.weather_code_emoji import emoji_for_weather_code

try:
    from src.web.mobile.precipitation_renderer import render_rainfall_mobile_layout
except ModuleNotFoundError:
    render_rainfall_mobile_layout = None

try:
    from src.web.mobile.precipitation_renderer import render_snowfall_mobile_layout
except ModuleNotFoundError:
    render_snowfall_mobile_layout = None

LayoutRenderer = Callable[[List[Dict[str, str]], List[str], List[str]], str]


def _filter_attrs(row: Dict[str, str]) -> str:
    pass_types = html.escape(row.get("filter_pass_types", ""), quote=True)
    region = html.escape(row.get("filter_region", ""), quote=True)
    country = html.escape(row.get("filter_country", ""), quote=True)
    state = html.escape(row.get("filter_state", ""), quote=True)
    return f" data-pass-types='{pass_types}' data-region='{region}' data-country='{country}' data-state='{state}'"


def _query_cell_html(row: Dict[str, str]) -> str:
    text = html.escape(row.get("query", ""))
    resort_id = row.get("resort_id", "").strip()
    if resort_id:
        text = f"<a class='resort-link' href='resort/{quote(resort_id)}'>{text}</a>"
    return f"<td class='query-col'>{text}</td>"


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


def render_sun_table(data: List[Dict[str, str]]) -> str:
    if not data:
        return "<section><h2>Sunrise / Sunset</h2><p>No data</p></section>"
    return (
        "<section>"
        "<h2>Sunrise / Sunset</h2>"
        f"{render_sunrise_sunset_desktop_layout(data)}"
        "</section>"
    )


def render_weather_table(data: List[Dict[str, str]]) -> str:
    if not data:
        return "<section><h2>Weather</h2><p>No data</p></section>"

    first = data[0]
    day_headers = [h for h in first.keys() if h.startswith("day_") and h.endswith("_weather_code")]

    def day_idx(header: str) -> int:
        try:
            return int(header.split("_")[1])
        except (TypeError, ValueError, IndexError):
            return 0

    day_headers.sort(key=day_idx)

    day_head_cells: List[str] = []
    for header in day_headers:
        idx = day_idx(header)
        label = first.get(f"label_day_{idx}", "").strip()
        if not label:
            label = "today" if idx == 1 else f"day {idx}"
        day_head_cells.append(f"<th>{html.escape(label)}</th>")

    left_rows: List[str] = []
    right_rows: List[str] = []
    for row in data:
        attrs = _filter_attrs(row)
        left_rows.append(f"<tr{attrs}>{_query_cell_html(row)}</tr>")
        cells: List[str] = []
        for header in day_headers:
            code = row.get(header, "").strip()
            emoji = emoji_for_weather_code(code if code else None)
            title = f"WMO code: {code}" if code else "WMO code: unknown"
            cells.append(f"<td class='weather-emoji-cell' title='{html.escape(title)}'>{emoji}</td>")
        right_rows.append("<tr" + attrs + ">" + "".join(cells) + "</tr>")

    left_head = "<tr><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr>"
    right_group = f"<tr><th colspan='{len(day_headers)}'>daily</th></tr>"
    right_detail = f"<tr>{''.join(day_head_cells)}</tr>"

    return (
        "<section>"
        "<h2>Weather</h2>"
        "<div class='weather-split-wrap'>"
        "<div class='weather-left-wrap' id='weather-left-wrap'>"
        "<table class='weather-left-table' id='weather-left-table'>"
        "<colgroup><col class='col-query'></colgroup>"
        f"<thead>{left_head}</thead>"
        f"<tbody>{''.join(left_rows)}</tbody>"
        "</table>"
        "</div>"
        "<div class='weather-right-wrap' id='weather-right-wrap'>"
        "<table class='weather-right-table' id='weather-right-table'>"
        "<colgroup>"
        + "".join("<col class='col-weather'>" for _ in day_headers)
        + "</colgroup>"
        f"<thead>{right_group}{right_detail}</thead>"
        f"<tbody>{''.join(right_rows)}</tbody>"
        "</table>"
        "</div>"
        "</div>"
        "</section>"
    )
