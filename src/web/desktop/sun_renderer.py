#!/usr/bin/env python3
from __future__ import annotations

import html
from typing import Dict, List
from urllib.parse import quote

from src.web.day_label_html import render_day_label_html


def _filter_attrs(row: Dict[str, str]) -> str:
    pass_types = html.escape(row.get("filter_pass_types", ""), quote=True)
    region = html.escape(row.get("filter_region", ""), quote=True)
    country = html.escape(row.get("filter_country", ""), quote=True)
    state = html.escape(row.get("filter_state", ""), quote=True)
    return f" data-pass-types='{pass_types}' data-region='{region}' data-country='{country}' data-state='{state}'"


def _query_cell(row: Dict[str, str]) -> str:
    query_text = html.escape(row.get("query", ""))
    resort_id = row.get("resort_id", "").strip()
    if resort_id:
        query_text = f"<a class='resort-link' href='resort/{quote(resort_id)}'>{query_text}</a>"
    return f"<td class='query-col'>{query_text}</td>"


def render_sunrise_sunset_desktop_layout(data: List[Dict[str, str]]) -> str:
    headers = [h for h in data[0].keys() if h != "matched_name"]
    sunrise_headers = [h for h in headers if h.startswith("day_") and h.endswith("_sunrise")]
    sunset_headers = [h for h in headers if h.startswith("day_") and h.endswith("_sunset")]

    def day_idx(name: str) -> int:
        try:
            return int(name.split("_")[1])
        except (IndexError, ValueError):
            return 0

    sunrise_headers.sort(key=day_idx)
    sunset_headers.sort(key=day_idx)
    sunrise_by_day = {day_idx(h): h for h in sunrise_headers}
    sunset_by_day = {day_idx(h): h for h in sunset_headers}
    days = sorted(set(sunrise_by_day.keys()) | set(sunset_by_day.keys()))
    sample_row = data[0] if data else {}

    def day_label(day: int) -> str:
        label = sample_row.get(f"label_day_{day}", "").strip() if sample_row else ""
        if label:
            return label
        if day == 1:
            return "today"
        return f"day {day}"

    left_head = "<tr><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr>"
    right_group = "<tr>" + "".join(f"<th colspan='2'>{render_day_label_html(day_label(d))}</th>" for d in days) + "</tr>"
    right_detail = "<tr>" + "".join("<th>sunrise</th><th>sunset</th>" for _ in days) + "</tr>"

    left_rows: List[str] = []
    right_rows: List[str] = []
    for row in data:
        attrs = _filter_attrs(row)
        left_rows.append(f"<tr{attrs}>{_query_cell(row)}</tr>")
        cells: List[str] = []
        for day in days:
            sunrise_h = sunrise_by_day.get(day)
            sunset_h = sunset_by_day.get(day)
            sunrise_v = row.get(sunrise_h, "") if sunrise_h else ""
            sunset_v = row.get(sunset_h, "") if sunset_h else ""
            cells.append(f"<td>{html.escape(sunrise_v)}</td>")
            cells.append(f"<td>{html.escape(sunset_v)}</td>")
        right_rows.append("<tr" + attrs + ">" + "".join(cells) + "</tr>")

    return f"""
      <div class="sun-split-wrap">
        <div class="sun-left-wrap" id="sun-left-wrap">
          <table class="sun-left-table" id="sun-left-table">
            <colgroup><col class="col-query"></colgroup>
            <thead>{left_head}</thead>
            <tbody>{"".join(left_rows)}</tbody>
          </table>
        </div>
        <div class="sun-right-wrap" id="sun-right-wrap">
          <table class="sun-right-table" id="sun-right-table">
            <colgroup>
              {"".join("<col class='col-sun'>" for _ in range(len(days) * 2))}
            </colgroup>
            <thead>{right_group}{right_detail}</thead>
            <tbody>{"".join(right_rows)}</tbody>
          </table>
        </div>
      </div>
    """
