from __future__ import annotations

from typing import Any, Dict, List

from src.backend.writers import write_rain_csv, write_snow_csv, write_temp_csv, write_unified_json


def export_payload_artifacts(
    payload: Dict[str, Any],
    output_json: str,
    snow_csv: str,
    rain_csv: str,
    temp_csv: str,
) -> None:
    reports: List[Dict[str, Any]] = payload.get("reports", [])
    write_unified_json(output_json, payload)
    write_snow_csv(snow_csv, reports)
    write_rain_csv(rain_csv, reports)
    write_temp_csv(temp_csv, reports)

