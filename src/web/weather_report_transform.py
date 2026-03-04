#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


_WEEKDAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _day_label_from_date(raw_date: Any) -> str:
    if not isinstance(raw_date, str) or not raw_date:
        return ""
    try:
        parsed = datetime.strptime(raw_date, "%Y-%m-%d").date()
    except ValueError:
        return ""
    return f"{parsed.strftime('%m-%d')} {_WEEKDAY_ABBR[parsed.weekday()]}"


def _reports_to_metric_rows(
    reports: List[Dict[str, Any]],
    display_days: int,
    weekly_mapping: Dict[str, str],
    daily_source_key: str,
    daily_output_suffix: str,
    daily_format: str,
) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for report in reports:
        row: Dict[str, str] = {"query": str(report.get("query", ""))}
        for out_key, report_key in weekly_mapping.items():
            row[out_key] = f"{_as_float(report.get(report_key, 0.0)):.1f}"

        daily = report.get("daily", [])
        for day_idx in range(display_days):
            day = daily[day_idx] if day_idx < len(daily) else {}
            value = day.get(daily_source_key)
            if value is None:
                row[f"day_{day_idx+1}_{daily_output_suffix}"] = ""
            else:
                row[f"day_{day_idx+1}_{daily_output_suffix}"] = format(_as_float(value), daily_format)
            row[f"label_day_{day_idx+1}"] = _day_label_from_date(day.get("date"))
        rows.append(row)
    return rows


def reports_to_snow_rows(reports: List[Dict[str, Any]], display_days: int = 14) -> List[Dict[str, str]]:
    return _reports_to_metric_rows(
        reports=reports,
        display_days=display_days,
        weekly_mapping={
            "week1_total_cm": "week1_total_snowfall_cm",
            "week2_total_cm": "week2_total_snowfall_cm",
        },
        daily_source_key="snowfall_cm",
        daily_output_suffix="cm",
        daily_format=".1f",
    )


def reports_to_rain_rows(reports: List[Dict[str, Any]], display_days: int = 14) -> List[Dict[str, str]]:
    return _reports_to_metric_rows(
        reports=reports,
        display_days=display_days,
        weekly_mapping={
            "week1_total_rain_mm": "week1_total_rain_mm",
            "week2_total_rain_mm": "week2_total_rain_mm",
        },
        daily_source_key="rain_mm",
        daily_output_suffix="rain_mm",
        daily_format=".1f",
    )


def reports_to_temp_rows(reports: List[Dict[str, Any]], display_days: int = 14) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for report in reports:
        row: Dict[str, str] = {
            "query": str(report.get("query", "")),
            "matched_name": str(report.get("matched_name", "")),
        }
        daily = report.get("daily", [])
        for day_idx in range(display_days):
            day = daily[day_idx] if day_idx < len(daily) else {}
            max_value = day.get("temperature_max_c")
            min_value = day.get("temperature_min_c")
            row[f"day_{day_idx+1}_max_c"] = "" if max_value is None else str(max_value)
            row[f"day_{day_idx+1}_min_c"] = "" if min_value is None else str(min_value)
            row[f"day_{day_idx+1}_above_0"] = "1" if (max_value is not None and float(max_value) > 0) else "0"
            row[f"label_day_{day_idx+1}"] = _day_label_from_date(day.get("date"))
        rows.append(row)
    return rows


def reports_to_weather_rows(reports: List[Dict[str, Any]], display_days: int = 14) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for report in reports:
        row: Dict[str, str] = {"query": str(report.get("query", ""))}
        daily = report.get("daily", [])
        for day_idx in range(display_days):
            day = daily[day_idx] if day_idx < len(daily) else {}
            code = day.get("weather_code")
            row[f"day_{day_idx+1}_weather_code"] = "" if code is None else str(code)
            row[f"label_day_{day_idx+1}"] = _day_label_from_date(day.get("date"))
        rows.append(row)
    return rows
