from __future__ import annotations

import json
import urllib.request
from typing import Any, Dict

from src.contract import validate_weather_payload_v1


def load_api_payload(url: str, timeout: int = 20) -> Dict[str, Any]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "closesnow-data-source/1.0",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    validate_weather_payload_v1(payload)
    return payload
