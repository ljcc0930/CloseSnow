from __future__ import annotations

import json
from datetime import date

from src.backend.cache import JsonCache, ResortCoordinateCache, canonical_query, dated_cache_path


def test_dated_cache_path_with_extension():
    assert dated_cache_path(".cache/open_meteo_cache.json", date(2026, 3, 3)) == ".cache/open_meteo_cache_2026-03-03.json"


def test_dated_cache_path_without_extension():
    assert dated_cache_path(".cache/open_meteo_cache", date(2026, 3, 3)) == ".cache/open_meteo_cache_2026-03-03"


def test_canonical_query_sorts_keys_and_supports_lists():
    q = canonical_query({"b": 2, "a": [1, 3], "c": "x"})
    assert q == "a=1&a=3&b=2&c=x"


def test_json_cache_set_get_hit_and_miss(tmp_path, monkeypatch):
    cache_file = tmp_path / "cache.json"
    cache = JsonCache(str(cache_file))

    now = [1000.0]
    monkeypatch.setattr("src.backend.cache.time.time", lambda: now[0])

    cache.set("k1", {"v": 1})
    assert cache.get("k1", max_age_seconds=10) == {"v": 1}
    assert cache.hits == 1
    assert cache.misses == 0

    now[0] = 1020.0
    assert cache.get("k1", max_age_seconds=5) is None
    assert cache.misses == 1

    assert cache.get("missing", max_age_seconds=5) is None
    assert cache.misses == 2


def test_json_cache_load_invalid_file_falls_back(tmp_path):
    cache_file = tmp_path / "broken.json"
    cache_file.write_text("{not-json", encoding="utf-8")
    cache = JsonCache(str(cache_file))
    assert cache.data["version"] == 1
    assert cache.data["entries"] == {}


def test_json_cache_save_round_trip(tmp_path):
    cache_file = tmp_path / "cache.json"
    cache = JsonCache(str(cache_file))
    cache.set("k1", {"a": 1})
    cache.save()
    parsed = json.loads(cache_file.read_text(encoding="utf-8"))
    assert "entries" in parsed
    assert "k1" in parsed["entries"]


def test_resort_coordinate_cache_normalizes_query_and_saves_when_dirty(tmp_path):
    path = tmp_path / "coords.json"
    cache = ResortCoordinateCache(str(path))
    cache.set(" Snowbird, UT ", {"latitude": 1.0, "longitude": 2.0})
    assert cache.get("snowbird, ut") == {"latitude": 1.0, "longitude": 2.0}
    cache.save()
    assert path.exists()
    parsed = json.loads(path.read_text(encoding="utf-8"))
    assert "snowbird, ut" in parsed["entries"]


def test_resort_coordinate_cache_save_formats_json_with_indent(tmp_path):
    path = tmp_path / "coords.json"
    cache = ResortCoordinateCache(str(path))
    cache.set("Snowbird, UT", {"latitude": 1.0, "longitude": 2.0})
    cache.save()

    text = path.read_text(encoding="utf-8")
    assert '\n  "version": 1,' in text
    assert '\n  "entries": {' in text
    assert text.endswith("\n")


def test_resort_coordinate_cache_save_skips_when_not_dirty(tmp_path):
    path = tmp_path / "coords.json"
    cache = ResortCoordinateCache(str(path))
    cache.save()
    assert not path.exists()


def test_resort_coordinate_cache_invalid_file_falls_back(tmp_path):
    path = tmp_path / "coords.json"
    path.write_text("{oops", encoding="utf-8")
    cache = ResortCoordinateCache(str(path))
    assert cache.get("a") is None
