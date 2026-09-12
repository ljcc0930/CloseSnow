#!/usr/bin/env python3
from __future__ import annotations

import html
import math
from typing import Optional


def to_float(value: str) -> Optional[float]:
    v = (value or "").strip()
    if v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _finite_number(value: Optional[float]) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return number if math.isfinite(number) else None


def _heat_background(token: str) -> str:
    return f"background:var(--heat-{token});"


def _heat_mix(start: str, end: str, fraction: float) -> str:
    if fraction <= 0:
        return _heat_background(start)
    if fraction >= 1:
        return _heat_background(end)
    percentage = f"{fraction * 100:.4f}".rstrip("0").rstrip(".")
    return f"background:color-mix(in srgb, var(--heat-{start}), var(--heat-{end}) {percentage}%);"


# Compatibility renderers share the browser palette and thresholds. The
# cross-language weather color tests keep these adapters in sync with
# assets/js/weather_colors.js; actual RGB colors live only in design_system.css.
def snow_color(v: Optional[float]) -> str:
    number = _finite_number(v)
    if number is None:
        return ""
    if number > 15:
        return _heat_background("snow-heavy")
    return _heat_mix("surface", "snow", max(number, 0.0) / 15.0)


def temp_color(v: Optional[float]) -> str:
    number = _finite_number(v)
    if number is None:
        return ""
    if number < -10:
        return _heat_background("cold")
    if number < 0:
        return _heat_mix("cold", "freezing", (number + 10.0) / 10.0)
    if number <= 4:
        return _heat_background("surface")
    if number <= 20:
        return _heat_mix("surface", "warm", (number - 4.0) / 16.0)
    return _heat_background("hot")


def rain_color(v: Optional[float]) -> str:
    number = _finite_number(v)
    if number is None:
        return ""
    return _heat_mix("surface", "rain", number / 7.6)


def render_measure_cell(raw_value: str, kind: str, style: str = "", klass: str = "") -> str:
    class_attr = f" class='{klass}'" if klass else ""
    style_attr = f" style='{style}'" if style else ""
    value = (raw_value or "").strip()
    escaped = html.escape(raw_value)
    numeric = to_float(value)
    if numeric is None:
        return f"<td{class_attr}{style_attr}>{escaped}</td>"
    return f"<td{class_attr}{style_attr} data-kind='{kind}' data-metric-value='{numeric:.6f}'>{escaped}</td>"
