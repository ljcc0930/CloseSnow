from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from src.backend.cache import JsonCache, ResortCoordinateCache, dated_cache_path
from src.backend.compute import build_payload_metadata, run_pipeline_async as _run_pipeline_async, select_resorts
from src.backend.constants import COORDINATES_CACHE_FILE, DEFAULT_RESORTS, DEFAULT_RESORTS_FILE
from src.backend.export.payload_exporter import export_payload_artifacts
from src.backend.io import seed_coordinate_cache_from_unified
from src.backend.resort_catalog import read_resort_queries
from src.contract import SCHEMA_VERSION, validate_weather_payload_v1

logger = logging.getLogger(__name__)


def read_resorts(path: str) -> List[str]:
    return read_resort_queries(path)


def compute_pipeline_payload(
    resorts: Optional[List[str]] = None,
    resorts_file: str = DEFAULT_RESORTS_FILE,
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
        read_resorts_fn=read_resorts,
    )
    logger.info("Pipeline start: resorts=%d", len(selected))

    cache_path = dated_cache_path(cache_file)
    cache = JsonCache(cache_path)
    coord_cache = ResortCoordinateCache(COORDINATES_CACHE_FILE)
    seed_coordinate_cache_from_unified(coord_cache, ".cache/resorts_weather_unified.json")
    if output_json != ".cache/resorts_weather_unified.json":
        seed_coordinate_cache_from_unified(coord_cache, output_json)
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
