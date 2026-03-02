from __future__ import annotations

import json
import urllib.request
from typing import Any, Dict, Optional

from src.backend.cache import JsonCache, canonical_query
from src.backend.constants import FORECAST_DAYS, FORECAST_URL, GEOCODING_URL, NOMINATIM_URL
from src.backend.models import ResortLocation


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
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    cache.set(key, payload)
    return payload


def geocode(name: str, cache: JsonCache, ttl_seconds: int) -> Optional[ResortLocation]:
    data = fetch_json(
        GEOCODING_URL,
        {"name": name, "count": 1, "language": "en", "format": "json"},
        cache=cache,
        namespace="geocode_openmeteo",
        ttl_seconds=ttl_seconds,
    )
    results = data.get("results") or []
    if results:
        top = results[0]
        return ResortLocation(
            query=name,
            name=top.get("name", name),
            latitude=float(top["latitude"]),
            longitude=float(top["longitude"]),
            country=top.get("country"),
            admin1=top.get("admin1"),
        )

    data2 = fetch_json(
        NOMINATIM_URL,
        {"q": name, "format": "jsonv2", "limit": 1, "addressdetails": 1},
        cache=cache,
        namespace="geocode_nominatim",
        ttl_seconds=ttl_seconds,
    )
    if not data2:
        return None
    top2 = data2[0]
    addr = top2.get("address", {})
    return ResortLocation(
        query=name,
        name=top2.get("display_name", name),
        latitude=float(top2["lat"]),
        longitude=float(top2["lon"]),
        country=addr.get("country"),
        admin1=addr.get("state") or addr.get("region"),
    )


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
