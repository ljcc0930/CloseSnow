from __future__ import annotations

from typing import Any, Dict

from src.web.data_sources.clients import FilePayloadClient, HttpPayloadClient, PayloadClient


def build_payload_client(mode: str, source: str, timeout: int = 20) -> PayloadClient:
    if mode == "api":
        return HttpPayloadClient(url=source, timeout=timeout)
    if mode == "file":
        return FilePayloadClient(path=source)
    raise ValueError(f"Unsupported data source mode: {mode}")


def load_payload(mode: str, source: str, timeout: int = 20) -> Dict[str, Any]:
    return build_payload_client(mode=mode, source=source, timeout=timeout).load()
