from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Mapping

from src.contract import WeatherPayloadV1
from src.contract.hourly_payload import HourlyPayload
from src.web.resort_hourly_context import build_resort_daily_summary_contexts
from src.web.weather_page_render_core import render_payload_html

_HOURLY_TEMPLATE = (Path(__file__).resolve().parents[1] / "templates" / "resort_hourly_page.html").read_text(
    encoding="utf-8"
)
_RESORT_ARTIFACT_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_RESORT_ARTIFACT_FILENAMES = frozenset({"index.html", "hourly.json"})


def write_payload_json(path: str, payload: Dict[str, Any]) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


def render_html(path: str, payload: WeatherPayloadV1, *, data_url: str = "./data.json") -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_payload_html(payload, data_url=data_url), encoding="utf-8")
    return out


def resort_ids_from_payload(payload: WeatherPayloadV1) -> List[str]:
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


def resort_artifact_dir_name(resort_id: str) -> str:
    normalized = resort_id.strip()
    if normalized != resort_id or _RESORT_ARTIFACT_ID_PATTERN.fullmatch(normalized) is None:
        raise ValueError(f"Invalid resort_id for a static artifact path: {resort_id!r}")
    return normalized


def resort_artifact_path(root: str | Path, resort_id: str, filename: str) -> Path:
    if filename not in _RESORT_ARTIFACT_FILENAMES:
        raise ValueError(f"Unsupported static resort artifact filename: {filename!r}")
    root_path = Path(root).resolve()
    resort_root = root_path / "resort"
    artifact_dir = resort_root / resort_artifact_dir_name(resort_id)
    candidate = artifact_dir / filename
    if resort_root.is_symlink() or artifact_dir.is_symlink() or candidate.is_symlink():
        raise ValueError(f"Static resort artifact path must not contain symlinks: {candidate}")
    resolved_candidate = candidate.resolve(strict=False)
    try:
        resolved_candidate.relative_to(root_path)
    except ValueError as exc:
        raise ValueError(f"Static resort artifact path escapes its selected root: {candidate}") from exc
    return candidate


def render_hourly_pages(
    index_html_path: str,
    payload: WeatherPayloadV1,
    *,
    hourly_payloads: Mapping[str, HourlyPayload | None] | None = None,
) -> List[Path]:
    """Render resort routes from already-fetched data without backend or network access."""
    site_root = Path(index_html_path).parent
    outputs: List[Path] = []
    resort_ids = resort_ids_from_payload(payload)
    daily_summary_by_resort = build_resort_daily_summary_contexts(payload)
    available_hourly = hourly_payloads or {}

    for resort_id in resort_ids:
        out = resort_artifact_path(site_root, resort_id, "index.html")
        out_dir = out.parent
        hourly_data_path = resort_artifact_path(site_root, resort_id, "hourly.json")
        out_dir.mkdir(parents=True, exist_ok=True)

        hourly_context: Dict[str, Any] = {"resortId": resort_id}
        daily_summary = daily_summary_by_resort.get(resort_id)
        if daily_summary:
            hourly_context["dailySummary"] = daily_summary
        hourly_payload = available_hourly.get(resort_id)
        if isinstance(hourly_payload, dict) and "error" not in hourly_payload:
            hourly_data_path.write_text(
                json.dumps(hourly_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            hourly_context["hourlyDataUrl"] = "./hourly.json"
        elif hourly_data_path.is_file():
            hourly_data_path.unlink()

        html = (
            _HOURLY_TEMPLATE.replace("{{asset_prefix}}", "../../assets")
            .replace("{{back_href}}", "../../")
            .replace("{{resort_id}}", resort_id)
            .replace("{{hourly_context_json}}", json.dumps(hourly_context, ensure_ascii=False))
        )
        out.write_text(html, encoding="utf-8")
        outputs.append(out)
    return outputs
