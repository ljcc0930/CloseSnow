from __future__ import annotations

from typing import Any, Dict

from src.web.data_sources.api_source import load_api_payload
from src.web.data_sources.static_json_source import load_static_payload


def load_payload(mode: str, source: str) -> Dict[str, Any]:
    if mode == "api":
        return load_api_payload(source)
    if mode == "file":
        return load_static_payload(source)
    raise ValueError(f"Unsupported data source mode: {mode}")
