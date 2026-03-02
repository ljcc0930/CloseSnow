#!/usr/bin/env python3
from __future__ import annotations

import html
from datetime import datetime, timezone
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
    # < -10C: light blue
    if v < -10:
        return "background:#CFE8FF;"
    # -10..0C: light blue -> white
    if v < 0:
        x = (v + 10.0) / 10.0
        r = round(207 + (255 - 207) * x)
        g = round(232 + (255 - 232) * x)
        b = round(255 + (255 - 255) * x)
        return f"background:rgb({r},{g},{b});"
    # 0..10C: white -> light red
    if v <= 10:
        if v <= 0:
            return "background:#FFFFFF;"
        x = v / 10.0
        r = round(255 + (255 - 255) * x)
        g = round(255 + (214 - 255) * x)
        b = round(255 + (214 - 255) * x)
        return f"background:rgb({r},{g},{b});"
    # >10C: light red
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
    unified_header = "<tr><th class='query-col'>resort</th>" + "".join(
        f"<th>{html.escape(short_label(h))}</th>" for h in daily_headers
    ) + "</tr>"
    unified_rows = []
    for row in data:
        cells = [f"<td class='query-col'>{html.escape(row.get('query', ''))}</td>"]
        for h in daily_headers:
            val = row.get(h, "")
            style = rain_color(to_float(val))
            cells.append(f"<td style='{style}'>{html.escape(val)}</td>")
        unified_rows.append("<tr>" + "".join(cells) + "</tr>")

    return f"""
    <section>
      <h2>Rainfall (mm)</h2>
      <div class="rain-split-wrap desktop-only">
        <div class="rain-left-wrap" id="rain-left-wrap">
          <table class="rain-left-table">
            <colgroup><col class="col-query"></colgroup>
            <thead><tr><th class='query-col'>resort</th></tr></thead>
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
      <div class="table-wrap mobile-only rain-unified-wrap">
        <table class="plain-table rain-unified-table">
          <thead>{unified_header}</thead>
          <tbody>{"".join(unified_rows)}</tbody>
        </table>
      </div>
    </section>
    """


def render_snowfall_table(data: List[Dict[str, str]]) -> str:
    if not data:
        return "<section><h2>Snowfall (cm)</h2><p>No data</p></section>"
    headers = [h for h in data[0].keys() if h != "matched_name"]
    weekly_headers = [h for h in headers if h.startswith("week")]
    daily_headers = [h for h in headers if h.startswith("day_")]

    left_rows: List[List[str]] = []
    right_rows: List[List[str]] = []
    for r in data:
        left_cells = []
        right_cells = []
        for h in ["query"] + weekly_headers:
            val = r.get(h, "")
            style = ""
            if h.endswith("_cm") and h != "query":
                style = snow_color(to_float(val))
            klass = "query-col" if h == "query" else ""
            left_cells.append(f"<td class='{klass}' style='{style}'>{html.escape(val)}</td>")
        for h in daily_headers:
            val = r.get(h, "")
            style = snow_color(to_float(val)) if h.endswith("_cm") else ""
            right_cells.append(f"<td style='{style}'>{html.escape(val)}</td>")
        left_rows.append(left_cells)
        right_rows.append(right_cells)

    left_tbody = "".join(f"<tr>{''.join(row)}</tr>" for row in left_rows)
    right_tbody = "".join(f"<tr>{''.join(row)}</tr>" for row in right_rows)

    left_group = (
        "<tr>"
        "<th rowspan='2' class='query-col'>resort</th>"
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

    right_group = f"<tr><th colspan='{len(daily_headers)}'>daily</th></tr>"
    right_detail = "<tr>" + "".join(f"<th>{html.escape(short_label(h))}</th>" for h in daily_headers) + "</tr>"

    unified_header = "<tr><th class='query-col'>resort</th>" + "".join(
        f"<th>{html.escape(short_label(h))}</th>" for h in weekly_headers + daily_headers
    ) + "</tr>"
    unified_rows = []
    for row in data:
        cells = [f"<td class='query-col'>{html.escape(row.get('query', ''))}</td>"]
        for h in weekly_headers + daily_headers:
            val = row.get(h, "")
            style = snow_color(to_float(val)) if h.endswith("_cm") else ""
            cells.append(f"<td style='{style}'>{html.escape(val)}</td>")
        unified_rows.append("<tr>" + "".join(cells) + "</tr>")

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
            <tbody>{left_tbody}</tbody>
          </table>
        </div>
        <div class="snowfall-right-wrap" id="snowfall-right-wrap">
          <table class="snowfall-right-table">
            <colgroup>
              {"".join("<col class='col-day'>" for _ in daily_headers)}
            </colgroup>
            <thead>{right_group}{right_detail}</thead>
            <tbody>{right_tbody}</tbody>
          </table>
        </div>
      </div>
      <div class="table-wrap mobile-only snowfall-unified-wrap">
        <table class="plain-table snowfall-unified-table">
          <thead>{unified_header}</thead>
          <tbody>{"".join(unified_rows)}</tbody>
        </table>
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

    left_head = "<tr><th class='query-col query-top'>resort</th></tr><tr><th class='query-sub'>&nbsp;</th></tr>"
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

    unified_header_cells = ["<th class='query-col'>resort</th>"]
    for d in days:
        unified_header_cells.append(f"<th>day {d} min</th>")
        unified_header_cells.append(f"<th>day {d} max</th>")
    unified_rows = []
    for row in data:
        cells = [f"<td class='query-col'>{html.escape(row.get('query', ''))}</td>"]
        for d in days:
            min_h = min_by_day.get(d)
            max_h = max_by_day.get(d)
            min_v = row.get(min_h, "") if min_h else ""
            max_v = row.get(max_h, "") if max_h else ""
            min_style = temp_color(to_float(min_v)) if min_h else ""
            max_style = temp_color(to_float(max_v)) if max_h else ""
            cells.append(f"<td style='{min_style}'>{html.escape(min_v)}</td>")
            cells.append(f"<td style='{max_style}'>{html.escape(max_v)}</td>")
        unified_rows.append("<tr>" + "".join(cells) + "</tr>")

    return f"""
    <section>
      <h2>Temperature (°C)</h2>
      <div class="temperature-split-wrap desktop-only">
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
      <div class="table-wrap mobile-only temperature-unified-wrap">
        <table class="plain-table temperature-unified-table">
          <thead><tr>{"".join(unified_header_cells)}</tr></thead>
          <tbody>{"".join(unified_rows)}</tbody>
        </table>
      </div>
    </section>
    """


def build_html(snowfall: List[Dict[str, str]], rain: List[Dict[str, str]], temp: List[Dict[str, str]]) -> str:
    snow_table = render_snowfall_table(snowfall)
    rain_table = render_rain_table(rain)
    temp_table = render_temperature_table(temp)
    now_utc = datetime.now(timezone.utc)
    generated_utc_iso = now_utc.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    generated_utc_text = now_utc.strftime("%Y-%m-%d %H:%M:%S UTC")
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ski Weather Report</title>
  <style>
    body {{
      margin: 0;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      color: #1f2937;
      background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
    }}
    main {{
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }}
    h1 {{
      margin: 0 0 16px;
      font-size: 28px;
    }}
    .report-date {{
      margin: -8px 0 12px;
      font-size: 13px;
      color: #475569;
      font-weight: 600;
    }}
    h2 {{
      margin: 24px 0 8px;
      font-size: 20px;
    }}
    .table-wrap {{
      overflow: auto;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 6px 24px rgba(0,0,0,0.06);
    }}
    table {{
      border-collapse: separate;
      border-spacing: 0;
      width: max-content;
    }}
    th, td {{
      border-bottom: 1px solid #e5e7eb;
      border-right: 1px solid #f3f4f6;
      padding: clamp(6px, 1.1vw, 8px) clamp(8px, 1.3vw, 10px);
      line-height: 1.2;
      font-size: 12px;
      text-align: right;
      white-space: nowrap;
    }}
    th {{
      background: #f3f4f6;
      text-align: center;
      font-weight: 700;
    }}
    .plain-table thead th {{
      position: sticky;
      top: 0;
      z-index: 2;
    }}
    .plain-table {{
      min-width: 1100px;
    }}
    .plain-table .query-col {{
      text-align: left;
      font-weight: 600;
    }}
    .desktop-only {{
      display: block;
    }}
    .mobile-only {{
      display: none;
    }}
    .snowfall-split-wrap {{
      display: flex;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 6px 24px rgba(0,0,0,0.06);
      overflow: hidden;
    }}
    .snowfall-left-wrap {{
      flex: 0 0 auto;
      border-right: 3px solid #94a3b8;
      background: #fff;
      overflow: hidden;
      --query-col-w: 220px;
      --week-col-w: 110px;
    }}
    .snowfall-left-table col.col-query {{
      width: var(--query-col-w);
    }}
    .snowfall-left-table col.col-week {{
      width: var(--week-col-w);
    }}
    .snowfall-right-wrap {{
      flex: 1 1 auto;
      overflow: auto;
    }}
    .snowfall-left-table, .snowfall-right-table {{
      table-layout: fixed;
    }}
    .snowfall-left-table {{
      min-width: 0;
      width: auto;
    }}
    .snowfall-right-table {{
      min-width: 0;
      width: auto;
    }}
    .snowfall-right-table col.col-day {{
      width: 66px;
    }}
    .snowfall-left-table thead tr:first-child th,
    .snowfall-right-table thead tr:first-child th {{
      top: 0;
      z-index: 5;
    }}
    .snowfall-left-table thead tr:nth-child(2) th,
    .snowfall-right-table thead tr:nth-child(2) th {{
      top: 32px;
      z-index: 5;
    }}
    .snowfall-left-table .query-col {{
      text-align: left;
      font-weight: 600;
      max-width: var(--query-col-w);
      overflow: hidden;
      text-overflow: ellipsis;
    }}
    .snowfall-left-table thead th,
    .snowfall-right-table thead th {{
      position: sticky;
      background: #e5e7eb;
    }}
    .snowfall-left-table td,
    .snowfall-right-table td {{
      background-clip: padding-box;
    }}
    .rain-split-wrap {{
      display: flex;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 6px 24px rgba(0,0,0,0.06);
      overflow: hidden;
    }}
    .rain-left-wrap {{
      flex: 0 0 auto;
      border-right: 3px solid #94a3b8;
      background: #fff;
      overflow: hidden;
      --rain-query-w: 220px;
    }}
    .rain-right-wrap {{
      flex: 1 1 auto;
      overflow: auto;
    }}
    .rain-left-table, .rain-right-table {{
      table-layout: fixed;
      width: auto;
      min-width: 0;
    }}
    .rain-left-table col.col-query {{
      width: var(--rain-query-w);
    }}
    .rain-right-table col.col-day {{
      width: 66px;
    }}
    .rain-left-table thead tr:first-child th,
    .rain-right-table thead tr:first-child th {{
      position: sticky;
      top: 0;
      z-index: 5;
      background: #e5e7eb;
    }}
    .rain-left-table thead tr:nth-child(2) th,
    .rain-right-table thead tr:nth-child(2) th {{
      position: sticky;
      top: 32px;
      z-index: 5;
      background: #e5e7eb;
    }}
    .rain-left-table .query-col {{
      text-align: left;
      font-weight: 600;
      max-width: var(--rain-query-w);
      overflow: hidden;
      text-overflow: ellipsis;
    }}
    .rain-left-table td, .rain-right-table td {{
      background-clip: padding-box;
    }}
    .temperature-split-wrap {{
      display: flex;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 6px 24px rgba(0,0,0,0.06);
      overflow: hidden;
    }}
    .temperature-left-wrap {{
      flex: 0 0 auto;
      border-right: 3px solid #94a3b8;
      background: #fff;
      overflow: hidden;
      --temp-query-w: 220px;
    }}
    .temperature-right-wrap {{
      flex: 1 1 auto;
      overflow: auto;
    }}
    .temperature-left-table,
    .temperature-right-table {{
      table-layout: fixed;
      width: auto;
      min-width: 0;
    }}
    .temperature-left-table col.col-query {{
      width: var(--temp-query-w);
    }}
    .temperature-right-table col.col-temp {{
      width: 50px;
    }}
    .temperature-left-table thead tr:first-child th,
    .temperature-right-table thead tr:first-child th {{
      position: sticky;
      top: 0;
      z-index: 5;
      background: #e5e7eb;
    }}
    .temperature-left-table thead tr:nth-child(2) th,
    .temperature-right-table thead tr:nth-child(2) th {{
      position: sticky;
      top: 32px;
      z-index: 5;
      background: #e5e7eb;
    }}
    .temperature-left-table .query-col {{
      text-align: left;
      font-weight: 600;
      background: #fff;
      max-width: var(--temp-query-w);
      overflow: hidden;
      text-overflow: ellipsis;
    }}
    .temperature-left-table .query-top {{
      border-bottom: none;
      background: #e5e7eb;
    }}
    .temperature-left-table .query-sub {{
      color: transparent;
      user-select: none;
      background: #e5e7eb;
    }}
    .temperature-left-table td,
    .temperature-right-table td {{
      background-clip: padding-box;
    }}
    body.mobile-simple .desktop-only {{
      display: none;
    }}
    body.mobile-simple .mobile-only {{
      display: block;
    }}
    body.mobile-simple main {{
      padding: 12px;
    }}
    body.mobile-simple h1 {{
      font-size: 22px;
    }}
    body.mobile-simple h2 {{
      font-size: 17px;
    }}
    body.mobile-simple th,
    body.mobile-simple td {{
      font-size: 11px;
      padding: 5px 6px;
    }}
    body.mobile-simple .plain-table {{
      min-width: 0;
    }}
    body.mobile-simple .mobile-only thead th:not(:first-child) {{
      display: none;
    }}
    body.mobile-simple .mobile-only thead th:first-child {{
      text-align: left;
    }}
  </style>
</head>
<body>
  <main>
    <h1>Ski Weather Report</h1>
    <div class="report-date" id="report-date" data-generated-utc="{generated_utc_iso}">
      Generated At (Local): loading... | UTC: {generated_utc_text}
    </div>
    {snow_table}
    {rain_table}
    {temp_table}
  </main>
  <script>
    const leftWrap = document.getElementById("snowfall-left-wrap");
    const rightWrap = document.getElementById("snowfall-right-wrap");
    const leftTable = leftWrap ? leftWrap.querySelector(".snowfall-left-table") : null;
    const rightTable = rightWrap ? rightWrap.querySelector(".snowfall-right-table") : null;
    const tempLeftWrap = document.getElementById("temperature-left-wrap");
    const tempRightWrap = document.getElementById("temperature-right-wrap");
    const tempLeftTable = tempLeftWrap ? tempLeftWrap.querySelector(".temperature-left-table") : null;
    const tempRightTable = tempRightWrap ? tempRightWrap.querySelector(".temperature-right-table") : null;
    const rainLeftWrap = document.getElementById("rain-left-wrap");
    const rainRightWrap = document.getElementById("rain-right-wrap");
    const rainLeftTable = rainLeftWrap ? rainLeftWrap.querySelector(".rain-left-table") : null;
    const rainRightTable = rainRightWrap ? rainRightWrap.querySelector(".rain-right-table") : null;
    const reportDateEl = document.getElementById("report-date");
    if (reportDateEl) {{
      const utcRaw = reportDateEl.getAttribute("data-generated-utc");
      const utcDate = utcRaw ? new Date(utcRaw) : null;
      if (utcDate && !Number.isNaN(utcDate.getTime())) {{
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
        const localText = utcDate.toLocaleString(undefined, {{
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZoneName: "short",
        }});
        const utcText = utcDate.toISOString().replace("T", " ").replace(".000Z", " UTC").replace("Z", " UTC");
        reportDateEl.textContent = `Generated At (Local): ${{localText}} (${{tz}}) | UTC: ${{utcText}}`;
      }}
    }}
    const MIN_QUERY_COL_PX = 220;
    const MIN_WEEK_COL_PX = 110;
    const MIN_DAY_COL_PX = 66;
    const MAIN_HORIZONTAL_PADDING_PX = 40; // main has 20px left + 20px right on desktop
    const TABLE_BORDER_BUFFER_PX = 8; // borders/dividers/safety margin
    const MIN_DESKTOP_SNOW_3DAY_PX =
      MIN_QUERY_COL_PX + (MIN_WEEK_COL_PX * 2) + (MIN_DAY_COL_PX * 3) + MAIN_HORIZONTAL_PADDING_PX + TABLE_BORDER_BUFFER_PX;
    const isCompactLayout = () => document.body.classList.contains("mobile-simple");
    const shouldUseMobileSimple = () => window.innerWidth < MIN_DESKTOP_SNOW_3DAY_PX;
    const updateLayoutMode = () => {{
      document.body.classList.toggle("mobile-simple", shouldUseMobileSimple());
    }};
    const measureTextWidth = (text, font) => {{
      const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement("canvas"));
      const ctx = canvas.getContext("2d");
      ctx.font = font;
      return ctx.measureText(text || "").width;
    }};
    const autoSizeLeftColumns = () => {{
      if (isCompactLayout()) return;
      if (!leftWrap || !leftTable) return;
      const rows = Array.from(leftTable.querySelectorAll("tbody tr"));
      const headerCells = Array.from(leftTable.querySelectorAll("thead tr:last-child th"));
      if (headerCells.length < 2) return;
      const sampleCell = leftTable.querySelector("tbody td") || headerCells[0];
      const font = window.getComputedStyle(sampleCell).font;

      const queryValues = rows.map((tr) => tr.children[0]?.textContent?.trim() || "");
      const queryHeader = leftTable.querySelector("thead .query-col")?.textContent?.trim() || "query";
      const queryMax = Math.max(
        measureTextWidth(queryHeader, font),
        ...queryValues.map((v) => measureTextWidth(v, font))
      );

      const weekValues = rows.flatMap((tr) => [
        tr.children[1]?.textContent?.trim() || "",
        tr.children[2]?.textContent?.trim() || "",
      ]);
      const weekHeaders = headerCells.map((th) => th.textContent?.trim() || "");
      const weekMax = Math.max(
        ...weekHeaders.map((v) => measureTextWidth(v, font)),
        ...weekValues.map((v) => measureTextWidth(v, font))
      );

      const queryWidth = Math.max(150, Math.min(240, Math.ceil(queryMax + 28)));
      const weekWidth = Math.max(90, Math.min(130, Math.ceil(weekMax + 24)));

      leftWrap.style.setProperty("--query-col-w", `${{queryWidth}}px`);
      leftWrap.style.setProperty("--week-col-w", `${{weekWidth}}px`);
    }};
    const autoSizeDayColumns = () => {{
      if (isCompactLayout()) return;
      if (!rightWrap || !rightTable) return;
      const dayCols = Array.from(rightTable.querySelectorAll("col.col-day"));
      const dayCount = dayCols.length;
      if (!dayCount) return;

      const minDayWidth = 66;
      const wrapWidth = rightWrap.clientWidth;
      const minTotal = minDayWidth * dayCount;

      // If there is enough space, distribute every remaining pixel across columns
      // so table width equals wrapper width exactly and no gap remains.
      if (wrapWidth >= minTotal) {{
        const base = Math.floor(wrapWidth / dayCount);
        const remainder = wrapWidth - (base * dayCount);
        dayCols.forEach((col, idx) => {{
          const w = base + (idx < remainder ? 1 : 0);
          col.style.width = `${{w}}px`;
        }});
        rightTable.style.width = `${{wrapWidth}}px`;
        return;
      }}

      dayCols.forEach((col) => {{
        col.style.width = `${{minDayWidth}}px`;
      }});
      rightTable.style.width = `${{minTotal}}px`;
    }};
    const autoSizeRainQuery = () => {{
      if (isCompactLayout()) return;
      if (!rainLeftWrap || !rainLeftTable) return;
      const rows = Array.from(rainLeftTable.querySelectorAll("tbody tr"));
      const sampleCell = rainLeftTable.querySelector("tbody td") || rainLeftTable.querySelector("thead th");
      if (!sampleCell) return;
      const font = window.getComputedStyle(sampleCell).font;
      const queryHeader = rainLeftTable.querySelector("thead .query-col")?.textContent?.trim() || "query";
      const values = rows.map((tr) => tr.children[0]?.textContent?.trim() || "");
      const maxW = Math.max(
        measureTextWidth(queryHeader, font),
        ...values.map((v) => measureTextWidth(v, font))
      );
      const queryW = Math.max(150, Math.min(240, Math.ceil(maxW + 28)));
      rainLeftWrap.style.setProperty("--rain-query-w", `${{queryW}}px`);
    }};
    const autoSizeRainColumns = () => {{
      if (isCompactLayout()) return;
      if (!rainRightWrap || !rainRightTable) return;
      const cols = Array.from(rainRightTable.querySelectorAll("col.col-day"));
      const count = cols.length;
      if (!count) return;
      const minW = 66;
      const wrapW = rainRightWrap.clientWidth;
      const minTotal = minW * count;
      if (wrapW >= minTotal) {{
        const base = Math.floor(wrapW / count);
        const rem = wrapW - (base * count);
        cols.forEach((col, idx) => {{
          const w = base + (idx < rem ? 1 : 0);
          col.style.width = `${{w}}px`;
        }});
        rainRightTable.style.width = `${{wrapW}}px`;
        return;
      }}
      cols.forEach((col) => {{ col.style.width = `${{minW}}px`; }});
      rainRightTable.style.width = `${{minTotal}}px`;
    }};
    const autoSizeTempQuery = () => {{
      if (isCompactLayout()) return;
      if (!tempLeftWrap || !tempLeftTable) return;
      const rows = Array.from(tempLeftTable.querySelectorAll("tbody tr"));
      const sampleCell = tempLeftTable.querySelector("tbody td") || tempLeftTable.querySelector("thead th");
      if (!sampleCell) return;
      const font = window.getComputedStyle(sampleCell).font;
      const queryHeader = tempLeftTable.querySelector("thead .query-col")?.textContent?.trim() || "query";
      const queryValues = rows.map((tr) => tr.children[0]?.textContent?.trim() || "");
      const queryMax = Math.max(
        measureTextWidth(queryHeader, font),
        ...queryValues.map((v) => measureTextWidth(v, font))
      );
      const queryW = Math.max(150, Math.min(240, Math.ceil(queryMax + 28)));
      tempLeftWrap.style.setProperty("--temp-query-w", `${{queryW}}px`);
    }};
    const autoSizeTempColumns = () => {{
      if (isCompactLayout()) return;
      if (!tempRightWrap || !tempRightTable) return;
      const cols = Array.from(tempRightTable.querySelectorAll("col.col-temp"));
      const count = cols.length;
      if (!count) return;
      const minW = 50;
      const wrapW = tempRightWrap.clientWidth;
      const minTotal = minW * count;
      if (wrapW >= minTotal) {{
        const base = Math.floor(wrapW / count);
        const rem = wrapW - (base * count);
        cols.forEach((col, idx) => {{
          const w = base + (idx < rem ? 1 : 0);
          col.style.width = `${{w}}px`;
        }});
        tempRightTable.style.width = `${{wrapW}}px`;
        return;
      }}
      cols.forEach((col) => {{ col.style.width = `${{minW}}px`; }});
      tempRightTable.style.width = `${{minTotal}}px`;
    }};
    const syncTableRowHeights = (lt, rt) => {{
      if (!lt || !rt) return;
      const lHeadRows = Array.from(lt.tHead?.rows || []);
      const rHeadRows = Array.from(rt.tHead?.rows || []);
      const hlen = Math.min(lHeadRows.length, rHeadRows.length);
      for (let i = 0; i < hlen; i += 1) {{
        lHeadRows[i].style.height = "";
        rHeadRows[i].style.height = "";
        const h = Math.max(lHeadRows[i].getBoundingClientRect().height, rHeadRows[i].getBoundingClientRect().height);
        lHeadRows[i].style.height = `${{h}}px`;
        rHeadRows[i].style.height = `${{h}}px`;
      }}
      const lRows = Array.from(lt.tBodies[0]?.rows || []);
      const rRows = Array.from(rt.tBodies[0]?.rows || []);
      const len = Math.min(lRows.length, rRows.length);
      for (let i = 0; i < len; i += 1) {{
        lRows[i].style.height = "";
        rRows[i].style.height = "";
        const h = Math.max(lRows[i].getBoundingClientRect().height, rRows[i].getBoundingClientRect().height);
        lRows[i].style.height = `${{h}}px`;
        rRows[i].style.height = `${{h}}px`;
      }}
    }};
    if (leftWrap && rightWrap) {{
      let syncing = false;
      const sync = (src, dst) => {{
        if (isCompactLayout()) return;
        if (syncing) return;
        syncing = true;
        dst.scrollTop = src.scrollTop;
        requestAnimationFrame(() => {{ syncing = false; }});
      }};
      leftWrap.addEventListener("scroll", () => sync(leftWrap, rightWrap), {{ passive: true }});
      rightWrap.addEventListener("scroll", () => sync(rightWrap, leftWrap), {{ passive: true }});
    }}
    if (rainLeftWrap && rainRightWrap) {{
      rainRightWrap.addEventListener("scroll", () => {{
        if (isCompactLayout()) return;
        rainLeftWrap.scrollTop = rainRightWrap.scrollTop;
      }}, {{ passive: true }});
    }}
    if (tempLeftWrap && tempRightWrap) {{
      tempRightWrap.addEventListener("scroll", () => {{
        if (isCompactLayout()) return;
        tempLeftWrap.scrollTop = tempRightWrap.scrollTop;
      }}, {{ passive: true }});
    }}
    let tempLayoutRaf = 0;
    const scheduleTempLayout = () => {{
      if (isCompactLayout()) return;
      if (tempLayoutRaf) cancelAnimationFrame(tempLayoutRaf);
      tempLayoutRaf = requestAnimationFrame(() => {{
        autoSizeTempQuery();
        autoSizeTempColumns();
        syncTableRowHeights(tempLeftTable, tempRightTable);
      }});
    }};
    const applyDesktopLayout = () => {{
      autoSizeLeftColumns();
      autoSizeDayColumns();
      autoSizeRainQuery();
      autoSizeRainColumns();
      scheduleTempLayout();
    }};
    const refreshLayout = () => {{
      updateLayoutMode();
      if (isCompactLayout()) return;
      applyDesktopLayout();
    }};
    refreshLayout();
    window.addEventListener("resize", () => {{
      refreshLayout();
    }}, {{ passive: true }});
    if (window.ResizeObserver && tempLeftWrap && tempRightWrap) {{
      const ro = new ResizeObserver(() => refreshLayout());
      ro.observe(tempLeftWrap);
      ro.observe(tempRightWrap);
      if (tempLeftTable) ro.observe(tempLeftTable);
      if (tempRightTable) ro.observe(tempRightTable);
    }}
  </script>
</body>
</html>"""
