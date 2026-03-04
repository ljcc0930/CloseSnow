from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

from src.contract import validate_weather_payload_v1


def load_static_payload(path: str) -> Dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    validate_weather_payload_v1(payload)
    return payload
