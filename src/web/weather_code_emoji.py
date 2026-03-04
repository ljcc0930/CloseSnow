#!/usr/bin/env python3
from __future__ import annotations

from typing import Any


def emoji_for_weather_code(raw_code: Any) -> str:
    try:
        code = int(raw_code)
    except (TypeError, ValueError):
        return "❓"

    if code == 0:
        return "☀️"
    if code in {1}:
        return "🌤️"
    if code in {2}:
        return "⛅"
    if code in {3}:
        return "☁️"
    if code in {45, 48}:
        return "🌫️"
    if code in {51, 53, 55, 56, 57}:
        return "🌦️"
    if code in {61, 63, 65, 80, 81, 82}:
        return "🌧️"
    if code in {71, 73, 75, 77, 85, 86}:
        return "❄️"
    if code in {95, 96, 99}:
        return "⛈️"
    return "❓"
