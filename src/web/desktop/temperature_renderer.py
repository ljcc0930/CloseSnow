#!/usr/bin/env python3
from __future__ import annotations

from typing import Dict, List

from src.web.day_label_html import render_day_label_html
from src.web.resort_cell_renderer import favorite_all_head_html, filter_attrs, resort_cells_html
from src.web.weather_table_styles import render_measure_cell, temp_color, to_float


def render_temperature_desktop_layout(data: List[Dict[str, str]]) -> str:
    headers = [h for h in data[0].keys() if h != "matched_name"]
    max_headers = [h for h in headers if h.startswith("day_") and h.endswith("_max_c")]
    min_headers = [h for h in headers if h.startswith("day_") and h.endswith("_min_c")]

    def day_idx(name: str) -> int:
        try:
            return int(name.split("_")[1])
        except (IndexError, ValueError):
            return 0

    max_headers.sort(key=day_idx)
    min_headers.sort(key=day_idx)
    max_by_day = {day_idx(h): h for h in max_headers}
    min_by_day = {day_idx(h): h for h in min_headers}
    days = sorted(set(max_by_day.keys()) | set(min_by_day.keys()))
    sample_row = data[0] if data else {}

    def day_label(day: int) -> str:
        label = sample_row.get(f"label_day_{day}", "").strip() if sample_row else ""
        if label:
            return label
        if day == 1:
            return "today"
        return f"day {day}"

    left_head = f"<tr><th rowspan='2' class='favorite-col favorite-head'>{favorite_all_head_html()}</th><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr>"
    right_group = (
        "<tr>"
        + "".join(f"<th colspan='2'>{render_day_label_html(day_label(d))}</th>" for d in days)
        + "</tr>"
    )
    right_detail = "<tr>" + "".join("<th>min</th><th>max</th>" for _ in days) + "</tr>"

    left_rows: List[str] = []
    right_rows: List[str] = []
    for row in data:
        attrs = filter_attrs(row)
        left_rows.append(f"<tr{attrs}>{resort_cells_html(row)}</tr>")
        cells: List[str] = []
        for day in days:
            min_h = min_by_day.get(day)
            max_h = max_by_day.get(day)
            min_v = row.get(min_h, "") if min_h else ""
            max_v = row.get(max_h, "") if max_h else ""
            min_style = temp_color(to_float(min_v)) if min_h else ""
            max_style = temp_color(to_float(max_v)) if max_h else ""
            cells.append(render_measure_cell(min_v, kind="temp", style=min_style))
            cells.append(render_measure_cell(max_v, kind="temp", style=max_style))
        right_rows.append("<tr" + attrs + ">" + "".join(cells) + "</tr>")

    return f"""
      <div class="temperature-split-wrap">
        <div class="temperature-left-wrap" id="temperature-left-wrap">
          <table class="temperature-left-table" id="temperature-left-table">
            <colgroup><col class="col-favorite"><col class="col-query"></colgroup>
            <thead>{left_head}</thead>
            <tbody>{"".join(left_rows)}</tbody>
          </table>
        </div>
        <div class="temperature-right-wrap" id="temperature-right-wrap">
          <table class="temperature-right-table" id="temperature-right-table">
            <colgroup>
              {"".join("<col class='col-temp'>" for _ in range(len(days) * 2))}
            </colgroup>
            <thead>{right_group}{right_detail}</thead>
            <tbody>{"".join(right_rows)}</tbody>
          </table>
        </div>
      </div>
    """
