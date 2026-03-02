#!/usr/bin/env python3
from __future__ import annotations

import html
from typing import Dict, List, Optional


def to_float(value: str) -> Optional[float]:
    v = (value or "").strip()
    if v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def snow_color(v: Optional[float]) -> str:
    if v is None:
        return ""
    if v > 15:
        return "background:#FFE7CC;"
    x = min(max(v, 0.0), 15.0) / 15.0
    r = round(255 + (207 - 255) * x)
    g = round(255 + (232 - 255) * x)
    b = round(255 + (255 - 255) * x)
    return f"background:rgb({r},{g},{b});"


def temp_color(v: Optional[float]) -> str:
    if v is None:
        return ""
    if v < -10:
        return "background:#CFE8FF;"
    if v < 0:
        x = (v + 10.0) / 10.0
        r = round(207 + (255 - 207) * x)
        g = round(232 + (255 - 232) * x)
        b = round(255 + (255 - 255) * x)
        return f"background:rgb({r},{g},{b});"
    if v <= 10:
        if v <= 0:
            return "background:#FFFFFF;"
        x = v / 10.0
        r = round(255 + (255 - 255) * x)
        g = round(255 + (214 - 255) * x)
        b = round(255 + (214 - 255) * x)
        return f"background:rgb({r},{g},{b});"
    return "background:#FFD6D6;"


def rain_color(v: Optional[float]) -> str:
    if v is None:
        return ""
    if v <= 0:
        return "background:#FFFFFF;"
    if v >= 10:
        return "background:#CFEFD8;"
    x = v / 10.0
    r = round(255 + (207 - 255) * x)
    g = round(255 + (239 - 255) * x)
    b = round(255 + (216 - 255) * x)
    return f"background:rgb({r},{g},{b});"


def render_rain_table(data: List[Dict[str, str]]) -> str:
    if not data:
        return "<section><h2>Rainfall (mm)</h2><p>No data</p></section>"

    headers = [h for h in data[0].keys() if h != "matched_name"]
    daily_headers = [h for h in headers if h.startswith("day_")]

    def short_label(name: str) -> str:
        if name.startswith("day_") and name.endswith("_rain_mm"):
            idx = name[len("day_"):].split("_", 1)[0]
            return f"day {idx}"
        return name

    left_rows: List[List[str]] = []
    right_rows: List[List[str]] = []
    for r in data:
        left_rows.append([f"<td class='query-col'>{html.escape(r.get('query', ''))}</td>"])
        rcells = []
        for h in daily_headers:
            val = r.get(h, "")
            style = ""
            if h.endswith("_rain_mm"):
                style = rain_color(to_float(val))
            rcells.append(f"<td style='{style}'>{html.escape(val)}</td>")
        right_rows.append(rcells)

    left_tbody = "".join(f"<tr>{''.join(row)}</tr>" for row in left_rows)
    right_tbody = "".join(f"<tr>{''.join(row)}</tr>" for row in right_rows)
    right_header = "<tr>" + "".join(f"<th>{html.escape(short_label(h))}</th>" for h in daily_headers) + "</tr>"
    return f"""
    <section>
      <h2>Rainfall (mm)</h2>
      <div class="rain-split-wrap">
        <div class="rain-left-wrap" id="rain-left-wrap">
          <table class="rain-left-table">
            <colgroup><col class="col-query"></colgroup>
            <thead><tr><th class='query-col'>Resort</th></tr></thead>
            <tbody>{left_tbody}</tbody>
          </table>
        </div>
        <div class="rain-right-wrap" id="rain-right-wrap">
          <table class="rain-right-table">
            <colgroup>
              {"".join("<col class='col-day'>" for _ in daily_headers)}
            </colgroup>
            <thead>{right_header}</thead>
            <tbody>{right_tbody}</tbody>
          </table>
        </div>
      </div>
    </section>
    """


def render_snowfall_table(data: List[Dict[str, str]]) -> str:
    if not data:
        return "<section><h2>Snowfall (cm)</h2><p>No data</p></section>"
    headers = [h for h in data[0].keys() if h != "matched_name"]
    weekly_headers = [h for h in headers if h.startswith("week")]
    daily_headers = [h for h in headers if h.startswith("day_")]

    desktop_left_rows: List[List[str]] = []
    desktop_right_rows: List[List[str]] = []
    mobile_left_rows: List[str] = []
    mobile_right_rows: List[str] = []

    for r in data:
        d_left_cells = []
        d_right_cells = []
        m_left = f"<tr><td class='query-col'>{html.escape(r.get('query', ''))}</td></tr>"
        m_right_cells = []

        for h in ["query"] + weekly_headers:
            val = r.get(h, "")
            style = ""
            if h.endswith("_cm") and h != "query":
                style = snow_color(to_float(val))
            klass = "query-col" if h == "query" else ""
            d_left_cells.append(f"<td class='{klass}' style='{style}'>{html.escape(val)}</td>")

        for h in daily_headers:
            val = r.get(h, "")
            style = snow_color(to_float(val)) if h.endswith("_cm") else ""
            d_right_cells.append(f"<td style='{style}'>{html.escape(val)}</td>")

        for h in weekly_headers:
            val = r.get(h, "")
            style = snow_color(to_float(val)) if h.endswith("_cm") else ""
            m_right_cells.append(f"<td class='week-col-cell' style='{style}'>{html.escape(val)}</td>")
        for h in daily_headers:
            val = r.get(h, "")
            style = snow_color(to_float(val)) if h.endswith("_cm") else ""
            m_right_cells.append(f"<td style='{style}'>{html.escape(val)}</td>")

        desktop_left_rows.append(d_left_cells)
        desktop_right_rows.append(d_right_cells)
        mobile_left_rows.append(m_left)
        mobile_right_rows.append("<tr>" + "".join(m_right_cells) + "</tr>")

    desktop_left_tbody = "".join(f"<tr>{''.join(row)}</tr>" for row in desktop_left_rows)
    desktop_right_tbody = "".join(f"<tr>{''.join(row)}</tr>" for row in desktop_right_rows)

    left_group = (
        "<tr>"
        "<th rowspan='2' class='query-col'>Resort</th>"
        f"<th colspan='{len(weekly_headers)}'>weekly</th>"
        "</tr>"
    )

    def short_label(name: str) -> str:
        if name.startswith("week") and name.endswith("_total_cm"):
            idx = name[len("week"):].split("_", 1)[0]
            return f"week {idx}"
        if name.startswith("day_") and name.endswith("_cm"):
            idx = name[len("day_"):].split("_", 1)[0]
            return f"day {idx}"
        return name

    left_detail = "<tr>" + "".join(f"<th>{html.escape(short_label(h))}</th>" for h in weekly_headers) + "</tr>"
    desktop_right_group = f"<tr><th colspan='{len(daily_headers)}'>daily</th></tr>"
    desktop_right_detail = "<tr>" + "".join(f"<th>{html.escape(short_label(h))}</th>" for h in daily_headers) + "</tr>"
    mobile_left_head = "<tr><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr>"
    mobile_right_group = (
        f"<tr><th class='week-group' colspan='{len(weekly_headers)}'>weekly</th>"
        f"<th colspan='{len(daily_headers)}'>daily</th></tr>"
    )
    mobile_right_detail = (
        "<tr>"
        + "".join(f"<th class='week-col-cell'>{html.escape(short_label(h))}</th>" for h in weekly_headers)
        + "".join(f"<th>{html.escape(short_label(h))}</th>" for h in daily_headers)
        + "</tr>"
    )

    return f"""
    <section>
      <h2>Snowfall (cm)</h2>
      <div class="snowfall-split-wrap desktop-only">
        <div class="snowfall-left-wrap" id="snowfall-left-wrap">
          <table class="snowfall-left-table">
            <colgroup>
              <col class='col-query'>
              <col class='col-week'>
              <col class='col-week'>
            </colgroup>
            <thead>{left_group}{left_detail}</thead>
            <tbody>{desktop_left_tbody}</tbody>
          </table>
        </div>
        <div class="snowfall-right-wrap" id="snowfall-right-wrap">
          <table class="snowfall-right-table">
            <colgroup>
              {"".join("<col class='col-day'>" for _ in daily_headers)}
            </colgroup>
            <thead>{desktop_right_group}{desktop_right_detail}</thead>
            <tbody>{desktop_right_tbody}</tbody>
          </table>
        </div>
      </div>
      <div class="snowfall-split-wrap mobile-only">
        <div class="snowfall-left-wrap" id="snowfall-left-wrap-mobile">
          <table class="snowfall-left-table">
            <colgroup>
              <col class='col-query'>
            </colgroup>
            <thead>{mobile_left_head}</thead>
            <tbody>{"".join(mobile_left_rows)}</tbody>
          </table>
        </div>
        <div class="snowfall-right-wrap" id="snowfall-right-wrap-mobile">
          <table class="snowfall-right-table">
            <colgroup>
              {"".join("<col class='col-week-right'>" for _ in weekly_headers)}
              {"".join("<col class='col-day'>" for _ in daily_headers)}
            </colgroup>
            <thead>{mobile_right_group}{mobile_right_detail}</thead>
            <tbody>{"".join(mobile_right_rows)}</tbody>
          </table>
        </div>
      </div>
    </section>
    """


def render_temperature_table(data: List[Dict[str, str]]) -> str:
    if not data:
        return "<section><h2>Temperature (°C)</h2><p>No data</p></section>"
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

    left_head = "<tr><th class='query-col query-top'>Resort</th></tr><tr><th class='query-sub'>&nbsp;</th></tr>"
    right_group = "<tr>" + "".join(f"<th colspan='2'>day {d}</th>" for d in days) + "</tr>"
    right_detail = "<tr>" + "".join("<th>min</th><th>max</th>" for _ in days) + "</tr>"

    left_rows: List[str] = []
    right_rows: List[str] = []
    for r in data:
        left_rows.append(f"<tr><td class='query-col'>{html.escape(r.get('query', ''))}</td></tr>")
        cells: List[str] = []
        for d in days:
            min_h = min_by_day.get(d)
            max_h = max_by_day.get(d)
            min_v = r.get(min_h, "") if min_h else ""
            max_v = r.get(max_h, "") if max_h else ""
            min_style = temp_color(to_float(min_v)) if min_h else ""
            max_style = temp_color(to_float(max_v)) if max_h else ""
            cells.append(f"<td style='{min_style}'>{html.escape(min_v)}</td>")
            cells.append(f"<td style='{max_style}'>{html.escape(max_v)}</td>")
        right_rows.append("<tr>" + "".join(cells) + "</tr>")

    return f"""
    <section>
      <h2>Temperature (°C)</h2>
      <div class="temperature-split-wrap">
        <div class="temperature-left-wrap" id="temperature-left-wrap">
          <table class="temperature-left-table" id="temperature-left-table">
            <colgroup><col class="col-query"></colgroup>
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
    </section>
    """
