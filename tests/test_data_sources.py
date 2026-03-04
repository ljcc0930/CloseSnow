from __future__ import annotations

import json

import pytest

from src.contract.validators import ContractValidationError
from src.web.data_sources.api_source import load_api_payload
from src.web.data_sources.gateway import load_payload
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
    def fake_load_api(url, timeout=20):  # noqa: ANN001
        assert timeout == 20
        return {"source": url, "mode": "api"}

    monkeypatch.setattr("src.web.data_sources.gateway.load_api_payload", fake_load_api)
    payload = load_payload("api", "https://a")
    assert payload["mode"] == "api"
    assert payload["source"] == "https://a"


def test_load_payload_gateway_file(monkeypatch):
    monkeypatch.setattr(
        "src.web.data_sources.gateway.load_static_payload",
        lambda source: {"source": source, "mode": "file"},
    )
    payload = load_payload("file", "/tmp/a.json")
    assert payload["mode"] == "file"
    assert payload["source"] == "/tmp/a.json"


def test_load_payload_gateway_rejects_unknown_mode():
    with pytest.raises(ValueError, match="Unsupported data source mode"):
        load_payload("unknown", "x")


def test_gateway_routes_to_api_with_timeout(monkeypatch):
    calls = {}

    def fake_load_api(url, timeout=20):  # noqa: ANN001
        calls["url"] = url
        calls["timeout"] = timeout
        return {"ok": True}

    monkeypatch.setattr("src.web.data_sources.gateway.load_api_payload", fake_load_api)
    payload = load_payload(mode="api", source="https://a", timeout=11)
    assert payload == {"ok": True}
    assert calls == {"url": "https://a", "timeout": 11}
