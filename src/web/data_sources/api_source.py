from __future__ import annotations

import json
import urllib.request
from typing import Any, Dict

from src.backend.constants import API_RETRY_TIMES
from src.contract import validate_weather_payload_v1
from src.shared.retry import with_retry


def load_api_payload(url: str, timeout: int = 20, api_retries: int = API_RETRY_TIMES) -> Dict[str, Any]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "closesnow-data-source/1.0",
            "Accept": "application/json",
        },
    )

    def do_request() -> Dict[str, Any]:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))

    payload = with_retry(do_request, retries=api_retries)
    validate_weather_payload_v1(payload)
    return payload
