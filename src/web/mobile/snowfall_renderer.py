#!/usr/bin/env python3
from __future__ import annotations

import html
from typing import Dict, List

from src.web.weather_table_styles import snow_color, to_float


def _short_label(name: str) -> str:
    if name.startswith("week") and name.endswith("_total_cm"):
        idx = name[len("week"):].split("_", 1)[0]
        return f"week {idx}"
    if name.startswith("day_") and name.endswith("_cm"):
        idx = name[len("day_"):].split("_", 1)[0]
        if idx == "1":
            return "today"
        return f"day {idx}"
    return name


def render_snowfall_mobile_layout(
    data: List[Dict[str, str]],
    weekly_headers: List[str],
    daily_headers: List[str],
) -> str:
    left_rows: List[str] = []
    right_rows: List[str] = []
    for row in data:
        left_rows.append(f"<tr><td class='query-col'>{html.escape(row.get('query', ''))}</td></tr>")
        right_cells: List[str] = []

        for header in weekly_headers:
            val = row.get(header, "")
            style = snow_color(to_float(val)) if header.endswith("_cm") else ""
            right_cells.append(f"<td class='week-col-cell' style='{style}'>{html.escape(val)}</td>")
        for header in daily_headers:
            val = row.get(header, "")
            style = snow_color(to_float(val)) if header.endswith("_cm") else ""
            right_cells.append(f"<td style='{style}'>{html.escape(val)}</td>")

        right_rows.append("<tr>" + "".join(right_cells) + "</tr>")

    left_head = "<tr><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr>"
    right_group = (
        f"<tr><th class='week-group' colspan='{len(weekly_headers)}'>weekly</th>"
        f"<th colspan='{len(daily_headers)}'>daily</th></tr>"
    )
    right_detail = (
        "<tr>"
        + "".join(f"<th class='week-col-cell'>{html.escape(_short_label(h))}</th>" for h in weekly_headers)
        + "".join(f"<th>{html.escape(_short_label(h))}</th>" for h in daily_headers)
        + "</tr>"
    )

    return f"""
      <div class="snowfall-split-wrap mobile-only">
        <div class="snowfall-left-wrap" id="snowfall-left-wrap-mobile">
          <table class="snowfall-left-table">
            <colgroup>
              <col class='col-query'>
            </colgroup>
            <thead>{left_head}</thead>
            <tbody>{"".join(left_rows)}</tbody>
          </table>
        </div>
        <div class="snowfall-right-wrap" id="snowfall-right-wrap-mobile">
          <table class="snowfall-right-table">
            <colgroup>
              {"".join("<col class='col-week-right'>" for _ in weekly_headers)}
              {"".join("<col class='col-day'>" for _ in daily_headers)}
            </colgroup>
            <thead>{right_group}{right_detail}</thead>
            <tbody>{"".join(right_rows)}</tbody>
          </table>
        </div>
      </div>
    """
