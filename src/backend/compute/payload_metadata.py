from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from src.backend.constants import FORECAST_DAYS
from src.contract import SCHEMA_VERSION


def build_payload_metadata(
    cache_path: str,
    cache_hits: int,
    cache_misses: int,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
    reports: List[Dict[str, Any]],
    failed: List[Dict[str, str]],
) -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
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
            "hits": cache_hits,
            "misses": cache_misses,
            "geocode_cache_hours": geocode_cache_hours,
            "forecast_cache_hours": forecast_cache_hours,
        },
        "resorts_count": len(reports),
        "failed_count": len(failed),
        "failed": failed,
        "reports": reports,
    }
