from __future__ import annotations

from pathlib import Path

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
FORECAST_DAYS = 14
DAYS_PER_WEEK = 7

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RESORTS_FILE = str(REPO_ROOT / "resorts.txt")

DEFAULT_RESORTS = [
    "steamboat, co",
    "winter park, co",
    "arapahoe basin, co",
    "copper mountain, co",
    "aspen snowmass, co",
    "snowbasin, ut",
    "snowbird, ut",
    "solitude, ut",
    "brighton, ut",
    "jackson hole, wy",
    "big sky, mt",
    "palisades tahoe, ca",
    "mammoth mountain, ca",
]
