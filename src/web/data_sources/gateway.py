from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.web.data_sources.clients import FilePayloadClient, HttpPayloadClient, LocalPayloadClient, PayloadClient


def build_payload_client(
    mode: str,
    source: str,
    timeout: int = 20,
    *,
    resorts: Optional[List[str]] = None,
    cache_file: str = ".cache/open_meteo_cache.json",
    geocode_cache_hours: int = 24 * 30,
    forecast_cache_hours: int = 3,
    max_workers: int = 8,
) -> PayloadClient:
    if mode == "local":
        return LocalPayloadClient(
            resorts=list(resorts or []),
            cache_file=cache_file,
            geocode_cache_hours=geocode_cache_hours,
            forecast_cache_hours=forecast_cache_hours,
            max_workers=max_workers,
        )
    if mode == "api":
        return HttpPayloadClient(url=source, timeout=timeout)
    if mode == "file":
        return FilePayloadClient(path=source)
    raise ValueError(f"Unsupported data source mode: {mode}")


def load_payload(
    mode: str,
    source: str,
    timeout: int = 20,
    *,
    resorts: Optional[List[str]] = None,
    cache_file: str = ".cache/open_meteo_cache.json",
    geocode_cache_hours: int = 24 * 30,
    forecast_cache_hours: int = 3,
    max_workers: int = 8,
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
    ).load()
