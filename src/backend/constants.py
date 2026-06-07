from __future__ import annotations

from src.shared import config

REPO_ROOT = config.REPO_ROOT
DEFAULT_RESORTS_FILE = config.DEFAULT_RESORTS_FILE

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ECMWF_MODEL = "ecmwf_ifs025"
FORECAST_DAYS = 15
DAYS_PER_WEEK = 7
HISTORY_DAYS = 14
DEFAULT_GEOCODE_CACHE_HOURS = 24 * 30
DEFAULT_FORECAST_CACHE_HOURS = 3
DEFAULT_MAX_WORKERS = 8
DEFAULT_PAYLOAD_CACHE_TTL_SECONDS = 60
DEFAULT_HOURLY_HOURS = 72
DEFAULT_STATIC_HOURLY_HOURS = 120
MAX_HOURLY_HOURS = 240
MAX_HOURLY_FORECAST_DAYS = 16
DEFAULT_NEARBY_AIRPORT_RADIUS_MILES = 250.0
API_RETRY_TIMES = 2
API_RETRY_DELAY_SECONDS = 10.0

DEFAULT_OPEN_METEO_CACHE_FILE = ".cache/open_meteo_cache.json"
DEFAULT_UNIFIED_PAYLOAD_FILE = ".cache/resorts_weather_unified.json"
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
