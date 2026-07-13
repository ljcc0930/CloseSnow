from __future__ import annotations

import json
import urllib.error

import pytest
from src.backend.pipelines import live_pipeline, static_pipeline
from src.backend.runtime import WeatherPayloadBuildRequest, WeatherRuntimeOptions
from src.backend.services import weather_service
from src.contract.validators import ContractValidationError
from src.shared.config import DEFAULT_RESORTS_FILE
from src.web.data_sources.api_source import load_api_payload
from src.web.data_sources.gateway import load_payload
from src.web.data_sources.hourly_source import load_hourly_payload
from src.web.data_sources.local_source import load_local_payload
from src.web.data_sources.request_source import load_request_payload, strip_server_filter_query
from src.web.data_sources.static_json_source import load_static_payload


class _DummyResponse:
    def __init__(self, body: bytes) -> None:
        self._body = body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # noqa: ANN001
        return None

    def read(self) -> bytes:
        return self._body

    def close(self) -> None:
        return None


def test_load_static_payload_success(tmp_path, valid_payload):
    p = tmp_path / "payload.json"
    p.write_text(json.dumps(valid_payload), encoding="utf-8")
    payload = load_static_payload(str(p))
    assert payload["schema_version"] == valid_payload["schema_version"]
    assert payload["reports"][0]["query"] == "Snowbird, UT"


def test_load_static_payload_invalid_schema(tmp_path, valid_payload):
    p = tmp_path / "payload_invalid.json"
    valid_payload["schema_version"] = "bad"
    p.write_text(json.dumps(valid_payload), encoding="utf-8")
    with pytest.raises(ContractValidationError):
        load_static_payload(str(p))


def test_load_api_payload_success(monkeypatch, valid_payload):
    def fake_urlopen(req, timeout):  # noqa: ANN001
        assert req.headers["User-agent"] == "closesnow-data-source/1.0"
        assert req.headers["Accept"] == "application/json"
        assert timeout == 7
        return _DummyResponse(json.dumps(valid_payload).encode("utf-8"))

    monkeypatch.setattr("src.web.data_sources.api_source.urllib.request.urlopen", fake_urlopen)
    payload = load_api_payload("https://example.test/api/data", timeout=7)
    assert payload["resorts_count"] == 1


def test_load_api_payload_invalid_contract(monkeypatch, valid_payload):
    valid_payload["reports"] = [{"query": "a"}]

    def fake_urlopen(req, timeout):  # noqa: ANN001
        return _DummyResponse(json.dumps(valid_payload).encode("utf-8"))

    monkeypatch.setattr("src.web.data_sources.api_source.urllib.request.urlopen", fake_urlopen)
    with pytest.raises(ContractValidationError):
        load_api_payload("https://example.test/api/data")


def test_load_payload_gateway_api(monkeypatch):
    class DummyClient:
        def __init__(self, url, timeout, api_retries):  # noqa: ANN001
            self.source = url
            self.timeout = timeout
            self.api_retries = api_retries

        def load(self):
            return {"source": self.source, "mode": "api", "timeout": self.timeout, "api_retries": self.api_retries}

    monkeypatch.setattr("src.web.data_sources.gateway.HttpPayloadClient", DummyClient)
    payload = load_payload("api", "https://a")
    assert payload["mode"] == "api"
    assert payload["source"] == "https://a"
    assert payload["timeout"] == 20
    assert payload["api_retries"] == 2


def test_load_payload_gateway_file(monkeypatch):
    class DummyClient:
        def __init__(self, path):  # noqa: ANN001
            self.path = path

        def load(self):
            return {"source": self.path, "mode": "file"}

    monkeypatch.setattr("src.web.data_sources.gateway.FilePayloadClient", DummyClient)
    payload = load_payload("file", "/tmp/a.json")
    assert payload["mode"] == "file"
    assert payload["source"] == "/tmp/a.json"


def test_load_payload_gateway_local(monkeypatch):
    class DummyClient:
        def __init__(
            self,
            resorts,
            cache_file,
            geocode_cache_hours,
            forecast_cache_hours,
            max_workers,
            api_retries,
        ):  # noqa: ANN001
            self.resorts = resorts
            self.cache_file = cache_file
            self.geocode_cache_hours = geocode_cache_hours
            self.forecast_cache_hours = forecast_cache_hours
            self.max_workers = max_workers
            self.api_retries = api_retries

        def load(self):
            return {
                "mode": "local",
                "resorts": self.resorts,
                "cache_file": self.cache_file,
                "workers": self.max_workers,
                "api_retries": self.api_retries,
            }

    monkeypatch.setattr("src.web.data_sources.gateway.LocalPayloadClient", DummyClient)
    payload = load_payload(
        "local",
        "",
        resorts=["A", "B"],
        cache_file=".cache/x.json",
        geocode_cache_hours=100,
        forecast_cache_hours=2,
        max_workers=4,
    )
    assert payload["mode"] == "local"
    assert payload["resorts"] == ["A", "B"]
    assert payload["cache_file"] == ".cache/x.json"
    assert payload["workers"] == 4
    assert payload["api_retries"] == 2


def test_load_payload_gateway_local_uses_live_pipeline(monkeypatch):
    captured = {}

    def fake_run_live_payload(**kwargs):  # noqa: ANN001
        captured.update(kwargs)
        return {"ok": True}

    monkeypatch.setattr("src.backend.pipelines.live_pipeline.run_live_payload", fake_run_live_payload)

    load_payload(
        "local",
        "",
        resorts=["A", " ", "B"],
        cache_file=".cache/live.json",
        geocode_cache_hours=111,
        forecast_cache_hours=5,
        max_workers=9,
    )
    assert captured["resorts"] == ["A", "B"]
    assert captured["resorts_file"] == ""
    assert captured["cache_file"] == ".cache/live.json"
    assert captured["geocode_cache_hours"] == 111
    assert captured["forecast_cache_hours"] == 5
    assert captured["max_workers"] == 9

    captured.clear()
    load_payload("local", "", resorts=[], cache_file=".cache/live.json")
    assert captured["resorts"] == []
    assert captured["resorts_file"] == DEFAULT_RESORTS_FILE


def test_live_static_service_and_local_facades_reach_core_with_equivalent_request(monkeypatch):
    captured = []

    def fake_compute(request):  # noqa: ANN001
        captured.append(request)
        return {"reports": []}

    monkeypatch.setattr(weather_service, "compute_pipeline_payload_for_request", fake_compute)
    common = {
        "resorts": ["Snowbird, UT", " ", "Alta, UT"],
        "cache_file": "custom-cache.json",
        "geocode_cache_hours": 21,
        "forecast_cache_hours": 22,
        "max_workers": 23,
        "api_retries": 24,
    }

    weather_service.build_weather_payload(resorts_file="", **common)
    live_pipeline.run_live_payload(resorts_file="", **common)
    static_pipeline.fetch_static_payload(resorts_file="", **common)
    load_local_payload(**common)

    expected = WeatherPayloadBuildRequest(
        resorts=("Snowbird, UT", "Alta, UT"),
        resorts_file="",
        runtime=WeatherRuntimeOptions(
            cache_file="custom-cache.json",
            geocode_cache_hours=21,
            forecast_cache_hours=22,
            max_workers=23,
            api_retries=24,
        ),
    )
    assert captured == [expected, expected, expected, expected]


def test_load_payload_gateway_rejects_unknown_mode():
    with pytest.raises(ValueError, match="Unsupported data source mode"):
        load_payload("unknown", "x")


def test_gateway_routes_to_api_with_timeout(monkeypatch):
    class DummyClient:
        def __init__(self, url, timeout, api_retries):  # noqa: ANN001
            self.source = url
            self.timeout = timeout
            self.api_retries = api_retries

        def load(self):
            return {
                "ok": True,
                "source": self.source,
                "timeout": self.timeout,
                "api_retries": self.api_retries,
            }

    monkeypatch.setattr("src.web.data_sources.gateway.HttpPayloadClient", DummyClient)
    payload = load_payload(mode="api", source="https://a", timeout=11, api_retries=4)
    assert payload == {"ok": True, "source": "https://a", "timeout": 11, "api_retries": 4}


def test_strip_server_filter_query():
    qs = {
        "resort": ["Snowbird, UT"],
        "pass_type": ["ikon"],
        "region": ["west"],
        "search": ["powder"],
        "include_all": ["1"],
    }
    assert strip_server_filter_query(qs) == {"resort": ["Snowbird, UT"]}


def test_load_request_payload_local_with_server_filters(monkeypatch):
    calls = {}

    monkeypatch.setattr(
        "src.web.data_sources.request_source.select_resorts_from_query",
        lambda qs: (
            ["Snowbird, UT"],
            "",
            {"pass_type": ["ikon"], "region": "west"},
            {"pass_type": {"ikon": 1}, "region": {"west": 1}},
            False,
        ),
    )

    def fake_load_local_payload(**kwargs):  # noqa: ANN001
        calls.update(kwargs)
        return {
            "schema_version": "weather_payload_v1",
            "generated_at_utc": "2026-03-03T23:00:00Z",
            "source": "Open-Meteo",
            "model": "ecmwf_ifs025",
            "forecast_days": 15,
            "units": {},
            "cache": {},
            "resorts_count": 1,
            "failed_count": 0,
            "failed": [],
            "reports": [{"query": "Snowbird, UT", "daily": []}],
        }

    monkeypatch.setattr("src.web.data_sources.request_source.load_local_payload", fake_load_local_payload)

    payload = load_request_payload(
        mode="local",
        source="",
        query_params={"pass_type": ["ikon"], "region": ["west"]},
        cache_file=".cache/x.json",
        geocode_cache_hours=100,
        forecast_cache_hours=2,
        max_workers=4,
    )
    assert calls["resorts"] == ["Snowbird, UT"]
    assert calls["cache_file"] == ".cache/x.json"
    assert calls["max_workers"] == 4
    assert payload["available_filters"]["pass_type"]["ikon"] == 1
    assert payload["applied_filters"]["pass_type"] == ["ikon"]


def test_load_request_payload_local_filter_no_match(monkeypatch):
    monkeypatch.setattr(
        "src.web.data_sources.request_source.select_resorts_from_query",
        lambda qs: (
            [],
            "",
            {"pass_type": ["ikon"]},
            {"pass_type": {"ikon": 1}},
            True,
        ),
    )

    def fake_build_empty_payload(**kwargs):  # noqa: ANN001
        return {
            "schema_version": "weather_payload_v1",
            "generated_at_utc": "2026-03-03T23:00:00Z",
            "source": "Open-Meteo",
            "model": "ecmwf_ifs025",
            "forecast_days": 15,
            "units": {},
            "cache": {},
            "resorts_count": 0,
            "failed_count": 0,
            "failed": [],
            "reports": [],
        }

    monkeypatch.setattr("src.web.data_sources.request_source.build_empty_payload", fake_build_empty_payload)

    payload = load_request_payload(
        mode="local",
        source="",
        query_params={"pass_type": ["ikon"]},
    )
    assert payload["reports"] == []
    assert payload["available_filters"]["pass_type"]["ikon"] == 1
    assert payload["applied_filters"]["pass_type"] == ["ikon"]


def test_load_request_payload_api_forwards_query(monkeypatch):
    calls = {}

    def fake_load_payload(mode, source, timeout=20, **kwargs):  # noqa: ANN001
        calls["mode"] = mode
        calls["source"] = source
        calls["timeout"] = timeout
        calls["kwargs"] = kwargs
        return {
            "schema_version": "weather_payload_v1",
            "generated_at_utc": "2026-03-03T23:00:00Z",
            "source": "Open-Meteo",
            "model": "ecmwf_ifs025",
            "forecast_days": 15,
            "units": {},
            "cache": {},
            "resorts_count": 0,
            "failed_count": 0,
            "failed": [],
            "reports": [],
        }

    monkeypatch.setattr("src.web.data_sources.request_source.load_payload", fake_load_payload)

    load_request_payload(
        mode="api",
        source="https://example.test/api/data?existing=1",
        timeout=11,
        query_params={
            "resort": ["A", "B"],
            "pass_type": ["ikon"],
            "region": ["west"],
            "include_all": ["1"],
        },
    )
    assert calls["mode"] == "api"
    assert "existing=1" in calls["source"]
    assert "resort=A" in calls["source"]
    assert "resort=B" in calls["source"]
    assert "pass_type=ikon" in calls["source"]
    assert "region=west" in calls["source"]
    assert "include_all=1" in calls["source"]
    assert calls["timeout"] == 11
    assert calls["kwargs"]["resorts"] == ["A", "B"]


def test_load_request_payload_populates_filter_metadata_fallback(monkeypatch):
    monkeypatch.setattr(
        "src.web.data_sources.request_source.load_payload",
        lambda **kwargs: {
            "schema_version": "weather_payload_v1",
            "generated_at_utc": "2026-03-03T23:00:00Z",
            "source": "Open-Meteo",
            "model": "ecmwf_ifs025",
            "forecast_days": 15,
            "units": {},
            "cache": {},
            "resorts_count": 0,
            "failed_count": 0,
            "failed": [],
            "reports": [],
        },
    )
    monkeypatch.setattr("src.web.data_sources.request_source.load_supported_resort_catalog", lambda: [{"query": "A"}])
    monkeypatch.setattr(
        "src.web.data_sources.request_source.available_filters", lambda catalog: {"pass_type": {"ikon": 1}}
    )
    monkeypatch.setattr("src.web.data_sources.request_source.default_applied_filters", lambda: {"search": ""})

    payload = load_request_payload(mode="file", source="/tmp/payload.json")
    assert payload["available_filters"] == {"pass_type": {"ikon": 1}}
    assert payload["applied_filters"] == {"search": ""}


def test_load_hourly_payload_local_mode(monkeypatch):
    captured = {}

    def fake_build_hourly_payload_for_resort(**kwargs):  # noqa: ANN001
        captured.update(kwargs)
        return {
            "resort_id": kwargs["resort_id"],
            "hours": kwargs["hours"],
            "hourly": {"time": []},
        }

    monkeypatch.setattr(
        "src.web.data_sources.hourly_source.build_hourly_payload_for_resort",
        fake_build_hourly_payload_for_resort,
    )
    code, payload = load_hourly_payload(
        "local",
        "",
        resort_id="snowbird-ut",
        hours=6,
        cache_file=".cache/hourly.json",
        geocode_cache_hours=100,
        forecast_cache_hours=2,
    )
    assert code == 200
    assert payload["resort_id"] == "snowbird-ut"
    assert captured["cache_file"] == ".cache/hourly.json"
    assert captured["geocode_cache_hours"] == 100
    assert captured["forecast_cache_hours"] == 2


def test_load_hourly_payload_local_mode_returns_502_on_builder_error(monkeypatch):
    monkeypatch.setattr(
        "src.web.data_sources.hourly_source.build_hourly_payload_for_resort",
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError("rate limited")),
    )
    code, payload = load_hourly_payload("local", "", resort_id="snowbird-ut", hours=6)
    assert code == 502
    assert payload["error"] == "rate limited"


def test_load_hourly_payload_api_mode(monkeypatch):
    captured = {}

    def fake_urlopen(url, timeout):  # noqa: ANN001
        captured["url"] = url
        captured["timeout"] = timeout
        return _DummyResponse(json.dumps({"resort_id": "snowbird-ut", "hourly": {"time": []}}).encode("utf-8"))

    monkeypatch.setattr("src.web.data_sources.hourly_source.urllib.request.urlopen", fake_urlopen)
    code, payload = load_hourly_payload(
        "api",
        "https://example.test/api/data?resort=snowbird-ut",
        resort_id="snowbird-ut",
        hours=12,
        timeout=11,
    )
    assert code == 200
    assert payload["resort_id"] == "snowbird-ut"
    assert captured["timeout"] == 11
    assert captured["url"].startswith("https://example.test/api/resort-hourly?")
    assert "resort_id=snowbird-ut" in captured["url"]
    assert "hours=12" in captured["url"]


def test_load_hourly_payload_api_mode_preserves_non_json_http_error(monkeypatch):
    def fake_urlopen(url, timeout):  # noqa: ANN001
        raise urllib.error.HTTPError(url, 503, "Unavailable", {}, _DummyResponse(b"upstream down"))

    monkeypatch.setattr("src.web.data_sources.hourly_source.urllib.request.urlopen", fake_urlopen)
    code, payload = load_hourly_payload(
        "api", "https://example.test/api/data", resort_id="snowbird-ut", hours=12, api_retries=0
    )

    assert code == 503
    assert payload == {"error": "upstream down"}


def test_load_hourly_payload_api_mode_returns_502_for_invalid_json(monkeypatch):
    monkeypatch.setattr(
        "src.web.data_sources.hourly_source.urllib.request.urlopen",
        lambda url, timeout: _DummyResponse(b"not-json"),
    )

    code, payload = load_hourly_payload(
        "api", "https://example.test/api/data", resort_id="snowbird-ut", hours=12, api_retries=0
    )

    assert code == 502
    assert "Expecting value" in payload["error"]


def test_load_hourly_payload_file_mode_reads_static_hourly_json(tmp_path):
    data_json = tmp_path / "data.json"
    data_json.write_text("{}", encoding="utf-8")
    hourly_dir = tmp_path / "resort" / "snowbird-ut"
    hourly_dir.mkdir(parents=True)
    (hourly_dir / "hourly.json").write_text(
        json.dumps(
            {
                "resort_id": "snowbird-ut",
                "hours": 3,
                "hourly": {
                    "time": ["2026-03-04T00:00", "2026-03-04T01:00", "2026-03-04T02:00"],
                    "snowfall": [0.0, 0.1, 0.2],
                    "rain": [0.0, 0.0, 0.0],
                    "precipitation_probability": [20, 10, 5],
                    "snow_depth": [100, 100, 101],
                    "wind_speed_10m": [5.0, 6.0, 7.0],
                    "wind_direction_10m": [120, 110, 100],
                    "visibility": [9000, 8800, 8700],
                },
            }
        ),
        encoding="utf-8",
    )

    code, payload = load_hourly_payload("file", str(data_json), resort_id="snowbird-ut", hours=2)
    assert code == 200
    assert payload["resort_id"] == "snowbird-ut"
    assert payload["hours"] == 2
    assert payload["hourly"]["time"] == ["2026-03-04T00:00", "2026-03-04T01:00"]
    assert payload["hourly"]["snowfall"] == [0.0, 0.1]


def test_load_hourly_payload_file_mode_missing_hourly_json(tmp_path):
    data_json = tmp_path / "data.json"
    data_json.write_text("{}", encoding="utf-8")

    code, payload = load_hourly_payload("file", str(data_json), resort_id="snowbird-ut", hours=12)
    assert code == 404
    assert payload["error"] == "Hourly file not found for resort_id: snowbird-ut"
