#!/usr/bin/env python3
from __future__ import annotations

from typing import Any

UNKNOWN_WEATHER_EMOJI = "❓"
WEATHER_CODE_EMOJI_GROUPS = (
    ((0,), "☀️"),
    ((1,), "🌤️"),
    ((2,), "⛅"),
    ((3,), "☁️"),
    ((45, 48), "🌫️"),
    ((51, 53, 55, 56, 57), "🌦️"),
    ((61, 63, 65, 80, 81, 82), "🌧️"),
    ((71, 73, 75, 77, 85, 86), "❄️"),
    ((95, 96, 99), "⛈️"),
)


def emoji_for_weather_code(raw_code: Any) -> str:
    try:
        code = int(raw_code)
    except (TypeError, ValueError):
        return UNKNOWN_WEATHER_EMOJI

    for codes, emoji in WEATHER_CODE_EMOJI_GROUPS:
        if code in codes:
            return emoji
    return UNKNOWN_WEATHER_EMOJI
