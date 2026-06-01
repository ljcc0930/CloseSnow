from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.backend.constants import HISTORY_DAYS


def _sorted_daily_rows(rows: Any) -> List[Dict[str, Any]]:
    if not isinstance(rows, list):
        return []
    out = [row for row in rows if isinstance(row, dict)]
    out.sort(key=lambda row: str(row.get("date") or ""))
    return out


def _recent_history_rows(report: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows = _sorted_daily_rows(report.get("past_14d_daily"))
    if len(rows) <= HISTORY_DAYS:
        return rows
    return rows[-HISTORY_DAYS:]


def _build_context_from_report(report: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    daily = report.get("daily")
    if not isinstance(daily, list):
        return None
    context: Dict[str, Any] = {
        "query": report.get("query", ""),
        "display_name": report.get("display_name", report.get("query", "")),
        "website": report.get("website", ""),
        "daily": daily,
    }
    nearby_airports = report.get("nearby_airports")
    if isinstance(nearby_airports, list):
        context["nearbyAirports"] = [item for item in nearby_airports if isinstance(item, dict)]
    recent_history = _recent_history_rows(report)
    if recent_history:
        context["past14dDaily"] = recent_history
    return context


def build_resort_daily_summary_contexts(payload: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    reports = payload.get("reports")
    if not isinstance(reports, list):
        return {}
    contexts: Dict[str, Dict[str, Any]] = {}
    for report in reports:
        if not isinstance(report, dict):
            continue
        resort_id = str(report.get("resort_id", "")).strip()
        if not resort_id or resort_id in contexts:
            continue
        context = _build_context_from_report(report)
        if context is not None:
            contexts[resort_id] = context
    return contexts


def build_resort_daily_summary_context(payload: Dict[str, Any], resort_id: str) -> Optional[Dict[str, Any]]:
    return build_resort_daily_summary_contexts(payload).get(resort_id)
