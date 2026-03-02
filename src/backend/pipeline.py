from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

from src.backend.cache import JsonCache, ResortCoordinateCache, dated_cache_path
from src.backend.constants import COORDINATES_CACHE_FILE, DEFAULT_RESORTS, DEFAULT_RESORTS_FILE, FORECAST_DAYS
from src.backend.open_meteo import fetch_forecast, geocode
from src.backend.report_builder import build_report
from src.backend.writers import write_rain_csv, write_snow_csv, write_temp_csv, write_unified_json

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
) -> Dict[str, Any]:
    selected: List[str] = [r.strip() for r in (resorts or []) if r and r.strip()]
    if resorts_file:
        selected.extend(read_resorts(resorts_file))
    if use_default_resorts:
        selected.extend(DEFAULT_RESORTS)
    if not selected:
        selected = list(DEFAULT_RESORTS)

    seen = set()
    selected = [r for r in selected if not (r in seen or seen.add(r))]
    logger.info("Pipeline start: resorts=%d", len(selected))

    cache_path = dated_cache_path(cache_file)
    cache = JsonCache(cache_path)
    coord_cache = ResortCoordinateCache(COORDINATES_CACHE_FILE)
    seed_coordinate_cache_from_unified(coord_cache, ".cache/resorts_weather_unified.json")
    if output_json != ".cache/resorts_weather_unified.json":
        seed_coordinate_cache_from_unified(coord_cache, output_json)
    geocode_ttl = geocode_cache_hours * 3600
    forecast_ttl = forecast_cache_hours * 3600

    reports: List[Dict[str, Any]] = []
    failed: List[Dict[str, str]] = []
    for idx, resort in enumerate(selected, start=1):
        logger.info("Resort %d/%d: start %s", idx, len(selected), resort)
        try:
            loc = geocode(resort, cache=cache, ttl_seconds=geocode_ttl, coord_cache=coord_cache)
            if not loc:
                logger.info("Resort %d/%d: geocode failed %s", idx, len(selected), resort)
                failed.append({"query": resort, "reason": "No geocoding match"})
                continue
            forecast = fetch_forecast(loc, cache=cache, ttl_seconds=forecast_ttl)
            reports.append(build_report(loc, forecast))
            logger.info(
                "Resort %d/%d: success %s (lat=%.4f, lon=%.4f)",
                idx,
                len(selected),
                resort,
                loc.latitude,
                loc.longitude,
            )
        except Exception as exc:  # noqa: BLE001
            logger.info("Resort %d/%d: failed %s (%s)", idx, len(selected), resort, exc)
            failed.append({"query": resort, "reason": str(exc)})

    out = {
        "source": "Open-Meteo",
        "model": "ecmwf_ifs025",
        "forecast_days": FORECAST_DAYS,
        "units": {
            "snowfall_cm": "cm",
            "rain_mm": "mm",
            "precipitation_mm": "mm",
            "temperature_max_c": "celsius",
            "temperature_min_c": "celsius",
        },
        "cache": {
            "file": cache_path,
            "hits": cache.hits,
            "misses": cache.misses,
            "geocode_cache_hours": geocode_cache_hours,
            "forecast_cache_hours": forecast_cache_hours,
        },
        "resorts_count": len(reports),
        "failed_count": len(failed),
        "failed": failed,
        "reports": reports,
    }

    cache.save()
    coord_cache.save()
    if write_outputs:
        write_unified_json(output_json, out)
        write_snow_csv(snow_csv, reports)
        write_rain_csv(rain_csv, reports)
        write_temp_csv(temp_csv, reports)

    logger.info(
        "Pipeline done: success=%d failed=%d cache_hits=%d cache_misses=%d",
        len(reports),
        len(failed),
        cache.hits,
        cache.misses,
    )
    return out
