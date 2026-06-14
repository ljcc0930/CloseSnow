#!/usr/bin/env python3
from __future__ import annotations

from src.contract import WeatherPayloadV1
from src.web.weather_html_renderer import build_html


def render_payload_html(payload: WeatherPayloadV1, *, data_url: str = "./data.json") -> str:
    return build_html(
        [],
        [],
        [],
        [],
        [],
        data_url=data_url,
        initial_payload=payload,
        available_filters=(
            payload.get("available_filters") if isinstance(payload.get("available_filters"), dict) else None
        ),
        applied_filters=(payload.get("applied_filters") if isinstance(payload.get("applied_filters"), dict) else None),
    )
