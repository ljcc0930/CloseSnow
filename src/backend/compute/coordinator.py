from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional, TypedDict

from src.backend.cache import JsonCache, ResortCoordinateCache
from src.backend.constants import API_RETRY_TIMES
from src.backend.open_meteo import fetch_forecast_async, fetch_history_async, geocode_async
from src.backend.report_builder import build_report
from src.contract import FailedItem, WeatherReport

logger = logging.getLogger(__name__)


class ResortReportResult(TypedDict):
    index: int
    report: Optional[WeatherReport]
    failed: Optional[FailedItem]


class PipelineResult(TypedDict):
    reports: List[WeatherReport]
    failed: List[FailedItem]


async def build_resort_report(
    idx: int,
    total: int,
    resort: str,
    cache: JsonCache,
    coord_cache: ResortCoordinateCache,
    geocode_ttl: int,
    forecast_ttl: int,
    api_retries: int,
    semaphore: asyncio.Semaphore,
) -> ResortReportResult:
    async with semaphore:
        logger.info("Resort %d/%d: start %s", idx, total, resort)
        try:
            loc = await geocode_async(
                resort,
                cache=cache,
                ttl_seconds=geocode_ttl,
                coord_cache=coord_cache,
                api_retries=api_retries,
            )
            if not loc:
                logger.info("Resort %d/%d: geocode failed %s", idx, total, resort)
                return {"index": idx - 1, "report": None, "failed": {"query": resort, "reason": "No geocoding match"}}

            forecast_task = asyncio.create_task(
                fetch_forecast_async(loc, cache=cache, ttl_seconds=forecast_ttl, api_retries=api_retries)
            )
            history_task = asyncio.create_task(
                fetch_history_async(loc, cache=cache, ttl_seconds=forecast_ttl, api_retries=api_retries)
            )
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


async def run_pipeline_async(
    selected: List[str],
    cache: JsonCache,
    coord_cache: ResortCoordinateCache,
    geocode_ttl: int,
    forecast_ttl: int,
    max_workers: int,
    api_retries: int = API_RETRY_TIMES,
) -> PipelineResult:
    semaphore = asyncio.Semaphore(max(1, max_workers))
    tasks = [
        asyncio.create_task(
            build_resort_report(
                idx=idx,
                total=len(selected),
                resort=resort,
                cache=cache,
                coord_cache=coord_cache,
                geocode_ttl=geocode_ttl,
                forecast_ttl=forecast_ttl,
                api_retries=api_retries,
                semaphore=semaphore,
            )
        )
        for idx, resort in enumerate(selected, start=1)
    ]
    results = await asyncio.gather(*tasks)

    reports_ordered: List[Optional[WeatherReport]] = [None] * len(selected)
    failed: List[FailedItem] = []
    for result in results:
        reports_ordered[result["index"]] = result["report"]
        if result["failed"] is not None:
            failed.append(result["failed"])
    reports = [r for r in reports_ordered if r is not None]
    return {"reports": reports, "failed": failed}
