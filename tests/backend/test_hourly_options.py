from __future__ import annotations

from src.backend.constants import DEFAULT_HOURLY_HOURS, MAX_HOURLY_HOURS
from src.backend.services.hourly_options import parse_hour_count


def test_parse_hour_count_clamps_to_supported_range():
    assert parse_hour_count("0") == 1
    assert parse_hour_count("-10") == 1
    assert parse_hour_count(str(MAX_HOURLY_HOURS + 1)) == MAX_HOURLY_HOURS


def test_parse_hour_count_uses_default_for_invalid_values():
    assert parse_hour_count("") == DEFAULT_HOURLY_HOURS
    assert parse_hour_count(None) == DEFAULT_HOURLY_HOURS
    assert parse_hour_count("bad", default=48) == 48


def test_parse_hour_count_accepts_integer_input():
    assert parse_hour_count(36) == 36
