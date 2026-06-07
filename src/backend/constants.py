from __future__ import annotations

from src.shared.config import DEFAULT_RESORTS_FILE as DEFAULT_RESORTS_FILE
from src.shared.config import REPO_ROOT

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
FORECAST_DAYS = 15
DAYS_PER_WEEK = 7
HISTORY_DAYS = 14
API_RETRY_TIMES = 2
API_RETRY_DELAY_SECONDS = 10.0

CURATED_COORDINATES_CACHE_FILE = str(REPO_ROOT / ".cache" / "resort_coordinates.json")
COORDINATES_CACHE_FILE = str(REPO_ROOT / ".cache" / "runtime_resort_coordinates.json")

DEFAULT_RESORTS = [
    "Steamboat, CO",
    "Winter Park, CO",
    "Arapahoe Basin, CO",
    "Copper Mountain, CO",
    "Aspen Snowmass, CO",
    "Snowbasin, UT",
    "Snowbird, UT",
    "Solitude, UT",
    "Brighton, UT",
    "Jackson Hole, WY",
    "Big Sky, MT",
    "Palisades Tahoe, CA",
    "Mammoth Mountain, CA",
]
