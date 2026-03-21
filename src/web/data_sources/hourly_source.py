from __future__ import annotations

import json
from typing import Any, Dict, Tuple
import urllib.error
import urllib.request
from urllib.parse import urlencode, urlsplit, urlunsplit

from src.backend.services.hourly_payload_service import build_hourly_payload_for_resort


def _hourly_endpoint_from_data_source(base_url: str) -> str:
    parsed = urlsplit(base_url)
    return urlunsplit((parsed.scheme, parsed.netloc, "/api/resort-hourly", "", ""))


def _load_local_hourly_payload(
    *,
    resort_id: str,
    hours: int,
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
) -> Tuple[int, Dict[str, Any]]:
    payload = build_hourly_payload_for_resort(
        resort_id=resort_id,
        hours=hours,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
    )
    if payload is None:
        return 404, {"error": f"Unknown resort_id: {resort_id}"}
    if "error" in payload:
        return 502, payload
    return 200, payload


def _load_api_hourly_payload(
    *,
    source: str,
    resort_id: str,
    hours: int,
    timeout: int,
) -> Tuple[int, Dict[str, Any]]:
    hourly_base = _hourly_endpoint_from_data_source(source)
    hourly_url = f"{hourly_base}?{urlencode({'resort_id': resort_id, 'hours': str(hours)})}"
    try:
        with urllib.request.urlopen(hourly_url, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return 200, json.loads(body)
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        try:
            payload = json.loads(error_body)
        except Exception:
            payload = {"error": error_body or f"HTTP {exc.code}"}
        return exc.code, payload
    except urllib.error.URLError as exc:
        return 502, {"error": str(exc)}
    except Exception as exc:
        return 500, {"error": str(exc)}


def load_hourly_payload(
    mode: str,
    source: str,
    *,
    resort_id: str,
    hours: int,
    timeout: int = 20,
    cache_file: str = ".cache/open_meteo_cache.json",
    geocode_cache_hours: int = 24 * 30,
    forecast_cache_hours: int = 3,
) -> Tuple[int, Dict[str, Any]]:
    if mode == "local":
        return _load_local_hourly_payload(
            resort_id=resort_id,
            hours=hours,
            cache_file=cache_file,
            geocode_cache_hours=geocode_cache_hours,
            forecast_cache_hours=forecast_cache_hours,
        )
    if mode == "api":
        return _load_api_hourly_payload(
            source=source,
            resort_id=resort_id,
            hours=hours,
            timeout=timeout,
        )
    if mode == "file":
        return 501, {"error": "Hourly endpoint unavailable in file mode"}
    raise ValueError(f"Unsupported data source mode: {mode}")
