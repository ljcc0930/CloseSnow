from __future__ import annotations

import json
import asyncio
import urllib.error

import pytest

from src.backend import open_meteo


class _DummyCache:
    def __init__(self, cached=None):
        self.cached = cached
        self.last_set = None

    def get(self, key, ttl):  # noqa: ANN001
        return self.cached

    def set(self, key, value):  # noqa: ANN001
        self.last_set = (key, value)


class _DummyResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):  # noqa: ANN001
        return None

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


class _DummyCoordCache:
    def __init__(self, initial=None):
        self.initial = initial
        self.saved = None

    def get(self, query):  # noqa: ANN001
        return self.initial

    def set(self, query, value):  # noqa: ANN001
        self.saved = (query, value)


def test_with_retry_recovers_from_transient(monkeypatch):
    calls = {"n": 0}
    monkeypatch.setattr("src.backend.open_meteo.time.sleep", lambda _: None)

    def flappy():
        calls["n"] += 1
        if calls["n"] < 3:
            raise urllib.error.URLError("temporary")
        return "ok"

    assert open_meteo.with_retry(flappy, retries=3, base_delay_seconds=0) == "ok"
    assert calls["n"] == 3


def test_with_retry_does_not_retry_non_transient_http_error():
    err = urllib.error.HTTPError("https://x", 404, "not found", hdrs=None, fp=None)
    calls = {"n": 0}

    def always_fail():
        calls["n"] += 1
        raise err

    with pytest.raises(urllib.error.HTTPError):
        open_meteo.with_retry(always_fail, retries=3, base_delay_seconds=0)
    assert calls["n"] == 1


def test_geocode_queries_include_state_variants():
    qs = open_meteo._geocode_queries("Snowbird, ut")
    assert "Snowbird, ut" in qs
    assert "Snowbird, utah" in qs
    assert "Snowbird utah" in qs


def test_fetch_json_returns_cache_hit_without_request(monkeypatch):
    cache = _DummyCache(cached={"ok": True})
    called = {"n": 0}

    def bad_urlopen(req, timeout):  # noqa: ANN001
        called["n"] += 1
        raise AssertionError("urlopen should not be called for cache hit")

    monkeypatch.setattr("src.backend.open_meteo.urllib.request.urlopen", bad_urlopen)
    out = open_meteo.fetch_json("https://example.test", {"a": 1}, cache=cache, namespace="n", ttl_seconds=100)
    assert out == {"ok": True}
    assert called["n"] == 0


def test_fetch_json_cache_miss_requests_and_sets_cache(monkeypatch):
    cache = _DummyCache(cached=None)

    def fake_urlopen(req, timeout):  # noqa: ANN001
        assert "User-Agent" in req.headers or "User-agent" in req.headers
        return _DummyResponse({"hello": "world"})

    monkeypatch.setattr("src.backend.open_meteo.urllib.request.urlopen", fake_urlopen)
    payload = open_meteo.fetch_json("https://example.test", {"b": 2}, cache=cache, namespace="abc", ttl_seconds=5)
    assert payload == {"hello": "world"}
    assert cache.last_set is not None
    assert cache.last_set[1] == {"hello": "world"}


def test_geocode_uses_coordinate_cache_first(monkeypatch):
    coord_cache = _DummyCoordCache(
        {
            "name": "Snowbird",
            "latitude": 40.5,
            "longitude": -111.6,
            "country": "US",
            "admin1": "UT",
        }
    )
    monkeypatch.setattr("src.backend.open_meteo.fetch_json", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError))
    loc = open_meteo.geocode("Snowbird, UT", cache=_DummyCache(), ttl_seconds=1, coord_cache=coord_cache)
    assert loc is not None
    assert loc.name == "Snowbird"
    assert loc.latitude == 40.5


def test_geocode_openmeteo_success_sets_coord_cache(monkeypatch):
    coord_cache = _DummyCoordCache()

    def fake_fetch_json(url, params, cache, namespace, ttl_seconds):  # noqa: ANN001
        assert namespace == "geocode_openmeteo"
        return {
            "results": [
                {
                    "name": "Snowbird",
                    "latitude": 40.58,
                    "longitude": -111.65,
                    "country": "US",
                    "admin1": "UT",
                }
            ]
        }

    monkeypatch.setattr("src.backend.open_meteo.fetch_json", fake_fetch_json)
    loc = open_meteo.geocode("Snowbird, UT", cache=_DummyCache(), ttl_seconds=10, coord_cache=coord_cache)
    assert loc is not None
    assert loc.query == "Snowbird, UT"
    assert loc.name == "Snowbird"
    assert coord_cache.saved is not None


def test_geocode_fallback_to_nominatim(monkeypatch):
    def fake_fetch_json(url, params, cache, namespace, ttl_seconds):  # noqa: ANN001
        if namespace == "geocode_openmeteo":
            return {"results": []}
        if namespace == "geocode_nominatim":
            return [
                {
                    "display_name": "Snowbird, Utah, US",
                    "lat": "40.58",
                    "lon": "-111.65",
                    "address": {"country": "US", "state": "Utah"},
                }
            ]
        raise AssertionError("unexpected namespace")

    monkeypatch.setattr("src.backend.open_meteo.fetch_json", fake_fetch_json)
    loc = open_meteo.geocode("Snowbird, UT", cache=_DummyCache(), ttl_seconds=10, coord_cache=None)
    assert loc is not None
    assert loc.name.startswith("Snowbird")
    assert loc.admin1 == "Utah"


def test_async_wrappers(monkeypatch):
    monkeypatch.setattr("src.backend.open_meteo.geocode", lambda *args, **kwargs: "g")
    monkeypatch.setattr("src.backend.open_meteo.fetch_forecast", lambda *args, **kwargs: {"f": 1})
    monkeypatch.setattr("src.backend.open_meteo.fetch_history", lambda *args, **kwargs: {"h": 1})
    g = asyncio.run(open_meteo.geocode_async("x", cache=_DummyCache(), ttl_seconds=1))
    f = asyncio.run(open_meteo.fetch_forecast_async("loc", cache=_DummyCache(), ttl_seconds=1))  # type: ignore[arg-type]
    h = asyncio.run(open_meteo.fetch_history_async("loc", cache=_DummyCache(), ttl_seconds=1))  # type: ignore[arg-type]
    assert g == "g"
    assert f == {"f": 1}
    assert h == {"h": 1}
