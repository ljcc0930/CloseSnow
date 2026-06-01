from __future__ import annotations

from typing import Any, Dict, Iterable, List, Mapping

from src.backend.airport_catalog import find_nearby_airports, load_airport_catalog
from src.backend.cache import JsonCache, ResortCoordinateCache, dated_cache_path
from src.backend.constants import COORDINATES_CACHE_FILE
from src.backend.io import seed_coordinate_cache_from_entries
from src.backend.models import ResortLocation
from src.backend.open_meteo import fetch_hourly_forecast, geocode
from src.backend.services.resort_selection_service import load_supported_resort_catalog

_HOURLY_METRIC_KEYS = [
    "snowfall",
    "rain",
    "precipitation_probability",
    "snow_depth",
    "wind_speed_10m",
    "wind_direction_10m",
    "visibility",
]


def _catalog_by_resort_id(catalog: Iterable[Dict[str, object]]) -> Dict[str, Dict[str, object]]:
    out: Dict[str, Dict[str, object]] = {}
    for item in catalog:
        resort_id = str(item.get("resort_id", "")).strip()
        if resort_id and resort_id not in out:
            out[resort_id] = item
    return out


def _load_airports_safely() -> List[Dict[str, Any]]:
    try:
        return load_airport_catalog()
    except Exception:
        return []


def _trim_hourly_forecast(forecast: Mapping[str, Any], hours: int) -> tuple[int, Dict[str, object]]:
    requested_hours = max(1, int(hours))
    hourly = forecast.get("hourly", {}) if isinstance(forecast, dict) else {}
    times = list(hourly.get("time", [])) if isinstance(hourly, dict) else []
    n = min(requested_hours, len(times))
    trimmed_hourly: Dict[str, object] = {"time": times[:n]}
    for key in _HOURLY_METRIC_KEYS:
        values = hourly.get(key, []) if isinstance(hourly, dict) else []
        trimmed_hourly[key] = values[:n] if isinstance(values, list) else []
    return n, trimmed_hourly


def _build_hourly_payload_from_forecast(
    *,
    item: Dict[str, object],
    location: ResortLocation,
    forecast: Mapping[str, Any],
    airports: List[Dict[str, Any]],
    hours: int,
) -> Dict[str, object]:
    query = str(item.get("query", "")).strip()
    nearby_airports = find_nearby_airports(
        resort_latitude=location.latitude,
        resort_longitude=location.longitude,
        airports=airports,
        radius_miles=250.0,
    )
    n, trimmed_hourly = _trim_hourly_forecast(forecast, hours)
    return {
        "resort_id": str(item.get("resort_id", "")).strip(),
        "query": query,
        "display_name": str(item.get("display_name") or query).strip(),
        "website": str(item.get("website") or "").strip(),
        "matched_name": location.name,
        "country": item.get("country"),
        "region": item.get("region"),
        "subregion": item.get("subregion"),
        "pass_types": item.get("pass_types", []),
        "timezone": forecast.get("timezone"),
        "model": "ecmwf_ifs025",
        "input_latitude": location.latitude,
        "input_longitude": location.longitude,
        "resolved_latitude": forecast.get("latitude"),
        "resolved_longitude": forecast.get("longitude"),
        "nearby_airports": nearby_airports,
        "hours": n,
        "hourly": trimmed_hourly,
    }


def _build_hourly_payload_for_item(
    *,
    item: Dict[str, object],
    cache: JsonCache,
    coord_cache: ResortCoordinateCache,
    airports: List[Dict[str, Any]],
    hours: int,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
) -> Dict[str, object]:
    query = str(item.get("query", "")).strip()
    location = geocode(
        query,
        cache=cache,
        ttl_seconds=geocode_cache_hours * 3600,
        coord_cache=coord_cache,
    )
    if location is None:
        return {
            "error": f"Unable to geocode resort '{query}'",
            "resort_id": str(item.get("resort_id", "")).strip(),
            "query": query,
        }

    forecast = fetch_hourly_forecast(
        location,
        cache=cache,
        ttl_seconds=forecast_cache_hours * 3600,
        hours=hours,
    )
    return _build_hourly_payload_from_forecast(
        item=item,
        location=location,
        forecast=forecast,
        airports=airports,
        hours=hours,
    )


def build_hourly_payloads_for_resorts(
    *,
    resort_ids: Iterable[str],
    hours: int,
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
) -> Dict[str, Dict[str, object] | None]:
    normalized_ids = [resort_id.strip() for resort_id in resort_ids if resort_id and resort_id.strip()]
    if not normalized_ids:
        return {}
    catalog_by_id = _catalog_by_resort_id(load_supported_resort_catalog())
    items = [catalog_by_id[resort_id] for resort_id in normalized_ids if resort_id in catalog_by_id]

    cache_path = dated_cache_path(cache_file)
    cache = JsonCache(cache_path)
    coord_cache = ResortCoordinateCache(COORDINATES_CACHE_FILE)
    seed_coordinate_cache_from_entries(coord_cache, items)
    airports = _load_airports_safely()

    out: Dict[str, Dict[str, object] | None] = {}
    try:
        for resort_id in normalized_ids:
            item = catalog_by_id.get(resort_id)
            if item is None:
                out[resort_id] = None
                continue
            out[resort_id] = _build_hourly_payload_for_item(
                item=item,
                cache=cache,
                coord_cache=coord_cache,
                airports=airports,
                hours=hours,
                geocode_cache_hours=geocode_cache_hours,
                forecast_cache_hours=forecast_cache_hours,
            )
    finally:
        cache.save()
        coord_cache.save()
    return out


def build_hourly_payload_for_resort(
    *,
    resort_id: str,
    hours: int,
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
) -> Dict[str, object] | None:
    catalog = load_supported_resort_catalog()
    item = next((r for r in catalog if str(r.get("resort_id", "")) == resort_id), None)
    if item is None:
        return None

    cache_path = dated_cache_path(cache_file)
    cache = JsonCache(cache_path)
    coord_cache = ResortCoordinateCache(COORDINATES_CACHE_FILE)
    seed_coordinate_cache_from_entries(coord_cache, [item])
    try:
        return _build_hourly_payload_for_item(
            item=item,
            cache=cache,
            coord_cache=coord_cache,
            airports=_load_airports_safely(),
            hours=hours,
            geocode_cache_hours=geocode_cache_hours,
            forecast_cache_hours=forecast_cache_hours,
        )
    finally:
        cache.save()
        coord_cache.save()
