from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, Tuple
from urllib.parse import quote, urlencode, urlsplit, urlunsplit

from src.backend.services.hourly_payload_service import build_hourly_payload_for_resort

_HOURLY_METRIC_KEYS = [
    "snowfall",
    "rain",
    "precipitation_probability",
    "snow_depth",
    "wind_speed_10m",
    "wind_direction_10m",
    "visibility",
]


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
    try:
        payload = build_hourly_payload_for_resort(
            resort_id=resort_id,
            hours=hours,
            cache_file=cache_file,
            geocode_cache_hours=geocode_cache_hours,
            forecast_cache_hours=forecast_cache_hours,
        )
    except Exception as exc:  # noqa: BLE001
        return 502, {"error": str(exc)}
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


def _trim_hourly_payload(payload: Dict[str, Any], hours: int) -> Dict[str, Any]:
    hourly = payload.get("hourly", {}) if isinstance(payload, dict) else {}
    times = list(hourly.get("time", [])) if isinstance(hourly, dict) and isinstance(hourly.get("time"), list) else []
    requested_hours = max(1, int(hours))
    n = min(requested_hours, len(times))
    trimmed_hourly: Dict[str, Any] = {"time": times[:n]}
    for key in _HOURLY_METRIC_KEYS:
        values = hourly.get(key, []) if isinstance(hourly, dict) else []
        trimmed_hourly[key] = values[:n] if isinstance(values, list) else []
    return {
        **payload,
        "hours": n,
        "hourly": trimmed_hourly,
    }


def _load_file_hourly_payload(
    *,
    source: str,
    resort_id: str,
    hours: int,
) -> Tuple[int, Dict[str, Any]]:
    source_path = Path(source)
    site_root = source_path if source_path.is_dir() else source_path.parent
    hourly_path = site_root / "resort" / quote(resort_id, safe="") / "hourly.json"
    try:
        with hourly_path.open("r", encoding="utf-8") as f:
            payload = json.load(f)
    except FileNotFoundError:
        return 404, {"error": f"Hourly file not found for resort_id: {resort_id}"}
    except json.JSONDecodeError as exc:
        return 502, {"error": f"Invalid hourly JSON for resort_id {resort_id}: {exc}"}
    except OSError as exc:
        return 500, {"error": str(exc)}
    if not isinstance(payload, dict):
        return 502, {"error": f"Invalid hourly payload for resort_id: {resort_id}"}
    if "error" in payload:
        return 502, payload
    return 200, _trim_hourly_payload(payload, hours)


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
        return _load_file_hourly_payload(source=source, resort_id=resort_id, hours=hours)
    raise ValueError(f"Unsupported data source mode: {mode}")
