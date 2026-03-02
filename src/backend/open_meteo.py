from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, Optional, TypeVar

from src.backend.cache import JsonCache, ResortCoordinateCache, canonical_query
from src.backend.constants import (
    API_RETRY_TIMES,
    FORECAST_DAYS,
    FORECAST_URL,
    GEOCODING_URL,
    HISTORY_DAYS,
    NOMINATIM_URL,
)
from src.backend.models import ResortLocation

T = TypeVar("T")
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


def with_retry(fn: Callable[[], T], retries: int = API_RETRY_TIMES, base_delay_seconds: float = 0.5) -> T:
    attempts = max(1, retries + 1)
    last_exc: Optional[Exception] = None
    for attempt in range(attempts):
        try:
            return fn()
        except urllib.error.HTTPError as exc:
            # Retry only transient HTTP failures.
            if exc.code != 429 and exc.code < 500:
                raise
            last_exc = exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_exc = exc

        if attempt < attempts - 1:
            time.sleep(base_delay_seconds * (2**attempt))

    assert last_exc is not None
    raise last_exc


def fetch_json(
    url: str,
    params: Dict[str, Any],
    cache: JsonCache,
    namespace: str,
    ttl_seconds: int,
    timeout: int = 20,
) -> Any:
    query = canonical_query(params)
    key = f"{namespace}:{url}?{query}"
    cached = cache.get(key, ttl_seconds)
    if cached is not None:
        return cached

    req = urllib.request.Request(
        f"{url}?{query}",
        headers={
            "User-Agent": "ecmwf-unified-backend/1.0 (+local script)",
            "Accept": "application/json",
        },
    )

    def do_request() -> Any:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))

    payload = with_retry(do_request)
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


def geocode(
    name: str,
    cache: JsonCache,
    ttl_seconds: int,
    coord_cache: Optional[ResortCoordinateCache] = None,
) -> Optional[ResortLocation]:
    if coord_cache is not None:
        cached_loc = coord_cache.get(name)
        if cached_loc:
            return ResortLocation(
                query=name,
                name=str(cached_loc.get("name", name)),
                latitude=float(cached_loc["latitude"]),
                longitude=float(cached_loc["longitude"]),
                country=cached_loc.get("country"),
                admin1=cached_loc.get("admin1"),
            )

    for query in _geocode_queries(name):
        data = fetch_json(
            GEOCODING_URL,
            {"name": query, "count": 1, "language": "en", "format": "json"},
            cache=cache,
            namespace="geocode_openmeteo",
            ttl_seconds=ttl_seconds,
        )
        results = data.get("results") or []
        if results:
            top = results[0]
            location = ResortLocation(
                query=name,
                name=top.get("name", name),
                latitude=float(top["latitude"]),
                longitude=float(top["longitude"]),
                country=top.get("country"),
                admin1=top.get("admin1"),
            )
            if coord_cache is not None:
                coord_cache.set(
                    name,
                    {
                        "name": location.name,
                        "latitude": location.latitude,
                        "longitude": location.longitude,
                        "country": location.country,
                        "admin1": location.admin1,
                    },
                )
            return location

    for query in _geocode_queries(name):
        data2 = fetch_json(
            NOMINATIM_URL,
            {"q": query, "format": "jsonv2", "limit": 1, "addressdetails": 1},
            cache=cache,
            namespace="geocode_nominatim",
            ttl_seconds=ttl_seconds,
        )
        if not data2:
            continue
        top2 = data2[0]
        addr = top2.get("address", {})
        location = ResortLocation(
            query=name,
            name=top2.get("display_name", name),
            latitude=float(top2["lat"]),
            longitude=float(top2["lon"]),
            country=addr.get("country"),
            admin1=addr.get("state") or addr.get("region"),
        )
        if coord_cache is not None:
            coord_cache.set(
                name,
                {
                    "name": location.name,
                    "latitude": location.latitude,
                    "longitude": location.longitude,
                    "country": location.country,
                    "admin1": location.admin1,
                },
            )
        return location
    return None


def fetch_forecast(location: ResortLocation, cache: JsonCache, ttl_seconds: int) -> Dict[str, Any]:
    return fetch_json(
        FORECAST_URL,
        {
            "latitude": location.latitude,
            "longitude": location.longitude,
            "forecast_days": FORECAST_DAYS,
            "timezone": "auto",
            "models": "ecmwf_ifs025",
            "daily": "snowfall_sum,rain_sum,precipitation_sum,temperature_2m_max,temperature_2m_min",
        },
        cache=cache,
        namespace="forecast_ecmwf_unified",
        ttl_seconds=ttl_seconds,
    )


def fetch_history(location: ResortLocation, cache: JsonCache, ttl_seconds: int) -> Dict[str, Any]:
    # Use forecast API convenience flag for recent history.
    # API returns past days + today; report builder keeps only the first N completed days.
    return fetch_json(
        FORECAST_URL,
        {
            "latitude": location.latitude,
            "longitude": location.longitude,
            "past_days": HISTORY_DAYS,
            "forecast_days": 1,
            "timezone": "auto",
            "daily": "snowfall_sum,rain_sum,precipitation_sum,temperature_2m_max,temperature_2m_min",
        },
        cache=cache,
        namespace="history_ecmwf_unified",
        ttl_seconds=ttl_seconds,
    )
