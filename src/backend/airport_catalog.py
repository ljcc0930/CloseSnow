from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any, Dict, List, Sequence

from src.shared.config import DEFAULT_AIRPORTS_FILE

EARTH_RADIUS_MILES = 3958.7613


def _slugify(value: str) -> str:
    lowered = value.strip().lower()
    collapsed = re.sub(r"[^a-z0-9]+", "-", lowered)
    return collapsed.strip("-")


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(num):
        return None
    return num


def _normalize_airport_entry(raw: Dict[str, Any]) -> Dict[str, Any] | None:
    iata_code = str(raw.get("iata_code") or "").strip().upper()
    display_name = str(raw.get("display_name") or raw.get("name") or "").strip()
    if not iata_code or len(iata_code) != 3 or not display_name:
        return None
    latitude = _to_float(raw.get("latitude"))
    longitude = _to_float(raw.get("longitude"))
    if latitude is None or longitude is None:
        return None
    if latitude < -90 or latitude > 90 or longitude < -180 or longitude > 180:
        return None
    airport_id = str(raw.get("airport_id") or "").strip()
    if not airport_id:
        airport_id = _slugify(f"{iata_code}-{display_name}")
    location_label = str(raw.get("location_label") or "").strip()
    if not location_label:
        city = str(raw.get("city") or "").strip()
        state = str(raw.get("state") or "").strip()
        country = str(raw.get("country") or "").strip().upper()
        parts = [part for part in (city, state, country) if part]
        location_label = ", ".join(parts)
    return {
        "airport_id": airport_id,
        "iata_code": iata_code,
        "display_name": display_name,
        "location_label": location_label,
        "latitude": latitude,
        "longitude": longitude,
    }


def load_airport_catalog(path: str = DEFAULT_AIRPORTS_FILE) -> List[Dict[str, Any]]:
    p = Path(path)
    raw = json.loads(p.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError(f"Invalid airport catalog format in {path}: expected list")
    entries: List[Dict[str, Any]] = []
    seen_ids: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        entry = _normalize_airport_entry(item)
        if entry is None:
            continue
        airport_id = str(entry.get("airport_id") or "")
        if not airport_id or airport_id in seen_ids:
            continue
        seen_ids.add(airport_id)
        entries.append(entry)
    return entries


def great_circle_distance_miles(
    latitude_a: float,
    longitude_a: float,
    latitude_b: float,
    longitude_b: float,
) -> float:
    lat1 = math.radians(latitude_a)
    lon1 = math.radians(longitude_a)
    lat2 = math.radians(latitude_b)
    lon2 = math.radians(longitude_b)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    sin_lat = math.sin(dlat / 2.0)
    sin_lon = math.sin(dlon / 2.0)
    a = sin_lat * sin_lat + math.cos(lat1) * math.cos(lat2) * sin_lon * sin_lon
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return EARTH_RADIUS_MILES * c


def find_nearby_airports(
    *,
    resort_latitude: float,
    resort_longitude: float,
    airports: Sequence[Dict[str, Any]] | None = None,
    radius_miles: float = 250.0,
) -> List[Dict[str, Any]]:
    if airports is None:
        airports = load_airport_catalog()
    if radius_miles <= 0:
        return []
    selected: List[Dict[str, Any]] = []
    for airport in airports:
        lat = _to_float(airport.get("latitude"))
        lon = _to_float(airport.get("longitude"))
        if lat is None or lon is None:
            continue
        distance = great_circle_distance_miles(resort_latitude, resort_longitude, lat, lon)
        if distance > radius_miles:
            continue
        selected.append(
            {
                "airport_id": str(airport.get("airport_id") or "").strip(),
                "iata_code": str(airport.get("iata_code") or "").strip().upper(),
                "display_name": str(airport.get("display_name") or "").strip(),
                "location_label": str(airport.get("location_label") or "").strip(),
                "latitude": lat,
                "longitude": lon,
                "distance_miles": round(distance, 1),
            }
        )
    selected.sort(key=lambda item: (float(item["distance_miles"]), str(item["iata_code"])))
    return selected
