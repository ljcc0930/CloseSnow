from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RESORTS_FILE = str(REPO_ROOT / "resorts.txt")
DEFAULT_DATA_API_URL = "http://127.0.0.1:8020/api/data"
DATA_API_URL_ENV = "CLOSESNOW_DATA_URL"
