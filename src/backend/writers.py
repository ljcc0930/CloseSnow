from __future__ import annotations

import csv
import json
import os
from typing import Any, Dict, List

from src.backend.constants import FORECAST_DAYS


def write_snow_csv(path: str, reports: List[Dict[str, Any]]) -> None:
    fields = ["query", "week1_total_cm", "week2_total_cm"] + [f"day_{i}_cm" for i in range(1, FORECAST_DAYS + 1)]
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for report in reports:
            row: Dict[str, Any] = {
                "query": report["query"],
                "week1_total_cm": f"{report['week1_total_snowfall_cm']:.2f}",
                "week2_total_cm": f"{report['week2_total_snowfall_cm']:.2f}",
            }
            daily = report.get("daily", [])
            for idx in range(FORECAST_DAYS):
                value = daily[idx]["snowfall_cm"] if idx < len(daily) else None
                row[f"day_{idx+1}_cm"] = value if value is not None else ""
            writer.writerow(row)


def write_rain_csv(path: str, reports: List[Dict[str, Any]]) -> None:
    fields = ["query"] + [f"day_{i}_rain_mm" for i in range(1, FORECAST_DAYS + 1)]
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for report in reports:
            row: Dict[str, Any] = {"query": report["query"]}
            daily = report.get("daily", [])
            for idx in range(FORECAST_DAYS):
                value = daily[idx]["rain_mm"] if idx < len(daily) else None
                row[f"day_{idx+1}_rain_mm"] = value if value is not None else ""
            writer.writerow(row)


def write_temp_csv(path: str, reports: List[Dict[str, Any]]) -> None:
    max_cols = [f"day_{i}_max_c" for i in range(1, FORECAST_DAYS + 1)]
    min_cols = [f"day_{i}_min_c" for i in range(1, FORECAST_DAYS + 1)]
    flag_cols = [f"day_{i}_above_0" for i in range(1, FORECAST_DAYS + 1)]
    fields = ["query", "matched_name"] + max_cols + min_cols + flag_cols
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for report in reports:
            row: Dict[str, Any] = {
                "query": report["query"],
                "matched_name": report.get("matched_name", ""),
            }
            daily = report.get("daily", [])
            for idx in range(FORECAST_DAYS):
                day = daily[idx] if idx < len(daily) else {}
                row[f"day_{idx+1}_max_c"] = day.get("temperature_max_c", "")
                row[f"day_{idx+1}_min_c"] = day.get("temperature_min_c", "")
                row[f"day_{idx+1}_above_0"] = day.get("above_0", 0)
            writer.writerow(row)


def write_unified_json(path: str, payload: Dict[str, Any]) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
