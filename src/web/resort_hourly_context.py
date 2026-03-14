from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.backend.constants import DAYS_PER_WEEK


def _sorted_daily_rows(rows: Any) -> List[Dict[str, Any]]:
    if not isinstance(rows, list):
        return []
    out = [row for row in rows if isinstance(row, dict)]
    out.sort(key=lambda row: str(row.get("date") or ""))
    return out


def _recent_history_rows(report: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows = _sorted_daily_rows(report.get("past_14d_daily"))
    if len(rows) <= DAYS_PER_WEEK:
        return rows
    return rows[-DAYS_PER_WEEK:]


def build_resort_daily_summary_context(payload: Dict[str, Any], resort_id: str) -> Optional[Dict[str, Any]]:
    reports = payload.get("reports")
    if not isinstance(reports, list):
        return None
    for report in reports:
        if not isinstance(report, dict):
            continue
        if str(report.get("resort_id", "")).strip() != resort_id:
            continue
        daily = report.get("daily")
        if not isinstance(daily, list):
            return None
        context: Dict[str, Any] = {
            "query": report.get("query", ""),
            "display_name": report.get("display_name", report.get("query", "")),
            "website": report.get("website", ""),
            "daily": daily,
        }
        recent_history = _recent_history_rows(report)
        if recent_history:
            context["past7dDaily"] = recent_history
        return context
    return None
