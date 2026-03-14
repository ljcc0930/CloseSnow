from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import sys
from typing import Any, Dict

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.contract import SCHEMA_VERSION


def _build_sample_report() -> Dict[str, Any]:
    return {
        "query": "Snowbird, UT",
        "display_name": "Snowbird, Utah",
        "matched_name": "Snowbird",
        "country": "United States",
        "admin1": "Utah",
        "input_latitude": 40.58,
        "input_longitude": -111.65,
        "model": "ecmwf_ifs025",
        "forecast_timezone": "America/Denver",
        "resolved_latitude": 40.58,
        "resolved_longitude": -111.65,
        "week1_total_snowfall_cm": 25.0,
        "week2_total_snowfall_cm": 10.0,
        "week1_total_rain_mm": 2.0,
        "week2_total_rain_mm": 1.0,
        "past_14d_daily": [],
        "daily": [
            {
                "date": "2026-03-03",
                "snowfall_cm": 4.0,
                "rain_mm": 0.0,
                "precipitation_mm": 4.0,
                "temperature_max_c": -1.0,
                "temperature_min_c": -8.0,
                "above_0": 0,
            },
            {
                "date": "2026-03-04",
                "snowfall_cm": 6.0,
                "rain_mm": 1.5,
                "precipitation_mm": 7.5,
                "temperature_max_c": 2.0,
                "temperature_min_c": -3.0,
                "above_0": 1,
            },
        ],
    }


@pytest.fixture()
def valid_payload() -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "generated_at_utc": "2026-03-03T23:00:00Z",
        "source": "Open-Meteo",
        "model": "ecmwf_ifs025",
        "forecast_days": 15,
        "units": {
            "snowfall_cm": "cm",
            "rain_mm": "mm",
            "precipitation_mm": "mm",
            "temperature_max_c": "celsius",
            "temperature_min_c": "celsius",
        },
        "cache": {
            "file": ".cache/open_meteo_cache_2026-03-03.json",
            "hits": 5,
            "misses": 1,
            "geocode_cache_hours": 720,
            "forecast_cache_hours": 3,
        },
        "resorts_count": 1,
        "failed_count": 0,
        "failed": [],
        "reports": [_build_sample_report()],
    }
    return deepcopy(payload)
