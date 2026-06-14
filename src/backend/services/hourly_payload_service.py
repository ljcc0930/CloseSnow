from __future__ import annotations

import asyncio
from typing import Any, Dict, Iterable, List, Mapping

from src.backend.airport_catalog import find_nearby_airports, load_airport_catalog
from src.backend.cache import JsonCache, ResortCoordinateCache, dated_cache_path
from src.backend.constants import (
    API_RETRY_TIMES,
    COORDINATES_CACHE_FILE,
    CURATED_COORDINATES_CACHE_FILE,
    DEFAULT_MAX_WORKERS,
    DEFAULT_NEARBY_AIRPORT_RADIUS_MILES,
    ECMWF_MODEL,
)
from src.backend.io import seed_coordinate_cache_from_coordinate_cache_file, seed_coordinate_cache_from_entries
from src.backend.models import ResortLocation
from src.backend.open_meteo import fetch_hourly_forecast, fetch_hourly_forecast_async, geocode, geocode_async
from src.backend.services.resort_selection_service import load_supported_resort_catalog
from src.contract.hourly_payload import HourlyPayload, trim_hourly_payload


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
    except (OSError, UnicodeDecodeError, ValueError):
        return []


def _build_hourly_payload_from_forecast(
    *,
    item: Dict[str, object],
    location: ResortLocation,
    forecast: Mapping[str, Any],
    airports: List[Dict[str, Any]],
    hours: int,
) -> HourlyPayload:
    query = str(item.get("query", "")).strip()
    nearby_airports = find_nearby_airports(
        resort_latitude=location.latitude,
        resort_longitude=location.longitude,
        airports=airports,
        radius_miles=DEFAULT_NEARBY_AIRPORT_RADIUS_MILES,
    )
    n, trimmed_hourly = trim_hourly_payload(forecast, hours)
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
        "model": ECMWF_MODEL,
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
    api_retries: int,
) -> HourlyPayload:
    query = str(item.get("query", "")).strip()
    location = geocode(
        query,
        cache=cache,
        ttl_seconds=geocode_cache_hours * 3600,
        coord_cache=coord_cache,
        api_retries=api_retries,
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
        api_retries=api_retries,
    )
    return _build_hourly_payload_from_forecast(
        item=item,
        location=location,
        forecast=forecast,
        airports=airports,
        hours=hours,
    )


async def _build_hourly_payload_for_item_async(
    *,
    item: Dict[str, object],
    cache: JsonCache,
    coord_cache: ResortCoordinateCache,
    airports: List[Dict[str, Any]],
    hours: int,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
    api_retries: int,
) -> HourlyPayload:
    query = str(item.get("query", "")).strip()
    location = await geocode_async(
        query,
        cache=cache,
        ttl_seconds=geocode_cache_hours * 3600,
        coord_cache=coord_cache,
        api_retries=api_retries,
    )
    if location is None:
        return {
            "error": f"Unable to geocode resort '{query}'",
            "resort_id": str(item.get("resort_id", "")).strip(),
            "query": query,
        }

    forecast = await fetch_hourly_forecast_async(
        location,
        cache=cache,
        ttl_seconds=forecast_cache_hours * 3600,
        hours=hours,
        api_retries=api_retries,
    )
    return _build_hourly_payload_from_forecast(
        item=item,
        location=location,
        forecast=forecast,
        airports=airports,
        hours=hours,
    )


async def build_hourly_payloads_for_resorts_async(
    *,
    resort_ids: Iterable[str],
    hours: int,
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
    max_workers: int = DEFAULT_MAX_WORKERS,
    api_retries: int = API_RETRY_TIMES,
) -> Dict[str, HourlyPayload | None]:
    normalized_ids = [resort_id.strip() for resort_id in resort_ids if resort_id and resort_id.strip()]
    if not normalized_ids:
        return {}
    catalog_by_id = _catalog_by_resort_id(load_supported_resort_catalog())
    items = [catalog_by_id[resort_id] for resort_id in normalized_ids if resort_id in catalog_by_id]
    out: Dict[str, HourlyPayload | None] = {resort_id: None for resort_id in normalized_ids}
    if not items:
        return out

    cache_path = dated_cache_path(cache_file)
    cache = JsonCache(cache_path)
    coord_cache = ResortCoordinateCache(COORDINATES_CACHE_FILE)
    seed_coordinate_cache_from_coordinate_cache_file(coord_cache, CURATED_COORDINATES_CACHE_FILE)
    seed_coordinate_cache_from_entries(coord_cache, items)
    airports = _load_airports_safely()

    try:
        worker_count = min(max(1, int(max_workers)), len(items))
        semaphore = asyncio.Semaphore(worker_count)

        async def run_one(resort_id: str, item: Dict[str, object]) -> tuple[str, HourlyPayload]:
            async with semaphore:
                try:
                    payload = await _build_hourly_payload_for_item_async(
                        item=item,
                        cache=cache,
                        coord_cache=coord_cache,
                        airports=airports,
                        hours=hours,
                        geocode_cache_hours=geocode_cache_hours,
                        forecast_cache_hours=forecast_cache_hours,
                        api_retries=api_retries,
                    )
                    return resort_id, payload
                except Exception as exc:  # noqa: BLE001
                    query = str(item.get("query", "")).strip()
                    return resort_id, {
                        "error": f"Unable to build hourly payload for resort '{query}': {exc}",
                        "resort_id": resort_id,
                        "query": query,
                    }

        tasks = [
            asyncio.create_task(run_one(resort_id, item))
            for resort_id in normalized_ids
            if (item := catalog_by_id.get(resort_id)) is not None
        ]
        for resort_id, payload in await asyncio.gather(*tasks):
            out[resort_id] = payload
    finally:
        cache.save()
        coord_cache.save()
    return out


def build_hourly_payloads_for_resorts(
    *,
    resort_ids: Iterable[str],
    hours: int,
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
    max_workers: int = DEFAULT_MAX_WORKERS,
    api_retries: int = API_RETRY_TIMES,
) -> Dict[str, HourlyPayload | None]:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(
            build_hourly_payloads_for_resorts_async(
                resort_ids=resort_ids,
                hours=hours,
                cache_file=cache_file,
                geocode_cache_hours=geocode_cache_hours,
                forecast_cache_hours=forecast_cache_hours,
                max_workers=max_workers,
                api_retries=api_retries,
            )
        )
    raise RuntimeError("build_hourly_payloads_for_resorts_async must be used from an active event loop")


def build_hourly_payload_for_resort(
    *,
    resort_id: str,
    hours: int,
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
    api_retries: int = API_RETRY_TIMES,
) -> HourlyPayload | None:
    catalog = load_supported_resort_catalog()
    item = next((r for r in catalog if str(r.get("resort_id", "")) == resort_id), None)
    if item is None:
        return None

    cache_path = dated_cache_path(cache_file)
    cache = JsonCache(cache_path)
    coord_cache = ResortCoordinateCache(COORDINATES_CACHE_FILE)
    seed_coordinate_cache_from_coordinate_cache_file(coord_cache, CURATED_COORDINATES_CACHE_FILE)
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
            api_retries=api_retries,
        )
    finally:
        cache.save()
        coord_cache.save()
