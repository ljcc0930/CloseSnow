from __future__ import annotations

import math
from typing import Any, Mapping

from src.contract.weather_payload_v1 import SCHEMA_VERSION


class ContractValidationError(ValueError):
    pass


def _require_type(payload: Mapping[str, Any], key: str, expected_type: type) -> None:
    value = payload.get(key)
    if not isinstance(value, expected_type):
        raise ContractValidationError(f"Invalid type for '{key}': expected {expected_type.__name__}")


def _require_report_number(value: Any, label: str, *, allow_none: bool = False) -> None:
    if value is None and allow_none:
        return
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        expected = "number or null" if allow_none else "number"
        raise ContractValidationError(f"Invalid {label}: expected {expected}")
    if not math.isfinite(float(value)):
        raise ContractValidationError(f"Invalid {label}: expected finite number")


def validate_weather_payload_v1(payload: Mapping[str, Any]) -> None:
    if not isinstance(payload, Mapping):
        raise ContractValidationError("Payload must be a mapping")

    schema_version = payload.get("schema_version")
    if schema_version != SCHEMA_VERSION:
        raise ContractValidationError(
            f"Invalid schema_version: expected '{SCHEMA_VERSION}', got '{schema_version}'"
        )

    _require_type(payload, "generated_at_utc", str)
    _require_type(payload, "source", str)
    _require_type(payload, "model", str)
    _require_type(payload, "forecast_days", int)
    _require_type(payload, "units", dict)
    _require_type(payload, "cache", dict)
    _require_type(payload, "resorts_count", int)
    _require_type(payload, "failed_count", int)
    _require_type(payload, "failed", list)
    _require_type(payload, "reports", list)

    for idx, item in enumerate(payload.get("failed", [])):
        if not isinstance(item, Mapping):
            raise ContractValidationError(f"Invalid failed[{idx}]: expected object")
        if not isinstance(item.get("query"), str):
            raise ContractValidationError(f"Invalid failed[{idx}].query: expected str")
        if not isinstance(item.get("reason"), str):
            raise ContractValidationError(f"Invalid failed[{idx}].reason: expected str")

    for idx, report in enumerate(payload.get("reports", [])):
        if not isinstance(report, Mapping):
            raise ContractValidationError(f"Invalid reports[{idx}]: expected object")
        if not isinstance(report.get("query"), str):
            raise ContractValidationError(f"Invalid reports[{idx}].query: expected str")
        if not isinstance(report.get("daily"), list):
            raise ContractValidationError(f"Invalid reports[{idx}].daily: expected list")
        country_code = report.get("country_code")
        if (
            not isinstance(country_code, str)
            or len(country_code) != 2
            or not country_code.isalpha()
            or country_code != country_code.upper()
        ):
            raise ContractValidationError(
                f"Invalid reports[{idx}].country_code: expected 2-letter uppercase country code"
            )

        map_context = report.get("map_context")
        if not isinstance(map_context, Mapping):
            raise ContractValidationError(f"Invalid reports[{idx}].map_context: expected object")
        if not isinstance(map_context.get("eligible"), bool):
            raise ContractValidationError(f"Invalid reports[{idx}].map_context.eligible: expected bool")

        latitude = map_context.get("latitude")
        longitude = map_context.get("longitude")
        _require_report_number(latitude, f"reports[{idx}].map_context.latitude", allow_none=True)
        _require_report_number(longitude, f"reports[{idx}].map_context.longitude", allow_none=True)
        _require_report_number(map_context.get("today_snowfall_cm"), f"reports[{idx}].map_context.today_snowfall_cm")
        _require_report_number(
            map_context.get("next_72h_snowfall_cm"),
            f"reports[{idx}].map_context.next_72h_snowfall_cm",
        )
        _require_report_number(
            map_context.get("week1_total_snowfall_cm"),
            f"reports[{idx}].map_context.week1_total_snowfall_cm",
        )

        expected_eligible = country_code == "US" and latitude is not None and longitude is not None
        if map_context.get("eligible") is not expected_eligible:
            raise ContractValidationError(
                f"Invalid reports[{idx}].map_context.eligible: expected eligibility to match country/coordinates"
            )
