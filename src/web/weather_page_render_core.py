#!/usr/bin/env python3
from __future__ import annotations

from typing import Any, Dict

from src.web.weather_html_renderer import build_html


def render_payload_html(payload: Dict[str, Any], *, data_url: str = "./data.json") -> str:
    return build_html(
        [],
        [],
        [],
        [],
        [],
        data_url=data_url,
        available_filters=(
            payload.get("available_filters")
            if isinstance(payload.get("available_filters"), dict)
            else None
        ),
        applied_filters=(
            payload.get("applied_filters")
            if isinstance(payload.get("applied_filters"), dict)
            else None
        ),
    )
