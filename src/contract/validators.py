from __future__ import annotations

from typing import Any, Mapping

from src.contract.weather_payload_v1 import (
    DAILY_NUMBER_FIELDS,
    DAILY_TIME_FIELDS,
    REPORT_NUMBER_FIELDS,
    REPORT_STRING_FIELDS,
    SCHEMA_VERSION,
)


class ContractValidationError(ValueError):
    pass


def _require_type(payload: Mapping[str, Any], key: str, expected_type: type) -> None:
    value = payload.get(key)
    if not isinstance(value, expected_type):
        raise ContractValidationError(f"Invalid type for '{key}': expected {expected_type.__name__}")


def _require_optional_type(payload: Mapping[str, Any], key: str, expected_types: tuple[type, ...], path: str) -> None:
    if key not in payload or payload.get(key) is None:
        return
    if not isinstance(payload.get(key), expected_types):
        expected = " or ".join(t.__name__ for t in expected_types)
        raise ContractValidationError(f"Invalid {path}.{key}: expected {expected} or null")


def _require_optional_number(payload: Mapping[str, Any], key: str, path: str) -> None:
    _require_optional_type(payload, key, (int, float), path)


def _validate_daily_row(row: Any, path: str) -> None:
    if not isinstance(row, Mapping):
        raise ContractValidationError(f"Invalid {path}: expected object")
    _require_optional_type(row, "date", (str,), path)
    for key in DAILY_NUMBER_FIELDS:
        _require_optional_number(row, key, path)
    _require_optional_type(row, "weather_code", (int,), path)
    for key in DAILY_TIME_FIELDS:
        _require_optional_type(row, key, (str,), path)
    _require_optional_type(row, "above_0", (int,), path)


def _validate_daily_list(report: Mapping[str, Any], key: str, path: str) -> None:
    value = report.get(key)
    if value is None:
        return
    if not isinstance(value, list):
        raise ContractValidationError(f"Invalid {path}.{key}: expected list")
    for idx, row in enumerate(value):
        _validate_daily_row(row, f"{path}.{key}[{idx}]")


def validate_weather_payload_v1(payload: Mapping[str, Any]) -> None:
    if not isinstance(payload, Mapping):
        raise ContractValidationError("Payload must be a mapping")

    schema_version = payload.get("schema_version")
    if schema_version != SCHEMA_VERSION:
        raise ContractValidationError(f"Invalid schema_version: expected '{SCHEMA_VERSION}', got '{schema_version}'")

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
        path = f"reports[{idx}]"
        for key in REPORT_STRING_FIELDS:
            _require_optional_type(report, key, (str,), path)
        for key in REPORT_NUMBER_FIELDS:
            _require_optional_number(report, key, path)
        if "pass_types" in report and not isinstance(report.get("pass_types"), list):
            raise ContractValidationError(f"Invalid {path}.pass_types: expected list")
        _validate_daily_list(report, "daily", path)
        _validate_daily_list(report, "past_14d_daily", path)
