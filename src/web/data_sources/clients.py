from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Protocol

from src.web.data_sources.api_source import load_api_payload
from src.web.data_sources.static_json_source import load_static_payload


class PayloadClient(Protocol):
    def load(self) -> Dict[str, Any]:
        ...


@dataclass(frozen=True)
class FilePayloadClient:
    path: str

    def load(self) -> Dict[str, Any]:
        return load_static_payload(self.path)


@dataclass(frozen=True)
class HttpPayloadClient:
    url: str
    timeout: int = 20

    def load(self) -> Dict[str, Any]:
        return load_api_payload(self.url, timeout=self.timeout)
