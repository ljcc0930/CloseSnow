from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Protocol

from src.backend.constants import API_RETRY_TIMES
from src.web.data_sources.api_source import load_api_payload
from src.web.data_sources.local_source import load_local_payload
from src.web.data_sources.static_json_source import load_static_payload


class PayloadClient(Protocol):
    def load(self) -> Dict[str, Any]: ...


@dataclass(frozen=True)
class FilePayloadClient:
    path: str

    def load(self) -> Dict[str, Any]:
        return load_static_payload(self.path)


@dataclass(frozen=True)
class HttpPayloadClient:
    url: str
    timeout: int = 20
    api_retries: int = API_RETRY_TIMES

    def load(self) -> Dict[str, Any]:
        return load_api_payload(self.url, timeout=self.timeout, api_retries=self.api_retries)


@dataclass(frozen=True)
class LocalPayloadClient:
    resorts: list[str] = field(default_factory=list)
    cache_file: str = ".cache/open_meteo_cache.json"
    geocode_cache_hours: int = 24 * 30
    forecast_cache_hours: int = 3
    max_workers: int = 8
    api_retries: int = API_RETRY_TIMES

    def load(self) -> Dict[str, Any]:
        return load_local_payload(
            resorts=list(self.resorts),
            cache_file=self.cache_file,
            geocode_cache_hours=self.geocode_cache_hours,
            forecast_cache_hours=self.forecast_cache_hours,
            max_workers=self.max_workers,
            api_retries=self.api_retries,
        )
