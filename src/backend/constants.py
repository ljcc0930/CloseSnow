from __future__ import annotations

from pathlib import Path

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
FORECAST_DAYS = 15
DAYS_PER_WEEK = 7
HISTORY_DAYS = 14
API_RETRY_TIMES = 4

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RESORTS_FILE = str(REPO_ROOT / "resorts.txt")
COORDINATES_CACHE_FILE = str(REPO_ROOT / ".cache" / "resort_coordinates.json")

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
