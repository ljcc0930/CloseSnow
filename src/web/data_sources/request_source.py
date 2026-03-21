from __future__ import annotations

from typing import Any, Dict, List
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

from src.backend.services.resort_selection_service import (
    available_filters,
    build_empty_payload,
    default_applied_filters,
    load_supported_resort_catalog,
    select_resorts_from_query,
)
from src.web.data_sources.gateway import load_payload
from src.web.data_sources.local_source import load_local_payload

SERVER_FILTER_QUERY_KEYS = (
    "pass_type",
    "region",
    "subregion",
    "country",
    "search",
    "include_all",
    "include_default",
    "search_all",
)


def _append_query_values(base_url: str, qs: Dict[str, List[str]]) -> str:
    if not qs:
        return base_url
    parsed = urlsplit(base_url)
    merged = parse_qs(parsed.query, keep_blank_values=True)
    for key, values in qs.items():
        merged[key] = list(values)
    query = urlencode(merged, doseq=True)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, parsed.fragment))


def strip_server_filter_query(qs: Dict[str, List[str]]) -> Dict[str, List[str]]:
    return {key: list(values) for key, values in qs.items() if key not in SERVER_FILTER_QUERY_KEYS}


def _ensure_filter_metadata(payload: Dict[str, Any]) -> Dict[str, Any]:
    if "available_filters" not in payload:
        try:
            catalog = load_supported_resort_catalog()
            payload["available_filters"] = available_filters(catalog)
        except Exception:
            payload["available_filters"] = {"pass_type": {}, "region": {}, "subregion": {}, "country": {}}
    if "applied_filters" not in payload:
        payload["applied_filters"] = default_applied_filters()
    return payload


def load_request_payload(
    mode: str,
    source: str,
    *,
    query_params: Dict[str, List[str]] | None = None,
    apply_server_filters: bool = True,
    timeout: int = 20,
    cache_file: str = ".cache/open_meteo_cache.json",
    geocode_cache_hours: int = 24 * 30,
    forecast_cache_hours: int = 3,
    max_workers: int = 8,
) -> Dict[str, Any]:
    qs = {key: list(values) for key, values in (query_params or {}).items()}
    resorts = [x.strip() for x in qs.get("resort", []) if x.strip()]

    has_server_side_filters = apply_server_filters and any(qs.get(key) for key in SERVER_FILTER_QUERY_KEYS)
    if mode == "local" and has_server_side_filters:
        selected, _, applied, available, no_match = select_resorts_from_query(qs)
        if no_match:
            payload = build_empty_payload(
                cache_file=cache_file,
                geocode_cache_hours=geocode_cache_hours,
                forecast_cache_hours=forecast_cache_hours,
            )
        else:
            payload = load_local_payload(
                resorts=selected,
                cache_file=cache_file,
                geocode_cache_hours=geocode_cache_hours,
                forecast_cache_hours=forecast_cache_hours,
                max_workers=max_workers,
            )
        payload["available_filters"] = available
        payload["applied_filters"] = applied
        return payload

    request_source = source
    if mode == "api":
        request_source = _append_query_values(source, qs)

    payload = load_payload(
        mode=mode,
        source=request_source,
        timeout=timeout,
        resorts=resorts,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
        max_workers=max_workers,
    )
    return _ensure_filter_metadata(payload)
