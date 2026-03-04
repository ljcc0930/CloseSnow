#!/usr/bin/env python3
from __future__ import annotations

from typing import Optional


def to_float(value: str) -> Optional[float]:
    v = (value or "").strip()
    if v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def snow_color(v: Optional[float]) -> str:
    if v is None:
        return ""
    if v > 15:
        return "background:#FFE7CC;"
    x = min(max(v, 0.0), 15.0) / 15.0
    r = round(255 + (207 - 255) * x)
    g = round(255 + (232 - 255) * x)
    b = round(255 + (255 - 255) * x)
    return f"background:rgb({r},{g},{b});"


def temp_color(v: Optional[float]) -> str:
    if v is None:
        return ""
    if v < -10:
        return "background:#CFE8FF;"
    if v < 0:
        x = (v + 10.0) / 10.0
        r = round(207 + (255 - 207) * x)
        g = round(232 + (255 - 232) * x)
        b = round(255 + (255 - 255) * x)
        return f"background:rgb({r},{g},{b});"
    if v <= 10:
        if v <= 0:
            return "background:#FFFFFF;"
        x = v / 10.0
        r = round(255 + (255 - 255) * x)
        g = round(255 + (214 - 255) * x)
        b = round(255 + (214 - 255) * x)
        return f"background:rgb({r},{g},{b});"
    return "background:#FFD6D6;"


def rain_color(v: Optional[float]) -> str:
    if v is None:
        return ""
    if v <= 0:
        return "background:#FFFFFF;"
    if v >= 10:
        return "background:#CFEFD8;"
    x = v / 10.0
    r = round(255 + (207 - 255) * x)
    g = round(255 + (239 - 255) * x)
    b = round(255 + (216 - 255) * x)
    return f"background:rgb({r},{g},{b});"
