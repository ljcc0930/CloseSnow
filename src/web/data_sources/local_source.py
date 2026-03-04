from __future__ import annotations

from typing import Any, Dict, List

from src.shared.config import DEFAULT_RESORTS_FILE


def load_local_payload(
    resorts: List[str],
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
    max_workers: int,
) -> Dict[str, Any]:
    # Lazy import keeps frontend startup independent in api/file mode.
    from src.backend.pipelines.live_pipeline import run_live_payload

    selected = [x.strip() for x in resorts if x and x.strip()]
    resorts_file = "" if selected else DEFAULT_RESORTS_FILE
    return run_live_payload(
        resorts=selected,
        resorts_file=resorts_file,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
        max_workers=max_workers,
    )
