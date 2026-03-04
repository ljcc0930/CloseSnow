from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import quote

from src.web.weather_page_render_core import render_payload_html

_HOURLY_TEMPLATE = (
    Path(__file__).resolve().parents[1] / "templates" / "resort_hourly_page.html"
).read_text(encoding="utf-8")


def write_payload_json(path: str, payload: Dict[str, Any]) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


def render_html(path: str, payload: Dict[str, Any]) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_payload_html(payload), encoding="utf-8")
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


def render_hourly_pages(index_html_path: str, payload: Dict[str, Any]) -> List[Path]:
    site_root = Path(index_html_path).parent
    outputs: List[Path] = []
    for resort_id in _iter_resort_ids(payload):
        encoded_id = quote(resort_id)
        out = site_root / "resort" / encoded_id / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        html = (
            _HOURLY_TEMPLATE.replace("{{asset_prefix}}", "../../assets")
            .replace("{{back_href}}", "../../")
            .replace("{{resort_id}}", resort_id)
        )
        out.write_text(html, encoding="utf-8")
        outputs.append(out)
    return outputs
