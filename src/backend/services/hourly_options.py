from __future__ import annotations

from typing import Any

from src.backend.constants import DEFAULT_HOURLY_HOURS, MAX_HOURLY_HOURS


def parse_hour_count(raw: Any, default: int = DEFAULT_HOURLY_HOURS) -> int:
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = default
    return max(1, min(MAX_HOURLY_HOURS, value))
