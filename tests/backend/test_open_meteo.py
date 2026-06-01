from __future__ import annotations

import asyncio
import json
import urllib.error

import pytest
from src.backend import open_meteo
from src.backend.models import ResortLocation


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

    assert open_meteo.with_retry(flappy, retries=3, retry_delay_seconds=0) == "ok"
    assert calls["n"] == 3


def test_with_retry_async_recovers_from_transient(monkeypatch):
    calls = {"n": 0}
    original_sleep = asyncio.sleep
    sleeps = []

    async def fake_sleep(delay):  # noqa: ANN001
        sleeps.append(delay)
        await original_sleep(0)

    async def flappy():
        calls["n"] += 1
        if calls["n"] < 3:
            raise urllib.error.URLError("temporary")
        return "ok"

    monkeypatch.setattr("src.backend.open_meteo.asyncio.sleep", fake_sleep)
    assert asyncio.run(open_meteo.with_retry_async(flappy, retries=3, retry_delay_seconds=10)) == "ok"
    assert calls["n"] == 3
    assert sleeps == [10, 10]


def test_with_retry_does_not_retry_non_transient_http_error():
    err = urllib.error.HTTPError("https://x", 404, "not found", hdrs=None, fp=None)
    calls = {"n": 0}

    def always_fail():
        calls["n"] += 1
        raise err

    with pytest.raises(urllib.error.HTTPError):
        open_meteo.with_retry(always_fail, retries=3, retry_delay_seconds=0)
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
    monkeypatch.setattr("src.backend.open_meteo.time.sleep", lambda _: None)
    calls = {"n": 0}

    def fake_urlopen(req, timeout):  # noqa: ANN001
        calls["n"] += 1
        assert "User-Agent" in req.headers or "User-agent" in req.headers
        if calls["n"] == 1:
            raise urllib.error.URLError("temporary")
        return _DummyResponse({"hello": "world"})

    monkeypatch.setattr("src.backend.open_meteo.urllib.request.urlopen", fake_urlopen)
    payload = open_meteo.fetch_json(
        "https://example.test", {"b": 2}, cache=cache, namespace="abc", ttl_seconds=5, api_retries=1
    )
    assert payload == {"hello": "world"}
    assert calls["n"] == 2
    assert cache.last_set is not None
    assert cache.last_set[1] == {"hello": "world"}


def test_fetch_json_async_returns_cache_hit_without_request(monkeypatch):
    cache = _DummyCache(cached={"ok": True})
    called = {"n": 0}

    async def bad_request(url, timeout):  # noqa: ANN001
        del url, timeout
        called["n"] += 1
        raise AssertionError("async request should not be called for cache hit")

    monkeypatch.setattr("src.backend.open_meteo._request_json_async", bad_request)
    out = asyncio.run(
        open_meteo.fetch_json_async("https://example.test", {"a": 1}, cache=cache, namespace="n", ttl_seconds=100)
    )
    assert out == {"ok": True}
    assert called["n"] == 0


def test_fetch_json_async_cache_miss_requests_and_sets_cache(monkeypatch):
    cache = _DummyCache(cached=None)
    captured = {}
    original_sleep = asyncio.sleep
    sleeps = []
    calls = {"n": 0}

    async def fake_request(url, timeout):  # noqa: ANN001
        calls["n"] += 1
        captured["url"] = url
        captured["timeout"] = timeout
        if calls["n"] == 1:
            raise urllib.error.URLError("temporary")
        return {"hello": "async"}

    async def fake_sleep(delay):  # noqa: ANN001
        sleeps.append(delay)
        await original_sleep(0)

    monkeypatch.setattr("src.backend.open_meteo._request_json_async", fake_request)
    monkeypatch.setattr("src.backend.open_meteo.asyncio.sleep", fake_sleep)
    payload = asyncio.run(
        open_meteo.fetch_json_async(
            "https://example.test", {"b": 2}, cache=cache, namespace="abc", ttl_seconds=5, api_retries=1
        )
    )
    assert payload == {"hello": "async"}
    assert calls["n"] == 2
    assert sleeps == [open_meteo.API_RETRY_DELAY_SECONDS]
    assert captured["url"] == "https://example.test?b=2"
    assert captured["timeout"] == 20
    assert cache.last_set is not None
    assert cache.last_set[1] == {"hello": "async"}


def test_async_http_response_parses_chunked_json():
    raw = (
        b"HTTP/1.1 200 OK\r\n"
        b"Content-Type: application/json\r\n"
        b"Transfer-Encoding: chunked\r\n"
        b"\r\n"
        b'4\r\n{"ok\r\n'
        b'8\r\n": true}\r\n'
        b"0\r\n\r\n"
    )
    assert open_meteo._json_from_http_response(raw, "https://example.test") == {"ok": True}


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
    monkeypatch.setattr(
        "src.backend.open_meteo.fetch_json", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError)
    )
    loc = open_meteo.geocode("Snowbird, UT", cache=_DummyCache(), ttl_seconds=1, coord_cache=coord_cache)
    assert loc is not None
    assert loc.name == "Snowbird"
    assert loc.latitude == 40.5


def test_geocode_openmeteo_success_sets_coord_cache(monkeypatch):
    coord_cache = _DummyCoordCache()

    def fake_fetch_json(url, params, cache, namespace, ttl_seconds, api_retries):  # noqa: ANN001
        assert api_retries == 2
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
    def fake_fetch_json(url, params, cache, namespace, ttl_seconds, api_retries):  # noqa: ANN001
        assert api_retries == 2
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


def test_async_apis_use_async_transport(monkeypatch):
    captured = {}

    async def fake_fetch_json_async(url, params, cache, namespace, ttl_seconds, api_retries):  # noqa: ANN001
        del url, cache, ttl_seconds
        assert api_retries == 5
        captured[namespace] = params
        if namespace == "geocode_openmeteo":
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
        return {"namespace": namespace}

    monkeypatch.setattr("src.backend.open_meteo.fetch_json_async", fake_fetch_json_async)
    loc = asyncio.run(open_meteo.geocode_async("Snowbird, UT", cache=_DummyCache(), ttl_seconds=1, api_retries=5))
    assert loc is not None

    forecast = asyncio.run(open_meteo.fetch_forecast_async(loc, cache=_DummyCache(), ttl_seconds=1, api_retries=5))
    history = asyncio.run(open_meteo.fetch_history_async(loc, cache=_DummyCache(), ttl_seconds=1, api_retries=5))
    hourly = asyncio.run(
        open_meteo.fetch_hourly_forecast_async(loc, cache=_DummyCache(), ttl_seconds=1, hours=72, api_retries=5)
    )

    assert forecast == {"namespace": "forecast_ecmwf_unified"}
    assert history == {"namespace": "history_ecmwf_unified"}
    assert hourly == {"namespace": "hourly_ecmwf_unified"}
    assert captured["geocode_openmeteo"]["name"] == "Snowbird, UT"
    assert "weather_code" in captured["forecast_ecmwf_unified"]["daily"]
    assert captured["history_ecmwf_unified"]["past_days"] == open_meteo.HISTORY_DAYS
    assert captured["hourly_ecmwf_unified"]["forecast_days"] == 3


def test_fetch_forecast_and_history_include_weather_and_sun_daily_fields(monkeypatch):
    captured = {}

    def fake_fetch_json(url, params, cache, namespace, ttl_seconds, api_retries):  # noqa: ANN001
        del url, cache, ttl_seconds
        assert api_retries == 4
        captured[namespace] = params["daily"]
        return {"ok": True}

    monkeypatch.setattr("src.backend.open_meteo.fetch_json", fake_fetch_json)
    loc = ResortLocation(
        query="Snowbird, UT",
        name="Snowbird",
        latitude=40.58,
        longitude=-111.65,
        country="US",
        admin1="UT",
    )
    open_meteo.fetch_forecast(loc, cache=_DummyCache(), ttl_seconds=10, api_retries=4)
    open_meteo.fetch_history(loc, cache=_DummyCache(), ttl_seconds=10, api_retries=4)

    forecast_daily = captured["forecast_ecmwf_unified"]
    history_daily = captured["history_ecmwf_unified"]
    for daily_params in (forecast_daily, history_daily):
        assert "weather_code" in daily_params
        assert "sunrise" in daily_params
        assert "sunset" in daily_params


def test_fetch_hourly_forecast_requests_required_hourly_fields(monkeypatch):
    captured = {}

    def fake_fetch_json(url, params, cache, namespace, ttl_seconds, api_retries):  # noqa: ANN001
        del url, cache, ttl_seconds
        assert api_retries == 6
        captured["namespace"] = namespace
        captured["hourly"] = params["hourly"]
        captured["forecast_days"] = params["forecast_days"]
        return {"ok": True}

    monkeypatch.setattr("src.backend.open_meteo.fetch_json", fake_fetch_json)
    loc = ResortLocation(
        query="Snowbird, UT",
        name="Snowbird",
        latitude=40.58,
        longitude=-111.65,
        country="US",
        admin1="UT",
    )
    open_meteo.fetch_hourly_forecast(loc, cache=_DummyCache(), ttl_seconds=10, hours=72, api_retries=6)
    assert captured["namespace"] == "hourly_ecmwf_unified"
    assert captured["forecast_days"] == 3
    for key in [
        "snowfall",
        "rain",
        "precipitation_probability",
        "snow_depth",
        "wind_speed_10m",
        "wind_direction_10m",
        "visibility",
    ]:
        assert key in captured["hourly"]
