from __future__ import annotations

from src.backend.compute.payload_metadata import build_payload_metadata
from src.backend.compute.resort_selection import select_resorts
from src.contract import SCHEMA_VERSION


def test_select_resorts_with_file_and_defaults():
    selected = select_resorts(
        resorts=["A", " ", "A"],
        resorts_file="custom_resorts.txt",
        use_default_resorts=True,
        default_resorts=["D1", "D2"],
        read_resorts_fn=lambda path: ["B", "A"],
    )
    assert selected == ["A", "B", "D1", "D2"]


def test_select_resorts_fallback_to_defaults():
    selected = select_resorts(
        resorts=[],
        resorts_file="",
        use_default_resorts=False,
        default_resorts=["D1", "D2", "D1"],
        read_resorts_fn=lambda path: [],
    )
    assert selected == ["D1", "D2"]


def test_build_payload_metadata_shape():
    payload = build_payload_metadata(
        cache_path=".cache/test.json",
        cache_hits=2,
        cache_misses=3,
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        reports=[{"query": "A", "daily": []}],
        failed=[{"query": "B", "reason": "x"}],
    )
    assert payload["schema_version"] == SCHEMA_VERSION
    assert payload["forecast_days"] == 15
    assert payload["cache"]["hits"] == 2
    assert payload["resorts_count"] == 1
    assert payload["failed_count"] == 1
