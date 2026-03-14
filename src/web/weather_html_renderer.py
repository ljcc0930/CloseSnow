#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, List

_PAGE_TEMPLATE = (Path(__file__).resolve().parent / "templates" / "weather_page.html").read_text(encoding="utf-8")

_PAGE_SHELL_PLACEHOLDER = """
    <section id="us-snowfall-map-section" class="us-snowfall-map-section" aria-labelledby="us-snowfall-map-title" data-map-shell="1">
      <div class="section-header us-snowfall-map-header">
        <div class="us-snowfall-map-heading-wrap">
          <h2 id="us-snowfall-map-title">US Snowfall Map</h2>
          <p class="us-snowfall-map-subtitle">Preview the upcoming nationwide snowfall view without displacing the resort tables below.</p>
        </div>
        <div id="us-snowfall-map-metric-toggle" class="unit-toggle us-snowfall-map-metric-toggle" role="group" aria-label="Snowfall map metric" data-map-metric-toggle="1" data-mode="metric">
          <button type="button" class="unit-btn is-active" data-map-metric-key="today_snow" aria-pressed="true">24h</button>
          <button type="button" class="unit-btn" data-map-metric-key="week_snow" aria-pressed="false">7d</button>
        </div>
      </div>
      <div class="us-snowfall-map-shell">
        <div class="us-snowfall-map-meta">
          <p id="us-snowfall-map-status" class="us-snowfall-map-status" role="status">Map shell ready. Marker layers and page-state sync land in a follow-up slice.</p>
          <div id="us-snowfall-map-legend" class="us-snowfall-map-legend" aria-label="Snowfall legend">
            <span class="us-snowfall-map-legend-chip" data-map-legend-stop="low">0-10 cm</span>
            <span class="us-snowfall-map-legend-chip" data-map-legend-stop="mid">10-30 cm</span>
            <span class="us-snowfall-map-legend-chip" data-map-legend-stop="high">30+ cm</span>
          </div>
        </div>
        <div id="us-snowfall-map-root" class="us-snowfall-map-root" role="img" aria-label="Snowfall map preview area">
          <div class="us-snowfall-map-placeholder">
            <span class="us-snowfall-map-placeholder-kicker">Map canvas</span>
            <strong>Interactive snowfall map preview</strong>
            <span>Stable DOM hooks are live. Marker rendering arrives next.</span>
          </div>
        </div>
      </div>
    </section>
    <section><h2>Daily Summary</h2><p class="section-loading">Loading forecast...</p></section>
    <section><h2>Snowfall</h2><p class="section-loading">Loading forecast...</p></section>
    <section><h2>Rainfall</h2><p class="section-loading">Loading forecast...</p></section>
    <section><h2>Temperature</h2><p class="section-loading">Loading forecast...</p></section>
    <section><h2>Weather</h2><p class="section-loading">Loading forecast...</p></section>
    <section><h2>Sunrise / Sunset</h2><p class="section-loading">Loading forecast...</p></section>
"""


def build_html(
    snowfall: List[Dict[str, str]],
    rain: List[Dict[str, str]],
    weather: List[Dict[str, str]],
    sun: List[Dict[str, str]],
    temp: List[Dict[str, str]],
    *,
    available_filters: Dict[str, Dict[str, int]] | None = None,
    applied_filters: Dict[str, Any] | None = None,
    data_url: str = "./data.json",
) -> str:
    now_utc = datetime.now(timezone.utc)
    generated_utc_iso = now_utc.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    filter_meta = {
        "available_filters": available_filters or {},
        "applied_filters": applied_filters or {},
    }
    filter_meta_json = json.dumps(filter_meta, ensure_ascii=False)
    page_bootstrap_json = json.dumps({"dataUrl": data_url}, ensure_ascii=False)
    return (
        _PAGE_TEMPLATE.replace("{{generated_utc_iso}}", generated_utc_iso)
        .replace("{{filter_meta_json}}", filter_meta_json)
        .replace("{{page_bootstrap_json}}", page_bootstrap_json)
        .replace("{{page_shell_placeholder}}", _PAGE_SHELL_PLACEHOLDER)
    )
