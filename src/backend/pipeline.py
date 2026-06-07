from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from src.backend.airport_catalog import find_nearby_airports
from src.backend.airport_catalog import load_airport_catalog as load_airport_catalog_airports
from src.backend.cache import JsonCache, ResortCoordinateCache, dated_cache_path
from src.backend.compute import build_payload_metadata, select_resorts
from src.backend.compute import run_pipeline_async as _run_pipeline_async
from src.backend.constants import (
    API_RETRY_TIMES,
    COORDINATES_CACHE_FILE,
    CURATED_COORDINATES_CACHE_FILE,
    DEFAULT_FORECAST_CACHE_HOURS,
    DEFAULT_GEOCODE_CACHE_HOURS,
    DEFAULT_MAX_WORKERS,
    DEFAULT_NEARBY_AIRPORT_RADIUS_MILES,
    DEFAULT_OPEN_METEO_CACHE_FILE,
    DEFAULT_RESORTS,
    DEFAULT_RESORTS_FILE,
    DEFAULT_UNIFIED_PAYLOAD_FILE,
)
from src.backend.export.payload_exporter import export_payload_artifacts
from src.backend.io import (
    seed_coordinate_cache_from_catalog,
    seed_coordinate_cache_from_coordinate_cache_file,
    seed_coordinate_cache_from_unified,
)
from src.backend.resort_catalog import load_resort_catalog, read_resort_queries
from src.contract import SCHEMA_VERSION, validate_weather_payload_v1

logger = logging.getLogger(__name__)

__all__ = [
    "SCHEMA_VERSION",
    "compute_pipeline_payload",
    "read_resorts",
    "run_pipeline",
]


def read_resorts(path: str, *, include_all: bool = False) -> List[str]:
    return read_resort_queries(path, include_all=include_all)


def _catalog_metadata_by_query(paths: List[str]) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for path in paths:
        if not path:
            continue
        try:
            entries = load_resort_catalog(path)
        except Exception:
            continue
        for item in entries:
            query = str(item.get("query", "")).strip()
            if query and query not in out:
                out[query] = item
    return out


def _enrich_reports_with_catalog_metadata(
    reports: List[Dict[str, Any]], metadata_by_query: Dict[str, Dict[str, Any]]
) -> None:
    for report in reports:
        query = str(report.get("query", "")).strip()
        if not query:
            continue
        meta = metadata_by_query.get(query)
        if not meta:
            continue
        report["resort_id"] = str(meta.get("resort_id", "")).strip()
        report["pass_types"] = list(meta.get("pass_types") or [])
        report["region"] = str(meta.get("region", "")).strip().lower()
        report["subregion"] = str(meta.get("subregion", "")).strip().lower()
        report["default_resort"] = bool(meta.get("default_enabled", False))
        report["ljcc_favorite"] = report["default_resort"]
        report["display_name"] = str(meta.get("display_name") or query).strip()
        report["website"] = str(meta.get("website") or "").strip()
        report["state_name"] = str(meta.get("state_name") or "").strip()
        report["country_name"] = str(meta.get("country_name") or "").strip()
        report["city"] = str(meta.get("city") or "").strip()
        report["address"] = str(meta.get("address") or "").strip()
        report["search_terms"] = list(meta.get("search_terms") or [])
        country_code = str(meta.get("country", "")).strip().upper()
        if country_code:
            report["country_code"] = country_code
        if not report.get("country"):
            report["country"] = country_code
        if not report.get("admin1"):
            report["admin1"] = str(meta.get("state", "")).strip()


def _to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _enrich_reports_with_nearby_airports(reports: List[Dict[str, Any]], airports: List[Dict[str, Any]]) -> None:
    for report in reports:
        lat = _to_float(report.get("input_latitude"))
        lon = _to_float(report.get("input_longitude"))
        if lat is None or lon is None:
            report["nearby_airports"] = []
            continue
        report["nearby_airports"] = find_nearby_airports(
            resort_latitude=lat,
            resort_longitude=lon,
            airports=airports,
            radius_miles=DEFAULT_NEARBY_AIRPORT_RADIUS_MILES,
        )


def compute_pipeline_payload(
    resorts: Optional[List[str]] = None,
    resorts_file: str = DEFAULT_RESORTS_FILE,
    include_all_resorts: bool = False,
    use_default_resorts: bool = False,
    output_json: str = DEFAULT_UNIFIED_PAYLOAD_FILE,
    cache_file: str = DEFAULT_OPEN_METEO_CACHE_FILE,
    geocode_cache_hours: int = DEFAULT_GEOCODE_CACHE_HOURS,
    forecast_cache_hours: int = DEFAULT_FORECAST_CACHE_HOURS,
    max_workers: int = DEFAULT_MAX_WORKERS,
    api_retries: int = API_RETRY_TIMES,
) -> Dict[str, Any]:
    selected = select_resorts(
        resorts=list(resorts or []),
        resorts_file=resorts_file,
        use_default_resorts=use_default_resorts,
        default_resorts=list(DEFAULT_RESORTS),
        read_resorts_fn=lambda path: read_resorts(path, include_all=include_all_resorts),
    )
    logger.info("Pipeline start: resorts=%d", len(selected))

    cache_path = dated_cache_path(cache_file)
    cache = JsonCache(cache_path)
    coord_cache = ResortCoordinateCache(COORDINATES_CACHE_FILE)
    seed_coordinate_cache_from_coordinate_cache_file(coord_cache, CURATED_COORDINATES_CACHE_FILE)
    seed_coordinate_cache_from_unified(coord_cache, DEFAULT_UNIFIED_PAYLOAD_FILE)
    if output_json != DEFAULT_UNIFIED_PAYLOAD_FILE:
        seed_coordinate_cache_from_unified(coord_cache, output_json)
    seed_coordinate_cache_from_catalog(coord_cache, DEFAULT_RESORTS_FILE)
    if resorts_file:
        seed_coordinate_cache_from_catalog(coord_cache, resorts_file)
    geocode_ttl = geocode_cache_hours * 3600
    forecast_ttl = forecast_cache_hours * 3600

    async_result = asyncio.run(
        _run_pipeline_async(
            selected=selected,
            cache=cache,
            coord_cache=coord_cache,
            geocode_ttl=geocode_ttl,
            forecast_ttl=forecast_ttl,
            max_workers=max_workers,
            api_retries=api_retries,
        )
    )
    reports: List[Dict[str, Any]] = async_result["reports"]
    failed: List[Dict[str, str]] = async_result["failed"]
    catalog_index = _catalog_metadata_by_query([resorts_file, DEFAULT_RESORTS_FILE])
    _enrich_reports_with_catalog_metadata(reports, catalog_index)
    try:
        airports = load_airport_catalog_airports()
    except Exception:
        airports = []
    _enrich_reports_with_nearby_airports(reports, airports)

    out = build_payload_metadata(
        cache_path=cache_path,
        cache_hits=cache.hits,
        cache_misses=cache.misses,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
        api_retries=api_retries,
        reports=reports,
        failed=failed,
    )
    validate_weather_payload_v1(out)

    cache.save()
    coord_cache.save()

    logger.info(
        "Pipeline done: success=%d failed=%d cache_hits=%d cache_misses=%d",
        len(reports),
        len(failed),
        cache.hits,
        cache.misses,
    )
    return out


def run_pipeline(
    resorts: Optional[List[str]] = None,
    resorts_file: str = DEFAULT_RESORTS_FILE,
    include_all_resorts: bool = False,
    use_default_resorts: bool = False,
    output_json: str = DEFAULT_UNIFIED_PAYLOAD_FILE,
    snow_csv: str = ".cache/resorts_snowfall_daily.csv",
    rain_csv: str = ".cache/resorts_rainfall_daily.csv",
    temp_csv: str = ".cache/resorts_temperature_daily.csv",
    cache_file: str = DEFAULT_OPEN_METEO_CACHE_FILE,
    geocode_cache_hours: int = DEFAULT_GEOCODE_CACHE_HOURS,
    forecast_cache_hours: int = DEFAULT_FORECAST_CACHE_HOURS,
    write_outputs: bool = True,
    max_workers: int = DEFAULT_MAX_WORKERS,
    api_retries: int = API_RETRY_TIMES,
) -> Dict[str, Any]:
    payload = compute_pipeline_payload(
        resorts=resorts,
        resorts_file=resorts_file,
        include_all_resorts=include_all_resorts,
        use_default_resorts=use_default_resorts,
        output_json=output_json,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
        max_workers=max_workers,
        api_retries=api_retries,
    )
    if write_outputs:
        export_payload_artifacts(
            payload=payload,
            output_json=output_json,
            snow_csv=snow_csv,
            rain_csv=rain_csv,
            temp_csv=temp_csv,
        )
    return payload
