#!/usr/bin/env python3
from __future__ import annotations

import html
from typing import Dict, List

from src.web.weather_table_styles import rain_color, render_measure_cell, to_float


def _short_label(name: str) -> str:
    if name.startswith("week") and name.endswith("_rain_mm"):
        idx = name[len("week"):].split("_", 1)[0]
        return f"week {idx}"
    if name.startswith("day_") and name.endswith("_rain_mm"):
        idx = name[len("day_"):].split("_", 1)[0]
        if idx == "1":
            return "today"
        return f"day {idx}"
    return name


def render_rainfall_desktop_layout(
    data: List[Dict[str, str]],
    weekly_headers: List[str],
    daily_headers: List[str],
) -> str:
    left_rows: List[List[str]] = []
    right_rows: List[List[str]] = []
    for row in data:
        left_cells: List[str] = []
        right_cells: List[str] = []

        for header in ["query"] + weekly_headers:
            val = row.get(header, "")
            style = ""
            if header.endswith("_rain_mm") and header != "query":
                style = rain_color(to_float(val))
            klass = "query-col" if header == "query" else ""
            left_cells.append(render_measure_cell(val, kind="rain", style=style, klass=klass))

        for header in daily_headers:
            val = row.get(header, "")
            style = rain_color(to_float(val)) if header.endswith("_rain_mm") else ""
            right_cells.append(render_measure_cell(val, kind="rain", style=style))

        left_rows.append(left_cells)
        right_rows.append(right_cells)

    left_tbody = "".join(f"<tr>{''.join(cells)}</tr>" for cells in left_rows)
    right_tbody = "".join(f"<tr>{''.join(cells)}</tr>" for cells in right_rows)
    left_group = (
        "<tr>"
        "<th rowspan='2' class='query-col'>Resort</th>"
        f"<th colspan='{len(weekly_headers)}'>weekly</th>"
        "</tr>"
    )
    left_detail = "<tr>" + "".join(f"<th>{html.escape(_short_label(h))}</th>" for h in weekly_headers) + "</tr>"
    right_group = f"<tr><th colspan='{len(daily_headers)}'>daily</th></tr>"
    right_detail = "<tr>" + "".join(f"<th>{html.escape(_short_label(h))}</th>" for h in daily_headers) + "</tr>"

    return f"""
      <div class="rain-split-wrap desktop-only">
        <div class="rain-left-wrap" id="rain-left-wrap">
          <table class="rain-left-table">
            <colgroup>
              <col class='col-query'>
              {"".join("<col class='col-week'>" for _ in weekly_headers)}
            </colgroup>
            <thead>{left_group}{left_detail}</thead>
            <tbody>{left_tbody}</tbody>
          </table>
        </div>
        <div class="rain-right-wrap" id="rain-right-wrap">
          <table class="rain-right-table">
            <colgroup>
              {"".join("<col class='col-day'>" for _ in daily_headers)}
            </colgroup>
            <thead>{right_group}{right_detail}</thead>
            <tbody>{right_tbody}</tbody>
          </table>
        </div>
      </div>
    """
