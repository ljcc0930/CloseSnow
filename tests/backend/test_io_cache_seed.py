from __future__ import annotations

import json

from src.backend.io.cache_seed import (
    seed_coordinate_cache_from_catalog,
    seed_coordinate_cache_from_entries,
    seed_coordinate_cache_from_unified,
)


class _DummyCoordCache:
    def __init__(self):
        self.set_calls = []

    def set(self, key, value):  # noqa: ANN001
        self.set_calls.append((key, value))


def test_seed_coordinate_cache_from_unified_reads_valid_reports(tmp_path):
    cache = _DummyCoordCache()
    payload = {
        "reports": [
            {
                "query": "A",
                "matched_name": "AA",
                "input_latitude": 1.1,
                "input_longitude": 2.2,
            },
            {
                "query": "B",
                "name": "BB",
                "latitude": 3.3,
                "longitude": 4.4,
            },
            {"query": "", "input_latitude": 1, "input_longitude": 2},
            {"query": "C", "input_latitude": "bad", "input_longitude": 2},
        ]
    }
    f = tmp_path / "payload.json"
    f.write_text(json.dumps(payload), encoding="utf-8")

    seed_coordinate_cache_from_unified(cache, str(f))
    assert len(cache.set_calls) == 2
    assert cache.set_calls[0][0] == "A"
    assert cache.set_calls[0][1]["name"] == "AA"
    assert cache.set_calls[1][0] == "B"
    assert cache.set_calls[1][1]["name"] == "BB"


def test_seed_coordinate_cache_from_unified_handles_missing_or_invalid(tmp_path):
    cache = _DummyCoordCache()
    seed_coordinate_cache_from_unified(cache, str(tmp_path / "missing.json"))
    assert cache.set_calls == []

    broken = tmp_path / "broken.json"
    broken.write_text("{oops", encoding="utf-8")
    seed_coordinate_cache_from_unified(cache, str(broken))
    assert cache.set_calls == []


def test_seed_coordinate_cache_from_entries_uses_state_as_admin1():
    cache = _DummyCoordCache()
    seed_coordinate_cache_from_entries(
        cache,
        [
            {
                "query": "Crystal Mountain, WA",
                "name": "Crystal Mountain",
                "state": "WA",
                "country": "US",
                "latitude": 46.9355117,
                "longitude": -121.4750288,
            }
        ],
    )

    assert cache.set_calls == [
        (
            "Crystal Mountain, WA",
            {
                "name": "Crystal Mountain",
                "latitude": 46.9355117,
                "longitude": -121.4750288,
                "country": "US",
                "admin1": "WA",
            },
        )
    ]


def test_seed_coordinate_cache_from_catalog_reads_catalog_coordinates(tmp_path):
    cache = _DummyCoordCache()
    catalog = tmp_path / "resorts.yml"
    catalog.write_text(
        json.dumps(
            [
                {
                    "resort_id": "crystal-mountain-wa",
                    "query": "Crystal Mountain, WA",
                    "name": "Crystal Mountain",
                    "country": "US",
                    "region": "west",
                    "pass_types": ["ikon"],
                    "state": "WA",
                    "latitude": 46.9355117,
                    "longitude": -121.4750288,
                }
            ]
        ),
        encoding="utf-8",
    )

    seed_coordinate_cache_from_catalog(cache, str(catalog))
    assert len(cache.set_calls) == 1
    assert cache.set_calls[0][0] == "Crystal Mountain, WA"
    assert cache.set_calls[0][1]["latitude"] == 46.9355117
