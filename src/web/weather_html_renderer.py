#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

_PAGE_TEMPLATE = (Path(__file__).resolve().parent / "templates" / "weather_page.html").read_text(encoding="utf-8")

_PAGE_SHELL_PLACEHOLDER = """
    <section class="insight-board forecast-loading-overview" aria-hidden="true">
      <div class="skeleton skeleton-heading"></div>
      <div class="insight-grid loading-card-grid"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div></div>
    </section>
    <section class="forecast-results forecast-section-loading" aria-hidden="true">
      <div class="skeleton skeleton-heading"></div>
      <div class="resort-card-grid"><div class="skeleton skeleton-resort-card"></div><div class="skeleton skeleton-resort-card"></div></div>
      <p class="section-loading sr-only">Loading forecast...</p>
    </section>
"""


def _payload_generated_utc(initial_payload: Dict[str, Any] | None) -> str | None:
    raw_value = initial_payload.get("generated_at_utc") if isinstance(initial_payload, dict) else None
    if not isinstance(raw_value, str) or not raw_value:
        return None
    parse_value = f"{raw_value[:-1]}+00:00" if raw_value.endswith("Z") else raw_value
    try:
        parsed = datetime.fromisoformat(parse_value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return raw_value


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
    initial_payload: Dict[str, Any] | None = None,
) -> str:
    """Build the browser-rendered page shell.

    The table-data arguments are kept for compatibility with older tests and
    callers; the active page path bootstraps payload JSON and lets JS render
    forecast tables in the browser.
    """
    del snowfall, rain, weather, sun, temp

    generated_utc_iso = _payload_generated_utc(initial_payload)
    if generated_utc_iso is None:
        now_utc = datetime.now(timezone.utc)
        generated_utc_iso = now_utc.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    filter_meta = {
        "available_filters": available_filters or {},
        "applied_filters": applied_filters or {},
    }
    filter_meta_json = json.dumps(filter_meta, ensure_ascii=False).replace("</", "<\\/")
    page_bootstrap_json = json.dumps({"dataUrl": data_url}, ensure_ascii=False).replace("</", "<\\/")
    initial_payload_json = (
        json.dumps(initial_payload, ensure_ascii=False).replace("</", "<\\/") if initial_payload is not None else "null"
    )
    return (
        _PAGE_TEMPLATE.replace("{{generated_utc_iso}}", generated_utc_iso)
        .replace("{{filter_meta_json}}", filter_meta_json)
        .replace("{{page_bootstrap_json}}", page_bootstrap_json)
        .replace("{{initial_payload_json}}", initial_payload_json)
        .replace("{{page_shell_placeholder}}", _PAGE_SHELL_PLACEHOLDER)
    )
