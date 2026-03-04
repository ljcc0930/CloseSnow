from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional

from src.backend.cache import JsonCache, ResortCoordinateCache, dated_cache_path
from src.backend.compute import build_payload_metadata, select_resorts
from src.backend.constants import COORDINATES_CACHE_FILE, DEFAULT_RESORTS, DEFAULT_RESORTS_FILE
from src.backend.export.payload_exporter import export_payload_artifacts
from src.backend.open_meteo import fetch_forecast_async, fetch_history_async, geocode_async
from src.backend.report_builder import build_report
from src.contract import SCHEMA_VERSION, validate_weather_payload_v1

logger = logging.getLogger(__name__)


def read_resorts(path: str) -> List[str]:
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip() and not line.lstrip().startswith("#")]


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

    for item in reports:
        if not isinstance(item, dict):
            continue
        query = item.get("query")
        if not isinstance(query, str) or not query.strip():
            continue
        lat = item.get("input_latitude")
        lon = item.get("input_longitude")
        if lat is None or lon is None:
            lat = item.get("latitude")
            lon = item.get("longitude")
        if lat is None or lon is None:
            continue
        try:
            lat_v = float(lat)
            lon_v = float(lon)
        except (TypeError, ValueError):
            continue

        cache.set(
            query,
            {
                "name": str(item.get("matched_name") or item.get("name") or query),
                "latitude": lat_v,
                "longitude": lon_v,
                "country": item.get("country"),
                "admin1": item.get("admin1"),
            },
        )


async def _build_resort_report(
    idx: int,
    total: int,
    resort: str,
    cache: JsonCache,
    coord_cache: ResortCoordinateCache,
    geocode_ttl: int,
    forecast_ttl: int,
    semaphore: asyncio.Semaphore,
) -> Dict[str, Any]:
    async with semaphore:
        logger.info("Resort %d/%d: start %s", idx, total, resort)
        try:
            loc = await geocode_async(resort, cache=cache, ttl_seconds=geocode_ttl, coord_cache=coord_cache)
            if not loc:
                logger.info("Resort %d/%d: geocode failed %s", idx, total, resort)
                return {"index": idx - 1, "report": None, "failed": {"query": resort, "reason": "No geocoding match"}}

            forecast_task = asyncio.create_task(fetch_forecast_async(loc, cache=cache, ttl_seconds=forecast_ttl))
            history_task = asyncio.create_task(fetch_history_async(loc, cache=cache, ttl_seconds=forecast_ttl))
            forecast_result, history_result = await asyncio.gather(
                forecast_task,
                history_task,
                return_exceptions=True,
            )
            if isinstance(forecast_result, Exception):
                raise forecast_result
            forecast = forecast_result
            history: Optional[Dict[str, Any]] = None
            if isinstance(history_result, Exception):
                exc = history_result
                logger.info("Resort %d/%d: history fetch failed %s (%s)", idx, total, resort, exc)
            else:
                history = history_result

            report = build_report(loc, forecast, history=history)
            logger.info(
                "Resort %d/%d: success %s (lat=%.4f, lon=%.4f)",
                idx,
                total,
                resort,
                loc.latitude,
                loc.longitude,
            )
            return {"index": idx - 1, "report": report, "failed": None}
        except Exception as exc:  # noqa: BLE001
            logger.info("Resort %d/%d: failed %s (%s)", idx, total, resort, exc)
            return {"index": idx - 1, "report": None, "failed": {"query": resort, "reason": str(exc)}}


async def _run_pipeline_async(
    selected: List[str],
    cache: JsonCache,
    coord_cache: ResortCoordinateCache,
    geocode_ttl: int,
    forecast_ttl: int,
    max_workers: int,
) -> Dict[str, Any]:
    semaphore = asyncio.Semaphore(max(1, max_workers))
    tasks = [
        asyncio.create_task(
            _build_resort_report(
                idx=idx,
                total=len(selected),
                resort=resort,
                cache=cache,
                coord_cache=coord_cache,
                geocode_ttl=geocode_ttl,
                forecast_ttl=forecast_ttl,
                semaphore=semaphore,
            )
        )
        for idx, resort in enumerate(selected, start=1)
    ]
    results = await asyncio.gather(*tasks)

    reports_ordered: List[Optional[Dict[str, Any]]] = [None] * len(selected)
    failed: List[Dict[str, str]] = []
    for result in results:
        reports_ordered[result["index"]] = result["report"]
        if result["failed"] is not None:
            failed.append(result["failed"])
    reports = [r for r in reports_ordered if r is not None]
    return {"reports": reports, "failed": failed}


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
