from __future__ import annotations

from copy import deepcopy

import pytest

from src.contract.validators import ContractValidationError, validate_weather_payload_v1


def test_validate_weather_payload_v1_success(valid_payload):
    validate_weather_payload_v1(valid_payload)


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("generated_at_utc", 123),
        ("source", 123),
        ("model", 123),
        ("forecast_days", "15"),
        ("units", []),
        ("cache", []),
        ("resorts_count", "1"),
        ("failed_count", "0"),
        ("failed", {}),
        ("reports", {}),
    ],
)
def test_validate_weather_payload_v1_rejects_bad_top_level_types(valid_payload, key, value):
    payload = deepcopy(valid_payload)
    payload[key] = value
    with pytest.raises(ContractValidationError):
        validate_weather_payload_v1(payload)


def test_validate_weather_payload_v1_rejects_non_mapping():
    with pytest.raises(ContractValidationError, match="Payload must be a mapping"):
        validate_weather_payload_v1([])  # type: ignore[arg-type]


def test_validate_weather_payload_v1_rejects_schema_version(valid_payload):
    payload = deepcopy(valid_payload)
    payload["schema_version"] = "weather_payload_v0"
    with pytest.raises(ContractValidationError, match="Invalid schema_version"):
        validate_weather_payload_v1(payload)


def test_validate_weather_payload_v1_rejects_failed_item_shape(valid_payload):
    payload = deepcopy(valid_payload)
    payload["failed"] = [{"query": "A"}]
    with pytest.raises(ContractValidationError, match=r"failed\[0\]\.reason"):
        validate_weather_payload_v1(payload)


def test_validate_weather_payload_v1_rejects_report_shape(valid_payload):
    payload = deepcopy(valid_payload)
    payload["reports"] = [{"query": "A"}]
    with pytest.raises(ContractValidationError, match=r"reports\[0\]\.daily"):
        validate_weather_payload_v1(payload)

