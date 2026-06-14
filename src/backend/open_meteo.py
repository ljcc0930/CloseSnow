from __future__ import annotations

import asyncio
import gzip
import json
import math
import ssl
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional

from src.backend.cache import JsonCache, ResortCoordinateCache, canonical_query
from src.backend.constants import (
    API_RETRY_DELAY_SECONDS,
    API_RETRY_TIMES,
    DEFAULT_HOURLY_HOURS,
    ECMWF_MODEL,
    FORECAST_DAYS,
    FORECAST_URL,
    GEOCODING_URL,
    HISTORY_DAYS,
    MAX_HOURLY_FORECAST_DAYS,
    NOMINATIM_URL,
)
from src.backend.models import ResortLocation
from src.contract.hourly_payload import HOURLY_METRIC_KEYS
from src.shared.retry import with_retry, with_retry_async

_USER_AGENT = "ecmwf-unified-backend/1.0 (+local script)"
_DAILY_FIELDS = (
    "snowfall_sum,rain_sum,precipitation_sum,temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset"
)
_HOURLY_FIELDS = ",".join(HOURLY_METRIC_KEYS)
STATE_ABBR_TO_NAME = {
    "al": "alabama",
    "ak": "alaska",
    "az": "arizona",
    "ar": "arkansas",
    "ca": "california",
    "co": "colorado",
    "ct": "connecticut",
    "de": "delaware",
    "fl": "florida",
    "ga": "georgia",
    "hi": "hawaii",
    "id": "idaho",
    "il": "illinois",
    "in": "indiana",
    "ia": "iowa",
    "ks": "kansas",
    "ky": "kentucky",
    "la": "louisiana",
    "me": "maine",
    "md": "maryland",
    "ma": "massachusetts",
    "mi": "michigan",
    "mn": "minnesota",
    "ms": "mississippi",
    "mo": "missouri",
    "mt": "montana",
    "ne": "nebraska",
    "nv": "nevada",
    "nh": "new hampshire",
    "nj": "new jersey",
    "nm": "new mexico",
    "ny": "new york",
    "nc": "north carolina",
    "nd": "north dakota",
    "oh": "ohio",
    "ok": "oklahoma",
    "or": "oregon",
    "pa": "pennsylvania",
    "ri": "rhode island",
    "sc": "south carolina",
    "sd": "south dakota",
    "tn": "tennessee",
    "tx": "texas",
    "ut": "utah",
    "vt": "vermont",
    "va": "virginia",
    "wa": "washington",
    "wv": "west virginia",
    "wi": "wisconsin",
    "wy": "wyoming",
}


def _cache_key(namespace: str, url: str, query: str) -> str:
    return f"{namespace}:{url}?{query}"


def _decode_chunked_body(body: bytes) -> bytes:
    decoded = bytearray()
    pos = 0
    while True:
        line_end = body.find(b"\r\n", pos)
        if line_end < 0:
            raise urllib.error.URLError("invalid chunked response")
        size_text = body[pos:line_end].split(b";", 1)[0].strip()
        try:
            size = int(size_text, 16)
        except ValueError as exc:
            raise urllib.error.URLError("invalid chunk size") from exc
        pos = line_end + 2
        if size == 0:
            return bytes(decoded)
        chunk_end = pos + size
        if len(body) < chunk_end + 2 or body[chunk_end : chunk_end + 2] != b"\r\n":
            raise urllib.error.URLError("truncated chunked response")
        decoded.extend(body[pos:chunk_end])
        pos = chunk_end + 2


def _json_from_http_response(raw: bytes, url: str) -> Any:
    header_end = raw.find(b"\r\n\r\n")
    if header_end < 0:
        raise urllib.error.URLError("invalid HTTP response")

    head = raw[:header_end].decode("iso-8859-1")
    body = raw[header_end + 4 :]
    lines = head.split("\r\n")
    status_parts = lines[0].split(" ", 2)
    if len(status_parts) < 2 or not status_parts[1].isdigit():
        raise urllib.error.URLError("invalid HTTP status line")

    status = int(status_parts[1])
    reason = status_parts[2] if len(status_parts) > 2 else ""
    headers: Dict[str, str] = {}
    for line in lines[1:]:
        if ":" not in line:
            continue
        name, value = line.split(":", 1)
        headers[name.strip().lower()] = value.strip()

    if "chunked" in headers.get("transfer-encoding", "").lower():
        body = _decode_chunked_body(body)
    if "gzip" in headers.get("content-encoding", "").lower():
        body = gzip.decompress(body)
    if status < 200 or status >= 300:
        raise urllib.error.HTTPError(url, status, reason, hdrs=None, fp=None)
    return json.loads(body.decode("utf-8"))


def _request_target(path: str, query: str) -> str:
    return urllib.parse.urlunsplit(("", "", path or "/", query, ""))


def _host_header(hostname: str, port: Optional[int], default_port: int) -> str:
    host = hostname
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    if port is not None and port != default_port:
        return f"{host}:{port}"
    return host


async def _request_json_async(url: str, timeout: int = 20) -> Any:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in {"http", "https"}:
        raise urllib.error.URLError(f"unsupported URL scheme: {parsed.scheme}")
    if not parsed.hostname:
        raise urllib.error.URLError("missing URL hostname")

    is_https = parsed.scheme == "https"
    default_port = 443 if is_https else 80
    port = parsed.port or default_port
    ssl_context = ssl.create_default_context() if is_https else None
    server_hostname = parsed.hostname if is_https else None
    reader, writer = await asyncio.wait_for(
        asyncio.open_connection(parsed.hostname, port, ssl=ssl_context, server_hostname=server_hostname),
        timeout=timeout,
    )
    try:
        request = "\r\n".join(
            [
                f"GET {_request_target(parsed.path, parsed.query)} HTTP/1.1",
                f"Host: {_host_header(parsed.hostname, parsed.port, default_port)}",
                f"User-Agent: {_USER_AGENT}",
                "Accept: application/json",
                "Connection: close",
                "",
                "",
            ]
        )
        writer.write(request.encode("ascii"))
        await asyncio.wait_for(writer.drain(), timeout=timeout)
        raw = await asyncio.wait_for(reader.read(), timeout=timeout)
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
    return _json_from_http_response(raw, url)


def fetch_json(
    url: str,
    params: Dict[str, Any],
    cache: JsonCache,
    namespace: str,
    ttl_seconds: int,
    timeout: int = 20,
    api_retries: int = API_RETRY_TIMES,
) -> Any:
    query = canonical_query(params)
    key = _cache_key(namespace, url, query)
    cached = cache.get(key, ttl_seconds)
    if cached is not None:
        return cached

    req = urllib.request.Request(
        f"{url}?{query}",
        headers={
            "User-Agent": _USER_AGENT,
            "Accept": "application/json",
        },
    )

    def do_request() -> Any:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))

    payload = with_retry(do_request, retries=api_retries, retry_delay_seconds=API_RETRY_DELAY_SECONDS)
    cache.set(key, payload)
    return payload


async def fetch_json_async(
    url: str,
    params: Dict[str, Any],
    cache: JsonCache,
    namespace: str,
    ttl_seconds: int,
    timeout: int = 20,
    api_retries: int = API_RETRY_TIMES,
) -> Any:
    query = canonical_query(params)
    key = _cache_key(namespace, url, query)
    cached = cache.get(key, ttl_seconds)
    if cached is not None:
        return cached

    payload = await with_retry_async(
        lambda: _request_json_async(f"{url}?{query}", timeout=timeout),
        retries=api_retries,
        retry_delay_seconds=API_RETRY_DELAY_SECONDS,
    )
    cache.set(key, payload)
    return payload


def _geocode_queries(name: str) -> list[str]:
    base = (name or "").strip()
    if not base:
        return []
    queries: list[str] = []
    seen = set()

    def add(q: str) -> None:
        v = q.strip()
        k = v.lower()
        if v and k not in seen:
            seen.add(k)
            queries.append(v)

    add(base)
    if "," in base:
        parts = [p.strip() for p in base.split(",", 1)]
        resort = parts[0]
        state = parts[1].lower()
        add(resort)
        full_state = STATE_ABBR_TO_NAME.get(state)
        if full_state:
            add(f"{resort}, {full_state}")
            add(f"{resort} {full_state}")
    return queries


def _location_from_coordinate_cache(name: str, cached_loc: Dict[str, Any]) -> ResortLocation:
    return ResortLocation(
        query=name,
        name=str(cached_loc.get("name", name)),
        latitude=float(cached_loc["latitude"]),
        longitude=float(cached_loc["longitude"]),
        country=cached_loc.get("country"),
        admin1=cached_loc.get("admin1"),
    )


def _coordinate_cache_payload(location: ResortLocation) -> Dict[str, Any]:
    return {
        "name": location.name,
        "latitude": location.latitude,
        "longitude": location.longitude,
        "country": location.country,
        "admin1": location.admin1,
    }


def _remember_location(
    name: str,
    location: ResortLocation,
    coord_cache: Optional[ResortCoordinateCache],
) -> None:
    if coord_cache is not None:
        coord_cache.set(name, _coordinate_cache_payload(location))


def _cached_location(name: str, coord_cache: Optional[ResortCoordinateCache]) -> Optional[ResortLocation]:
    if coord_cache is None:
        return None
    cached_loc = coord_cache.get(name)
    if cached_loc:
        return _location_from_coordinate_cache(name, cached_loc)
    return None


def _openmeteo_geocode_params(query: str) -> Dict[str, Any]:
    return {"name": query, "count": 1, "language": "en", "format": "json"}


def _nominatim_geocode_params(query: str) -> Dict[str, Any]:
    return {"q": query, "format": "jsonv2", "limit": 1, "addressdetails": 1}


def _location_from_openmeteo_data(name: str, data: Any) -> Optional[ResortLocation]:
    results = data.get("results") if isinstance(data, dict) else None
    if not results:
        return None
    top = results[0]
    return ResortLocation(
        query=name,
        name=top.get("name", name),
        latitude=float(top["latitude"]),
        longitude=float(top["longitude"]),
        country=top.get("country"),
        admin1=top.get("admin1"),
    )


def _location_from_nominatim_data(name: str, data: Any) -> Optional[ResortLocation]:
    if not isinstance(data, list) or not data:
        return None
    top = data[0]
    addr = top.get("address", {})
    return ResortLocation(
        query=name,
        name=top.get("display_name", name),
        latitude=float(top["lat"]),
        longitude=float(top["lon"]),
        country=addr.get("country"),
        admin1=addr.get("state") or addr.get("region"),
    )


_GEOCODE_PROVIDERS = (
    (
        GEOCODING_URL,
        "geocode_openmeteo",
        _openmeteo_geocode_params,
        _location_from_openmeteo_data,
    ),
    (
        NOMINATIM_URL,
        "geocode_nominatim",
        _nominatim_geocode_params,
        _location_from_nominatim_data,
    ),
)


def geocode(
    name: str,
    cache: JsonCache,
    ttl_seconds: int,
    coord_cache: Optional[ResortCoordinateCache] = None,
    api_retries: int = API_RETRY_TIMES,
) -> Optional[ResortLocation]:
    cached = _cached_location(name, coord_cache)
    if cached:
        return cached

    for url, namespace, params_for_query, location_from_data in _GEOCODE_PROVIDERS:
        for query in _geocode_queries(name):
            data = fetch_json(
                url,
                params_for_query(query),
                cache=cache,
                namespace=namespace,
                ttl_seconds=ttl_seconds,
                api_retries=api_retries,
            )
            location = location_from_data(name, data)
            if location:
                _remember_location(name, location, coord_cache)
                return location
    return None


def _forecast_params(location: ResortLocation) -> Dict[str, Any]:
    return {
        "latitude": location.latitude,
        "longitude": location.longitude,
        "forecast_days": FORECAST_DAYS,
        "timezone": "auto",
        "models": ECMWF_MODEL,
        "daily": _DAILY_FIELDS,
    }


def _history_params(location: ResortLocation) -> Dict[str, Any]:
    # Use forecast API convenience flag for recent history.
    # API returns past days + today; report builder keeps only the first N completed days.
    return {
        "latitude": location.latitude,
        "longitude": location.longitude,
        "past_days": HISTORY_DAYS,
        "forecast_days": 1,
        "timezone": "auto",
        "daily": _DAILY_FIELDS,
    }


def _hourly_params(location: ResortLocation, hours: int = DEFAULT_HOURLY_HOURS) -> Dict[str, Any]:
    requested_hours = max(1, int(hours))
    forecast_days = max(1, min(MAX_HOURLY_FORECAST_DAYS, math.ceil(requested_hours / 24)))
    return {
        "latitude": location.latitude,
        "longitude": location.longitude,
        "forecast_days": forecast_days,
        "timezone": "auto",
        "models": ECMWF_MODEL,
        "hourly": _HOURLY_FIELDS,
    }


def fetch_forecast(
    location: ResortLocation,
    cache: JsonCache,
    ttl_seconds: int,
    api_retries: int = API_RETRY_TIMES,
) -> Dict[str, Any]:
    return fetch_json(
        FORECAST_URL,
        _forecast_params(location),
        cache=cache,
        namespace="forecast_ecmwf_unified",
        ttl_seconds=ttl_seconds,
        api_retries=api_retries,
    )


def fetch_history(
    location: ResortLocation,
    cache: JsonCache,
    ttl_seconds: int,
    api_retries: int = API_RETRY_TIMES,
) -> Dict[str, Any]:
    return fetch_json(
        FORECAST_URL,
        _history_params(location),
        cache=cache,
        namespace="history_ecmwf_unified",
        ttl_seconds=ttl_seconds,
        api_retries=api_retries,
    )


def fetch_hourly_forecast(
    location: ResortLocation,
    cache: JsonCache,
    ttl_seconds: int,
    hours: int = DEFAULT_HOURLY_HOURS,
    api_retries: int = API_RETRY_TIMES,
) -> Dict[str, Any]:
    return fetch_json(
        FORECAST_URL,
        _hourly_params(location, hours),
        cache=cache,
        namespace="hourly_ecmwf_unified",
        ttl_seconds=ttl_seconds,
        api_retries=api_retries,
    )


async def geocode_async(
    name: str,
    cache: JsonCache,
    ttl_seconds: int,
    coord_cache: Optional[ResortCoordinateCache] = None,
    api_retries: int = API_RETRY_TIMES,
) -> Optional[ResortLocation]:
    cached = _cached_location(name, coord_cache)
    if cached:
        return cached

    for url, namespace, params_for_query, location_from_data in _GEOCODE_PROVIDERS:
        for query in _geocode_queries(name):
            data = await fetch_json_async(
                url,
                params_for_query(query),
                cache=cache,
                namespace=namespace,
                ttl_seconds=ttl_seconds,
                api_retries=api_retries,
            )
            location = location_from_data(name, data)
            if location:
                _remember_location(name, location, coord_cache)
                return location
    return None


async def fetch_forecast_async(
    location: ResortLocation,
    cache: JsonCache,
    ttl_seconds: int,
    api_retries: int = API_RETRY_TIMES,
) -> Dict[str, Any]:
    return await fetch_json_async(
        FORECAST_URL,
        _forecast_params(location),
        cache=cache,
        namespace="forecast_ecmwf_unified",
        ttl_seconds=ttl_seconds,
        api_retries=api_retries,
    )


async def fetch_history_async(
    location: ResortLocation,
    cache: JsonCache,
    ttl_seconds: int,
    api_retries: int = API_RETRY_TIMES,
) -> Dict[str, Any]:
    return await fetch_json_async(
        FORECAST_URL,
        _history_params(location),
        cache=cache,
        namespace="history_ecmwf_unified",
        ttl_seconds=ttl_seconds,
        api_retries=api_retries,
    )


async def fetch_hourly_forecast_async(
    location: ResortLocation,
    cache: JsonCache,
    ttl_seconds: int,
    hours: int = DEFAULT_HOURLY_HOURS,
    api_retries: int = API_RETRY_TIMES,
) -> Dict[str, Any]:
    return await fetch_json_async(
        FORECAST_URL,
        _hourly_params(location, hours),
        cache=cache,
        namespace="hourly_ecmwf_unified",
        ttl_seconds=ttl_seconds,
        api_retries=api_retries,
    )
