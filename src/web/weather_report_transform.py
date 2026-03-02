#!/usr/bin/env python3
from __future__ import annotations

from typing import Any, Dict, List

from src.backend.constants import FORECAST_DAYS


def reports_to_snow_rows(reports: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for report in reports:
        row: Dict[str, str] = {
            "query": str(report.get("query", "")),
            "week1_total_cm": f"{float(report.get('week1_total_snowfall_cm', 0.0)):.1f}",
            "week2_total_cm": f"{float(report.get('week2_total_snowfall_cm', 0.0)):.1f}",
        }
        daily = report.get("daily", [])
        for day_idx in range(FORECAST_DAYS):
            value = daily[day_idx].get("snowfall_cm") if day_idx < len(daily) else None
            row[f"day_{day_idx+1}_cm"] = "" if value is None else f"{float(value):.1f}"
        rows.append(row)
    return rows


def reports_to_rain_rows(reports: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for report in reports:
        row: Dict[str, str] = {"query": str(report.get("query", ""))}
        daily = report.get("daily", [])
        for day_idx in range(FORECAST_DAYS):
            value = daily[day_idx].get("rain_mm") if day_idx < len(daily) else None
            row[f"day_{day_idx+1}_rain_mm"] = "" if value is None else str(value)
        rows.append(row)
    return rows


def reports_to_temp_rows(reports: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for report in reports:
        row: Dict[str, str] = {
            "query": str(report.get("query", "")),
            "matched_name": str(report.get("matched_name", "")),
        }
        daily = report.get("daily", [])
        for day_idx in range(FORECAST_DAYS):
            day = daily[day_idx] if day_idx < len(daily) else {}
            max_value = day.get("temperature_max_c")
            min_value = day.get("temperature_min_c")
            row[f"day_{day_idx+1}_max_c"] = "" if max_value is None else str(max_value)
            row[f"day_{day_idx+1}_min_c"] = "" if min_value is None else str(min_value)
            row[f"day_{day_idx+1}_above_0"] = "1" if (max_value is not None and float(max_value) > 0) else "0"
        rows.append(row)
    return rows
