#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, List

_PAGE_TEMPLATE = (Path(__file__).resolve().parent / "templates" / "weather_page.html").read_text(encoding="utf-8")

_PAGE_SHELL_PLACEHOLDER = """
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
    initial_payload: Dict[str, Any] | None = None,
) -> str:
    now_utc = datetime.now(timezone.utc)
    generated_utc_iso = now_utc.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    filter_meta = {
        "available_filters": available_filters or {},
        "applied_filters": applied_filters or {},
    }
    filter_meta_json = json.dumps(filter_meta, ensure_ascii=False).replace("</", "<\\/")
    page_bootstrap_json = json.dumps({"dataUrl": data_url}, ensure_ascii=False).replace("</", "<\\/")
    initial_payload_json = (
        json.dumps(initial_payload, ensure_ascii=False).replace("</", "<\\/")
        if initial_payload is not None
        else "null"
    )
    return (
        _PAGE_TEMPLATE.replace("{{generated_utc_iso}}", generated_utc_iso)
        .replace("{{filter_meta_json}}", filter_meta_json)
        .replace("{{page_bootstrap_json}}", page_bootstrap_json)
        .replace("{{initial_payload_json}}", initial_payload_json)
        .replace("{{page_shell_placeholder}}", _PAGE_SHELL_PLACEHOLDER)
    )
