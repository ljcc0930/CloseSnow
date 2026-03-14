#!/usr/bin/env python3
from __future__ import annotations

import html
from typing import Callable, Dict, List, Optional

from src.web.day_label_html import render_day_label_html
from src.web.resort_cell_renderer import favorite_all_head_html, filter_attrs, resort_cells_html
from src.web.weather_table_styles import render_measure_cell, to_float

ColorFn = Callable[[Optional[float]], str]


def short_label(name: str, weekly_suffix: str, daily_suffix: str) -> str:
    if name.startswith("week") and name.endswith(weekly_suffix):
        idx = name[len("week"):].split("_", 1)[0]
        return f"week {idx}"
    if name.startswith("day_") and name.endswith(daily_suffix):
        idx = name[len("day_"):].split("_", 1)[0]
        if idx == "1":
            return "today"
        return f"day {idx}"
    return name


def _day_index_from_header(name: str, daily_suffix: str) -> Optional[int]:
    if not (name.startswith("day_") and name.endswith(daily_suffix)):
        return None
    try:
        return int(name[len("day_"):].split("_", 1)[0])
    except (TypeError, ValueError):
        return None


def _daily_header_label(
    header: str,
    *,
    daily_suffix: str,
    sample_row: Optional[Dict[str, str]],
    weekly_suffix: str,
) -> str:
    day_idx = _day_index_from_header(header, daily_suffix)
    if day_idx is not None and sample_row:
        label = sample_row.get(f"label_day_{day_idx}", "").strip()
        if label:
            return label
    return short_label(header, weekly_suffix, daily_suffix)


def _style_for_value(header: str, value: str, suffix: str, color_fn: ColorFn) -> str:
    if header.endswith(suffix):
        return color_fn(to_float(value))
    return ""


def render_desktop_split_metric_layout(
    data: List[Dict[str, str]],
    weekly_headers: List[str],
    daily_headers: List[str],
    *,
    table_prefix: str,
    kind: str,
    weekly_suffix: str,
    daily_suffix: str,
    color_fn: ColorFn,
) -> str:
    left_rows: List[tuple[str, List[str]]] = []
    right_rows: List[tuple[str, List[str]]] = []
    for row in data:
        left_cells: List[str] = []
        right_cells: List[str] = []

        for header in ["query"] + weekly_headers:
            if header == "query":
                left_cells.append(resort_cells_html(row))
                continue
            val = row.get(header, "")
            style = _style_for_value(header, val, weekly_suffix, color_fn)
            left_cells.append(render_measure_cell(val, kind=kind, style=style))

        for header in daily_headers:
            val = row.get(header, "")
            style = _style_for_value(header, val, daily_suffix, color_fn)
            right_cells.append(render_measure_cell(val, kind=kind, style=style))

        attrs = filter_attrs(row)
        left_rows.append((attrs, left_cells))
        right_rows.append((attrs, right_cells))

    left_tbody = "".join(f"<tr{attrs}>{''.join(cells)}</tr>" for attrs, cells in left_rows)
    right_tbody = "".join(f"<tr{attrs}>{''.join(cells)}</tr>" for attrs, cells in right_rows)
    sample_row = data[0] if data else None
    left_group = (
        "<tr>"
        f"<th rowspan='2' class='favorite-col favorite-head'>{favorite_all_head_html()}</th>"
        "<th rowspan='2' class='query-col'>Resort</th>"
        f"<th colspan='{len(weekly_headers)}'>Weekly</th>"
        "</tr>"
    )
    left_detail = (
        "<tr>"
        + "".join(f"<th>{html.escape(short_label(h, weekly_suffix, daily_suffix))}</th>" for h in weekly_headers)
        + "</tr>"
    )
    right_group = f"<tr><th colspan='{len(daily_headers)}'>Daily</th></tr>"
    right_detail = (
        "<tr>"
        + "".join(
            f"<th>{render_day_label_html(_daily_header_label(h, daily_suffix=daily_suffix, sample_row=sample_row, weekly_suffix=weekly_suffix))}</th>"
            for h in daily_headers
        )
        + "</tr>"
    )

    return f"""
      <div class="{table_prefix}-split-wrap desktop-only">
        <div class="{table_prefix}-left-wrap" id="{table_prefix}-left-wrap">
          <table class="{table_prefix}-left-table">
            <colgroup>
              <col class='col-favorite'>
              <col class='col-query'>
              {"".join("<col class='col-week'>" for _ in weekly_headers)}
            </colgroup>
            <thead>{left_group}{left_detail}</thead>
            <tbody>{left_tbody}</tbody>
          </table>
        </div>
        <div class="{table_prefix}-right-wrap" id="{table_prefix}-right-wrap">
          <table class="{table_prefix}-right-table">
            <colgroup>
              {"".join("<col class='col-day'>" for _ in daily_headers)}
            </colgroup>
            <thead>{right_group}{right_detail}</thead>
            <tbody>{right_tbody}</tbody>
          </table>
        </div>
      </div>
    """


def render_mobile_split_metric_layout(
    data: List[Dict[str, str]],
    weekly_headers: List[str],
    daily_headers: List[str],
    *,
    table_prefix: str,
    kind: str,
    weekly_suffix: str,
    daily_suffix: str,
    color_fn: ColorFn,
) -> str:
    left_rows: List[str] = []
    right_rows: List[str] = []
    for row in data:
        attrs = filter_attrs(row)
        left_rows.append(f"<tr{attrs}>{resort_cells_html(row)}</tr>")
        right_cells: List[str] = []

        for header in weekly_headers:
            val = row.get(header, "")
            style = _style_for_value(header, val, weekly_suffix, color_fn)
            right_cells.append(render_measure_cell(val, kind=kind, style=style, klass="week-col-cell"))
        for header in daily_headers:
            val = row.get(header, "")
            style = _style_for_value(header, val, daily_suffix, color_fn)
            right_cells.append(render_measure_cell(val, kind=kind, style=style))

        right_rows.append("<tr" + attrs + ">" + "".join(right_cells) + "</tr>")

    left_head = f"<tr><th rowspan='2' class='favorite-col favorite-head'>{favorite_all_head_html()}</th><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr>"
    sample_row = data[0] if data else None
    right_group = (
        f"<tr><th class='week-group' colspan='{len(weekly_headers)}'>Weekly</th>"
        f"<th colspan='{len(daily_headers)}'>Daily</th></tr>"
    )
    right_detail = (
        "<tr>"
        + "".join(
            f"<th class='week-col-cell'>{html.escape(short_label(h, weekly_suffix, daily_suffix))}</th>"
            for h in weekly_headers
        )
        + "".join(
            f"<th>{render_day_label_html(_daily_header_label(h, daily_suffix=daily_suffix, sample_row=sample_row, weekly_suffix=weekly_suffix))}</th>"
            for h in daily_headers
        )
        + "</tr>"
    )

    return f"""
      <div class="{table_prefix}-split-wrap mobile-only">
        <div class="{table_prefix}-left-wrap" id="{table_prefix}-left-wrap-mobile">
          <table class="{table_prefix}-left-table">
            <colgroup>
              <col class='col-favorite'>
              <col class='col-query'>
            </colgroup>
            <thead>{left_head}</thead>
            <tbody>{"".join(left_rows)}</tbody>
          </table>
        </div>
        <div class="{table_prefix}-right-wrap" id="{table_prefix}-right-wrap-mobile">
          <table class="{table_prefix}-right-table">
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
