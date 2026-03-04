from __future__ import annotations

import json

from src.backend.io.cache_seed import seed_coordinate_cache_from_unified


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
