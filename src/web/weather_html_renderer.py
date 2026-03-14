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
          <p class="us-snowfall-map-eyebrow">National snowfall outlook</p>
          <h2 id="us-snowfall-map-title">US Snowfall Map</h2>
          <p class="us-snowfall-map-subtitle">Compare map-ready US resorts across 24-hour, 72-hour, and 7-day snowfall windows without losing the full forecast tables below.</p>
        </div>
        <div id="us-snowfall-map-metric-toggle" class="unit-toggle us-snowfall-map-metric-toggle" role="group" aria-label="Snowfall map metric" data-map-metric-toggle="1" data-mode="today">
          <button type="button" class="unit-btn is-active" data-map-metric-key="today" aria-pressed="true">24h</button>
          <button type="button" class="unit-btn" data-map-metric-key="next_72h" aria-pressed="false">72h</button>
          <button type="button" class="unit-btn" data-map-metric-key="week1" aria-pressed="false">7d</button>
        </div>
      </div>
      <div class="us-snowfall-map-shell">
        <div class="us-snowfall-map-stage">
          <div id="us-snowfall-map-root" class="us-snowfall-map-root" role="region" aria-label="US snowfall map">
            <div class="us-snowfall-map-placeholder">
              <span class="us-snowfall-map-placeholder-kicker">Nationwide outlook</span>
              <strong>Preparing live snowfall markers</strong>
              <span>Switch forecast windows above to compare the latest map-ready US resort totals.</span>
            </div>
          </div>
          <div class="us-snowfall-map-stage-footer">
            <p id="us-snowfall-map-status" class="us-snowfall-map-status" role="status">Preparing the nationwide snowfall map and resort markers.</p>
          </div>
        </div>
        <aside class="us-snowfall-map-meta" aria-label="Snowfall map support">
          <div class="us-snowfall-map-meta-card">
            <div class="us-snowfall-map-meta-label">Snow intensity</div>
            <div id="us-snowfall-map-legend" class="us-snowfall-map-legend" aria-label="Snowfall legend">
              <span class="us-snowfall-map-legend-chip" data-map-legend-stop="low">0-5 cm</span>
              <span class="us-snowfall-map-legend-chip" data-map-legend-stop="mid">5-15 cm</span>
              <span class="us-snowfall-map-legend-chip" data-map-legend-stop="high">15+ cm</span>
            </div>
          </div>
          <div class="us-snowfall-map-meta-card">
            <div class="us-snowfall-map-meta-label">Coverage</div>
            <p class="us-snowfall-map-meta-copy">US resorts with projectable coordinates appear on the map. The full forecast tables below still carry the broader resort set.</p>
          </div>
        </aside>
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
