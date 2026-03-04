from __future__ import annotations

from typing import Any, Mapping

from src.contract.weather_payload_v1 import SCHEMA_VERSION


class ContractValidationError(ValueError):
    pass


def _require_type(payload: Mapping[str, Any], key: str, expected_type: type) -> None:
    value = payload.get(key)
    if not isinstance(value, expected_type):
        raise ContractValidationError(f"Invalid type for '{key}': expected {expected_type.__name__}")


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
