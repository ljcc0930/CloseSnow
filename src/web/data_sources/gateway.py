from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.backend.constants import (
    API_RETRY_TIMES,
    DEFAULT_FORECAST_CACHE_HOURS,
    DEFAULT_GEOCODE_CACHE_HOURS,
    DEFAULT_MAX_WORKERS,
    DEFAULT_OPEN_METEO_CACHE_FILE,
)
from src.web.data_sources.clients import FilePayloadClient, HttpPayloadClient, LocalPayloadClient, PayloadClient


def build_payload_client(
    mode: str,
    source: str,
    timeout: int = 20,
    *,
    resorts: Optional[List[str]] = None,
    cache_file: str = DEFAULT_OPEN_METEO_CACHE_FILE,
    geocode_cache_hours: int = DEFAULT_GEOCODE_CACHE_HOURS,
    forecast_cache_hours: int = DEFAULT_FORECAST_CACHE_HOURS,
    max_workers: int = DEFAULT_MAX_WORKERS,
    api_retries: int = API_RETRY_TIMES,
) -> PayloadClient:
    if mode == "local":
        return LocalPayloadClient(
            resorts=list(resorts or []),
            cache_file=cache_file,
            geocode_cache_hours=geocode_cache_hours,
            forecast_cache_hours=forecast_cache_hours,
            max_workers=max_workers,
            api_retries=api_retries,
        )
    if mode == "api":
        return HttpPayloadClient(url=source, timeout=timeout, api_retries=api_retries)
    if mode == "file":
        return FilePayloadClient(path=source)
    raise ValueError(f"Unsupported data source mode: {mode}")


def load_payload(
    mode: str,
    source: str,
    timeout: int = 20,
    *,
    resorts: Optional[List[str]] = None,
    cache_file: str = DEFAULT_OPEN_METEO_CACHE_FILE,
    geocode_cache_hours: int = DEFAULT_GEOCODE_CACHE_HOURS,
    forecast_cache_hours: int = DEFAULT_FORECAST_CACHE_HOURS,
    max_workers: int = DEFAULT_MAX_WORKERS,
    api_retries: int = API_RETRY_TIMES,
) -> Dict[str, Any]:
    return build_payload_client(
        mode=mode,
        source=source,
        timeout=timeout,
        resorts=resorts,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
        max_workers=max_workers,
        api_retries=api_retries,
    ).load()
