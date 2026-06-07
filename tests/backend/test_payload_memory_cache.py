from __future__ import annotations

from src.backend.services import payload_memory_cache
from src.backend.services.payload_memory_cache import PayloadMemoryCache, frozen_query_params


def test_payload_memory_cache_returns_deep_copies():
    calls = {"n": 0}
    cache = PayloadMemoryCache(ttl_seconds=60)

    def load():
        calls["n"] += 1
        return {"reports": [{"query": "A"}]}

    first = cache.get_or_load(("k",), load)
    first["reports"][0]["query"] = "mutated"
    second = cache.get_or_load(("k",), load)

    assert calls["n"] == 1
    assert second == {"reports": [{"query": "A"}]}


def test_payload_memory_cache_can_be_disabled():
    calls = {"n": 0}
    cache = PayloadMemoryCache(ttl_seconds=0)

    def load():
        calls["n"] += 1
        return {"reports": []}

    cache.get_or_load(("k",), load)
    cache.get_or_load(("k",), load)

    assert calls["n"] == 2


def test_payload_memory_cache_ttl_starts_after_load(monkeypatch):
    calls = {"n": 0}
    times = iter([10.0, 20.0, 20.5])
    monkeypatch.setattr(payload_memory_cache.time, "monotonic", lambda: next(times))
    cache = PayloadMemoryCache(ttl_seconds=1)

    def load():
        calls["n"] += 1
        return {"reports": [{"query": "A"}]}

    cache.get_or_load(("k",), load)
    second = cache.get_or_load(("k",), load)

    assert calls["n"] == 1
    assert second == {"reports": [{"query": "A"}]}


def test_frozen_query_params_sorts_keys_and_preserves_values():
    assert frozen_query_params({"b": ["2"], "a": ["1", "3"]}) == (("a", ("1", "3")), ("b", ("2",)))
