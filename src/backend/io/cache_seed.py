from __future__ import annotations

import json
import os
from typing import Any, Dict, Iterable

from src.backend.cache import ResortCoordinateCache


def _extract_coordinate_seed(item: Dict[str, Any]) -> Dict[str, Any] | None:
    query = item.get("query")
    if not isinstance(query, str) or not query.strip():
        return None

    lat = item.get("input_latitude")
    lon = item.get("input_longitude")
    if lat is None or lon is None:
        lat = item.get("latitude")
        lon = item.get("longitude")
    if lat is None or lon is None:
        return None
    try:
        lat_v = float(lat)
        lon_v = float(lon)
    except (TypeError, ValueError):
        return None

    return {
        "query": query,
        "name": str(item.get("matched_name") or item.get("name") or item.get("display_name") or query),
        "latitude": lat_v,
        "longitude": lon_v,
        "country": item.get("country"),
        "admin1": item.get("admin1") or item.get("state"),
    }


def seed_coordinate_cache_from_entries(cache: ResortCoordinateCache, entries: Iterable[Dict[str, Any]]) -> None:
    for item in entries:
        if not isinstance(item, dict):
            continue
        seed = _extract_coordinate_seed(item)
        if seed is None:
            continue
        cache.set(
            seed["query"],
            {
                "name": seed["name"],
                "latitude": seed["latitude"],
                "longitude": seed["longitude"],
                "country": seed["country"],
                "admin1": seed["admin1"],
            },
        )


def seed_coordinate_cache_from_unified(cache: ResortCoordinateCache, path: str) -> None:
    if not path or not os.path.exists(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)
    except Exception:
        return

    reports = payload.get("reports")
    if not isinstance(reports, list):
        return

    seed_coordinate_cache_from_entries(cache, reports)


def seed_coordinate_cache_from_catalog(cache: ResortCoordinateCache, path: str) -> None:
    if not path or not os.path.exists(path):
        return
    try:
        from src.backend.resort_catalog import load_resort_catalog

        entries = load_resort_catalog(path)
    except Exception:
        return

    seed_coordinate_cache_from_entries(cache, entries)
