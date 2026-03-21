from __future__ import annotations

import json

import pytest

from src.contract.validators import ContractValidationError
from src.shared.config import DEFAULT_RESORTS_FILE
from src.web.data_sources.api_source import load_api_payload
from src.web.data_sources.gateway import build_payload_client, load_payload
from src.web.data_sources.hourly_source import load_hourly_payload
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
        def __init__(self, url, timeout):  # noqa: ANN001
            self.source = url
            self.timeout = timeout

        def load(self):
            return {"source": self.source, "mode": "api", "timeout": self.timeout}

    monkeypatch.setattr("src.web.data_sources.gateway.HttpPayloadClient", DummyClient)
    payload = load_payload("api", "https://a")
    assert payload["mode"] == "api"
    assert payload["source"] == "https://a"
    assert payload["timeout"] == 20


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
        def __init__(self, resorts, cache_file, geocode_cache_hours, forecast_cache_hours, max_workers):  # noqa: ANN001
            self.resorts = resorts
            self.cache_file = cache_file
            self.geocode_cache_hours = geocode_cache_hours
            self.forecast_cache_hours = forecast_cache_hours
            self.max_workers = max_workers

        def load(self):
            return {
                "mode": "local",
                "resorts": self.resorts,
                "cache_file": self.cache_file,
                "workers": self.max_workers,
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


def test_load_payload_gateway_rejects_unknown_mode():
    with pytest.raises(ValueError, match="Unsupported data source mode"):
        load_payload("unknown", "x")


def test_gateway_routes_to_api_with_timeout(monkeypatch):
    class DummyClient:
        def __init__(self, url, timeout):  # noqa: ANN001
            self.source = url
            self.timeout = timeout

        def load(self):
            return {"ok": True, "source": self.source, "timeout": self.timeout}

    monkeypatch.setattr("src.web.data_sources.gateway.HttpPayloadClient", DummyClient)
    payload = load_payload(mode="api", source="https://a", timeout=11)
    assert payload == {"ok": True, "source": "https://a", "timeout": 11}


def test_build_payload_client_types():
    api_client = build_payload_client("api", "https://a", timeout=9)
    file_client = build_payload_client("file", "/tmp/a.json")
    local_client = build_payload_client("local", "", resorts=["A"])
    assert type(api_client).__name__ == "HttpPayloadClient"
    assert type(file_client).__name__ == "FilePayloadClient"
    assert type(local_client).__name__ == "LocalPayloadClient"


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


def test_load_hourly_payload_file_mode_is_explicitly_unavailable():
    code, payload = load_hourly_payload("file", "/tmp/data.json", resort_id="snowbird-ut", hours=12)
    assert code == 501
    assert payload["error"] == "Hourly endpoint unavailable in file mode"
