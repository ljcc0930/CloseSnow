from __future__ import annotations

import argparse
from pathlib import Path

import pytest

from src import cli


def test_build_parser_has_all_commands():
    parser = cli.build_parser()
    args = parser.parse_args(["fetch"])
    assert args.command == "fetch"
    args = parser.parse_args(["render"])
    assert args.command == "render"
    args = parser.parse_args(["static"])
    assert args.command == "static"
    args = parser.parse_args(["serve"])
    assert args.command == "serve"
    args = parser.parse_args(["serve-data"])
    assert args.command == "serve-data"
    args = parser.parse_args(["serve-web"])
    assert args.command == "serve-web"


def test_serve_web_parser_uses_env_default(monkeypatch):
    monkeypatch.setenv("CLOSESNOW_DATA_URL", "https://example.test/api/data")
    parser = cli.build_parser()
    args = parser.parse_args(["serve-web"])
    assert args.data_source == "https://example.test/api/data"


def test_resolve_resorts_prefers_cli_resorts():
    args = argparse.Namespace(resort=[" Snowbird, UT ", ""], resorts_file="resorts.txt")
    resorts, resorts_file = cli._resolve_resorts(args)
    assert resorts == ["Snowbird, UT"]
    assert resorts_file == ""


def test_resolve_resorts_uses_file_when_no_resort():
    args = argparse.Namespace(resort=[], resorts_file="resorts.txt")
    resorts, resorts_file = cli._resolve_resorts(args)
    assert resorts == []
    assert resorts_file == "resorts.txt"


def _build_fetch_like_args(tmp_path: Path):
    return argparse.Namespace(
        resort=[],
        resorts_file="resorts.txt",
        cache_file=".cache/open_meteo_cache.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=8,
        output_json=str(tmp_path / "data.json"),
    )


def test_run_fetch(monkeypatch, tmp_path, capsys):
    args = _build_fetch_like_args(tmp_path)
    called = {}

    monkeypatch.setattr("src.cli.fetch_static_payload", lambda **kwargs: {"reports": [], "called": kwargs})

    def fake_write_payload_json(path, payload):  # noqa: ANN001
        called["path"] = path
        called["payload"] = payload
        return Path(path)

    monkeypatch.setattr("src.cli.write_payload_json", fake_write_payload_json)
    rc = cli.run_fetch(args)
    out = capsys.readouterr().out
    assert rc == 0
    assert "Done:" in out
    assert called["path"] == args.output_json
    assert called["payload"]["reports"] == []


def test_run_render(monkeypatch, tmp_path, capsys):
    args = argparse.Namespace(input_json=str(tmp_path / "in.json"), output_html=str(tmp_path / "out.html"))
    monkeypatch.setattr("src.cli.load_payload", lambda mode, source: {"reports": [], "from": source, "mode": mode})
    monkeypatch.setattr("src.cli.render_html", lambda path, payload: Path(path))
    monkeypatch.setattr("src.cli.render_hourly_pages", lambda path, payload: [])
    rc = cli.run_render(args)
    out = capsys.readouterr().out
    assert rc == 0
    assert "Done:" in out


def test_run_static_default(monkeypatch, tmp_path, capsys):
    args = _build_fetch_like_args(tmp_path)
    args.output_html = str(tmp_path / "index.html")
    args.skip_fetch = False
    args.skip_render = False

    monkeypatch.setattr("src.cli._fetch_payload", lambda a: {"reports": [{"query": "a", "daily": []}]})
    monkeypatch.setattr("src.cli.write_payload_json", lambda path, payload: Path(path))
    monkeypatch.setattr("src.cli.render_html", lambda path, payload: Path(path))
    monkeypatch.setattr("src.cli.render_hourly_pages", lambda path, payload: [])
    rc = cli.run_static(args)
    out = capsys.readouterr().out
    assert rc == 0
    assert "Done:" in out


def test_run_static_skip_fetch(monkeypatch, tmp_path):
    args = _build_fetch_like_args(tmp_path)
    args.output_html = str(tmp_path / "index.html")
    args.skip_fetch = True
    args.skip_render = False
    monkeypatch.setattr("src.cli.load_payload", lambda mode, source: {"reports": [], "loaded": source, "mode": mode})
    monkeypatch.setattr("src.cli.render_html", lambda path, payload: Path(path))
    monkeypatch.setattr("src.cli.render_hourly_pages", lambda path, payload: [])
    rc = cli.run_static(args)
    assert rc == 0


def test_run_static_skip_render(monkeypatch, tmp_path):
    args = _build_fetch_like_args(tmp_path)
    args.output_html = str(tmp_path / "index.html")
    args.skip_fetch = False
    args.skip_render = True
    monkeypatch.setattr("src.cli._fetch_payload", lambda a: {"reports": []})
    monkeypatch.setattr("src.cli.write_payload_json", lambda path, payload: Path(path))
    rc = cli.run_static(args)
    assert rc == 0


def test_run_server_boot_path(monkeypatch, capsys):
    calls = {"closed": False, "served": False}

    class DummyServer:
        def __init__(self, addr, handler):  # noqa: ANN001
            assert addr == ("127.0.0.1", 8010)
            assert handler == "handler"

        def serve_forever(self):
            calls["served"] = True
            raise KeyboardInterrupt

        def server_close(self):
            calls["closed"] = True

    args = argparse.Namespace(
        host="127.0.0.1",
        port=8010,
        cache_file=".cache/a.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=8,
    )
    monkeypatch.setattr("src.cli.make_handler", lambda **kwargs: "handler")
    monkeypatch.setattr("src.cli.ThreadingHTTPServer", DummyServer)
    rc = cli.run_server(args)
    out = capsys.readouterr().out
    assert rc == 0
    assert calls["served"] is True
    assert calls["closed"] is True
    assert "Serving dynamic page" in out


def test_run_data_server_boot_path(monkeypatch, capsys):
    calls = {"closed": False, "served": False}

    class DummyServer:
        def __init__(self, addr, handler):  # noqa: ANN001
            assert addr == ("127.0.0.1", 8020)
            assert handler == "handler"

        def serve_forever(self):
            calls["served"] = True
            raise KeyboardInterrupt

        def server_close(self):
            calls["closed"] = True

    args = argparse.Namespace(
        host="127.0.0.1",
        port=8020,
        cache_file=".cache/a.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=8,
        allow_origin="*",
    )
    monkeypatch.setattr("src.cli.make_data_handler", lambda **kwargs: "handler")
    monkeypatch.setattr("src.cli.ThreadingHTTPServer", DummyServer)
    rc = cli.run_data_server(args)
    out = capsys.readouterr().out
    assert rc == 0
    assert calls["served"] is True
    assert calls["closed"] is True
    assert "Serving backend data API" in out


def test_run_web_server_boot_path(monkeypatch, capsys):
    calls = {"closed": False, "served": False}

    class DummyServer:
        def __init__(self, addr, handler):  # noqa: ANN001
            assert addr == ("127.0.0.1", 8010)
            assert handler == "handler"

        def serve_forever(self):
            calls["served"] = True
            raise KeyboardInterrupt

        def server_close(self):
            calls["closed"] = True

    args = argparse.Namespace(
        host="127.0.0.1",
        port=8010,
        data_mode="api",
        data_source="http://127.0.0.1:8020/api/data",
        data_timeout=11,
        cache_file=".cache/a.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=8,
    )
    monkeypatch.setattr("src.cli.make_handler", lambda **kwargs: "handler")
    monkeypatch.setattr("src.cli.ThreadingHTTPServer", DummyServer)
    rc = cli.run_web_server(args)
    out = capsys.readouterr().out
    assert rc == 0
    assert calls["served"] is True
    assert calls["closed"] is True
    assert "Serving frontend web" in out
    assert "Data mode: api" in out


def test_main_dispatches_fetch(monkeypatch):
    monkeypatch.setattr(
        "src.cli.build_parser",
        lambda: type("P", (), {"parse_args": staticmethod(lambda: argparse.Namespace(command="fetch"))})(),
    )
    monkeypatch.setattr("src.cli.run_fetch", lambda args: 7)
    assert cli.main() == 7


def test_main_dispatches_serve_data(monkeypatch):
    monkeypatch.setattr(
        "src.cli.build_parser",
        lambda: type("P", (), {"parse_args": staticmethod(lambda: argparse.Namespace(command="serve-data"))})(),
    )
    monkeypatch.setattr("src.cli.run_data_server", lambda args: 9)
    assert cli.main() == 9


def test_main_dispatches_serve_web(monkeypatch):
    monkeypatch.setattr(
        "src.cli.build_parser",
        lambda: type("P", (), {"parse_args": staticmethod(lambda: argparse.Namespace(command="serve-web"))})(),
    )
    monkeypatch.setattr("src.cli.run_web_server", lambda args: 10)
    assert cli.main() == 10


def test_main_raises_for_unknown_command(monkeypatch):
    monkeypatch.setattr(
        "src.cli.build_parser",
        lambda: type("P", (), {"parse_args": staticmethod(lambda: argparse.Namespace(command="unknown"))})(),
    )
    with pytest.raises(ValueError, match="Unsupported command"):
        cli.main()
