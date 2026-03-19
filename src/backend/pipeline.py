from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from src.backend.airport_catalog import find_nearby_airports, load_airport_catalog as load_airport_catalog_airports
from src.backend.cache import JsonCache, ResortCoordinateCache, dated_cache_path
from src.backend.compute import build_payload_metadata, run_pipeline_async as _run_pipeline_async, select_resorts
from src.backend.constants import COORDINATES_CACHE_FILE, DEFAULT_RESORTS, DEFAULT_RESORTS_FILE
from src.backend.export.payload_exporter import export_payload_artifacts
from src.backend.io import seed_coordinate_cache_from_catalog, seed_coordinate_cache_from_unified
from src.backend.resort_catalog import load_resort_catalog, read_resort_queries
from src.contract import SCHEMA_VERSION, validate_weather_payload_v1

logger = logging.getLogger(__name__)


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


def _enrich_reports_with_catalog_metadata(reports: List[Dict[str, Any]], metadata_by_query: Dict[str, Dict[str, Any]]) -> None:
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
            radius_miles=250.0,
        )


def compute_pipeline_payload(
    resorts: Optional[List[str]] = None,
    resorts_file: str = DEFAULT_RESORTS_FILE,
    include_all_resorts: bool = False,
    use_default_resorts: bool = False,
    output_json: str = ".cache/resorts_weather_unified.json",
    cache_file: str = ".cache/open_meteo_cache.json",
    geocode_cache_hours: int = 24 * 30,
    forecast_cache_hours: int = 3,
    max_workers: int = 8,
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
    seed_coordinate_cache_from_unified(coord_cache, ".cache/resorts_weather_unified.json")
    if output_json != ".cache/resorts_weather_unified.json":
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
    output_json: str = ".cache/resorts_weather_unified.json",
    snow_csv: str = ".cache/resorts_snowfall_daily.csv",
    rain_csv: str = ".cache/resorts_rainfall_daily.csv",
    temp_csv: str = ".cache/resorts_temperature_daily.csv",
    cache_file: str = ".cache/open_meteo_cache.json",
    geocode_cache_hours: int = 24 * 30,
    forecast_cache_hours: int = 3,
    write_outputs: bool = True,
    max_workers: int = 8,
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
