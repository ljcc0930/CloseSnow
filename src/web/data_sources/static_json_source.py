from __future__ import annotations

import json
from pathlib import Path

from src.contract import WeatherPayloadV1, validate_weather_payload_v1


def load_static_payload(path: str) -> WeatherPayloadV1:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    validate_weather_payload_v1(payload)
    return payload
