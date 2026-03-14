from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from src.web.resort_hourly_context import build_resort_daily_summary_context
from src.web.weather_page_render_core import render_payload_html

_HOURLY_TEMPLATE = (
    Path(__file__).resolve().parents[1] / "templates" / "resort_hourly_page.html"
).read_text(encoding="utf-8")


def write_payload_json(path: str, payload: Dict[str, Any]) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


def render_html(path: str, payload: Dict[str, Any], *, data_url: str = "./data.json") -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_payload_html(payload, data_url=data_url), encoding="utf-8")
    return out


def _iter_resort_ids(payload: Dict[str, Any]) -> List[str]:
    reports = payload.get("reports")
    if not isinstance(reports, list):
        return []
    seen: set[str] = set()
    resort_ids: List[str] = []
    for report in reports:
        if not isinstance(report, dict):
            continue
        resort_id = str(report.get("resort_id", "")).strip()
        if not resort_id or resort_id in seen:
            continue
        seen.add(resort_id)
        resort_ids.append(resort_id)
    return resort_ids


def _build_hourly_payload(
    *,
    resort_id: str,
    hours: int,
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
) -> Optional[Dict[str, Any]]:
    from src.backend.weather_data_server import _hourly_payload_for_resort

    return _hourly_payload_for_resort(
        resort_id=resort_id,
        hours=hours,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
    )


def render_hourly_pages(
    index_html_path: str,
    payload: Dict[str, Any],
    *,
    include_hourly_data: bool = True,
    hourly_hours: int = 120,
    cache_file: str = ".cache/open_meteo_cache.json",
    geocode_cache_hours: int = 24 * 30,
    forecast_cache_hours: int = 3,
) -> List[Path]:
    site_root = Path(index_html_path).parent
    outputs: List[Path] = []
    for resort_id in _iter_resort_ids(payload):
        encoded_id = quote(resort_id)
        out_dir = site_root / "resort" / encoded_id
        out = out_dir / "index.html"
        out_dir.mkdir(parents=True, exist_ok=True)

        hourly_context: Dict[str, Any] = {"resortId": resort_id}
        daily_summary = build_resort_daily_summary_context(payload, resort_id)
        if daily_summary:
            hourly_context["dailySummary"] = daily_summary
        if include_hourly_data:
            hourly_payload = _build_hourly_payload(
                resort_id=resort_id,
                hours=hourly_hours,
                cache_file=cache_file,
                geocode_cache_hours=geocode_cache_hours,
                forecast_cache_hours=forecast_cache_hours,
            )
            if isinstance(hourly_payload, dict) and "error" not in hourly_payload:
                hourly_data_path = out_dir / "hourly.json"
                hourly_data_path.write_text(
                    json.dumps(hourly_payload, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                hourly_context["hourlyDataUrl"] = "./hourly.json"

        html = (
            _HOURLY_TEMPLATE.replace("{{asset_prefix}}", "../../assets")
            .replace("{{back_href}}", "../../")
            .replace("{{resort_id}}", resort_id)
            .replace("{{hourly_context_json}}", json.dumps(hourly_context, ensure_ascii=False))
        )
        out.write_text(html, encoding="utf-8")
        outputs.append(out)
    return outputs
