from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from src.web.resort_hourly_context import build_resort_daily_summary_contexts
from src.web.weather_page_render_core import render_payload_html

_HOURLY_TEMPLATE = (Path(__file__).resolve().parents[1] / "templates" / "resort_hourly_page.html").read_text(
    encoding="utf-8"
)


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
    mode: str,
    source: str,
    resort_id: str,
    hours: int,
    timeout: int,
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
) -> Optional[Dict[str, Any]]:
    from src.web.data_sources import load_hourly_payload

    code, payload = load_hourly_payload(
        mode=mode,
        source=source,
        resort_id=resort_id,
        hours=hours,
        timeout=timeout,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
    )
    if code != 200 or "error" in payload:
        return None
    return payload


def _build_local_hourly_payloads(
    *,
    resort_ids: List[str],
    hours: int,
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
    max_workers: int,
) -> Dict[str, Dict[str, Any] | None]:
    from src.backend.services.hourly_payload_service import build_hourly_payloads_for_resorts

    return build_hourly_payloads_for_resorts(
        resort_ids=resort_ids,
        hours=hours,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
        max_workers=max_workers,
    )


def render_hourly_pages(
    index_html_path: str,
    payload: Dict[str, Any],
    *,
    include_hourly_data: bool = True,
    hourly_mode: str = "local",
    hourly_source: str = "",
    hourly_timeout: int = 20,
    hourly_hours: int = 120,
    cache_file: str = ".cache/open_meteo_cache.json",
    geocode_cache_hours: int = 24 * 30,
    forecast_cache_hours: int = 3,
    hourly_max_workers: int = 8,
) -> List[Path]:
    site_root = Path(index_html_path).parent
    outputs: List[Path] = []
    resort_ids = _iter_resort_ids(payload)
    daily_summary_by_resort = build_resort_daily_summary_contexts(payload)
    local_hourly_payloads: Dict[str, Dict[str, Any] | None] | None = None
    if include_hourly_data and hourly_mode == "local":
        local_hourly_payloads = _build_local_hourly_payloads(
            resort_ids=resort_ids,
            hours=hourly_hours,
            cache_file=cache_file,
            geocode_cache_hours=geocode_cache_hours,
            forecast_cache_hours=forecast_cache_hours,
            max_workers=hourly_max_workers,
        )

    for resort_id in resort_ids:
        encoded_id = quote(resort_id)
        out_dir = site_root / "resort" / encoded_id
        out = out_dir / "index.html"
        out_dir.mkdir(parents=True, exist_ok=True)

        hourly_context: Dict[str, Any] = {"resortId": resort_id}
        daily_summary = daily_summary_by_resort.get(resort_id)
        if daily_summary:
            hourly_context["dailySummary"] = daily_summary
        if include_hourly_data:
            if local_hourly_payloads is not None:
                hourly_payload = local_hourly_payloads.get(resort_id)
            else:
                hourly_payload = _build_hourly_payload(
                    mode=hourly_mode,
                    source=hourly_source,
                    resort_id=resort_id,
                    hours=hourly_hours,
                    timeout=hourly_timeout,
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
