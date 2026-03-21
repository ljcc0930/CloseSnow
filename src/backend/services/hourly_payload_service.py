from __future__ import annotations

from typing import Dict

from src.backend.airport_catalog import find_nearby_airports, load_airport_catalog
from src.backend.cache import JsonCache, ResortCoordinateCache, dated_cache_path
from src.backend.constants import COORDINATES_CACHE_FILE
from src.backend.io import seed_coordinate_cache_from_entries
from src.backend.open_meteo import fetch_hourly_forecast, geocode
from src.backend.services.resort_selection_service import load_supported_resort_catalog


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
    query = str(item.get("query", "")).strip()
    seed_coordinate_cache_from_entries(coord_cache, [item])
    location = geocode(
        query,
        cache=cache,
        ttl_seconds=geocode_cache_hours * 3600,
        coord_cache=coord_cache,
    )
    if location is None:
        return {
            "error": f"Unable to geocode resort '{query}'",
            "resort_id": resort_id,
            "query": query,
        }

    forecast = fetch_hourly_forecast(
        location,
        cache=cache,
        ttl_seconds=forecast_cache_hours * 3600,
        hours=hours,
    )
    cache.save()
    coord_cache.save()
    try:
        airports = load_airport_catalog()
    except Exception:
        airports = []
    nearby_airports = find_nearby_airports(
        resort_latitude=location.latitude,
        resort_longitude=location.longitude,
        airports=airports,
        radius_miles=250.0,
    )

    hourly = forecast.get("hourly", {}) if isinstance(forecast, dict) else {}
    times = list(hourly.get("time", []))
    n = min(hours, len(times))
    metric_keys = [
        "snowfall",
        "rain",
        "precipitation_probability",
        "snow_depth",
        "wind_speed_10m",
        "wind_direction_10m",
        "visibility",
    ]
    trimmed_hourly: Dict[str, object] = {"time": times[:n]}
    for key in metric_keys:
        values = hourly.get(key, [])
        if isinstance(values, list):
            trimmed_hourly[key] = values[:n]
        else:
            trimmed_hourly[key] = []

    return {
        "resort_id": resort_id,
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
