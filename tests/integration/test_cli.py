from __future__ import annotations

import argparse
import os
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
    args = parser.parse_args(["serve-static"])
    assert args.command == "serve-static"
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


def test_serve_static_parser_uses_build_defaults():
    parser = cli.build_parser()
    args = parser.parse_args(["serve-static"])
    assert args.directory == "site"
    assert args.cache_file == ".cache/open_meteo_cache.json"
    assert args.max_workers == 8
    assert args.skip_fetch is False
    assert args.skip_render is False


def test_render_parser_defaults_output_dir_from_input_parent():
    parser = cli.build_parser()
    args = parser.parse_args(["render"])
    assert args.output_dir is None


def test_static_parser_uses_output_dir_default():
    parser = cli.build_parser()
    args = parser.parse_args(["static"])
    assert args.output_dir == "site"
    assert args.output_json is None
    assert args.max_workers == 8


def test_resolve_resorts_prefers_cli_resorts():
    args = argparse.Namespace(resort=[" Snowbird, UT ", ""], resorts_file="resorts.yml", include_all_resorts=True)
    resorts, resorts_file, include_all_resorts = cli._resolve_resorts(args)
    assert resorts == ["Snowbird, UT"]
    assert resorts_file == ""
    assert include_all_resorts is False


def test_resolve_resorts_uses_file_when_no_resort():
    args = argparse.Namespace(resort=[], resorts_file="resorts.yml", include_all_resorts=True)
    resorts, resorts_file, include_all_resorts = cli._resolve_resorts(args)
    assert resorts == []
    assert resorts_file == "resorts.yml"
    assert include_all_resorts is True


def _build_fetch_like_args(tmp_path: Path):
    return argparse.Namespace(
        resort=[],
        resorts_file="resorts.yml",
        include_all_resorts=False,
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


def test_fetch_payload_forwards_include_all_resorts(monkeypatch, tmp_path):
    args = _build_fetch_like_args(tmp_path)
    args.include_all_resorts = True
    captured = {}

    def fake_fetch_static_payload(**kwargs):  # noqa: ANN001
        captured.update(kwargs)
        return {"reports": []}

    monkeypatch.setattr("src.cli.fetch_static_payload", fake_fetch_static_payload)
    cli._fetch_payload(args)
    assert captured["include_all_resorts"] is True


def test_run_render(monkeypatch, tmp_path, capsys):
    args = argparse.Namespace(input_json=str(tmp_path / "in.json"), output_dir=str(tmp_path / "out"))
    monkeypatch.setattr("src.cli.load_payload", lambda mode, source: {"reports": [], "from": source, "mode": mode})
    monkeypatch.setattr("src.cli.render_html", lambda path, payload, **kwargs: Path(path))
    monkeypatch.setattr("src.cli.render_hourly_pages", lambda *args, **kwargs: [])
    monkeypatch.setattr("src.cli._copy_static_assets", lambda directory: [Path(directory) / "assets" / "css"])
    rc = cli.run_render(args)
    out = capsys.readouterr().out
    assert rc == 0
    assert "Done:" in out


def test_run_static_default(monkeypatch, tmp_path, capsys):
    args = _build_fetch_like_args(tmp_path)
    args.output_dir = str(tmp_path / "site")
    args.output_json = None
    args.skip_fetch = False
    args.skip_render = False

    monkeypatch.setattr("src.cli._fetch_payload", lambda a: {"reports": [{"query": "a", "daily": []}]})
    monkeypatch.setattr("src.cli.write_payload_json", lambda path, payload: Path(path))
    monkeypatch.setattr("src.cli.render_html", lambda path, payload, **kwargs: Path(path))
    monkeypatch.setattr("src.cli.render_hourly_pages", lambda *args, **kwargs: [])
    monkeypatch.setattr("src.cli._copy_static_assets", lambda directory: [Path(directory) / "assets" / "css"])
    rc = cli.run_static(args)
    out = capsys.readouterr().out
    assert rc == 0
    assert "Done:" in out


def test_run_static_skip_fetch(monkeypatch, tmp_path):
    args = _build_fetch_like_args(tmp_path)
    args.output_dir = str(tmp_path / "site")
    args.output_json = None
    args.skip_fetch = True
    args.skip_render = False
    monkeypatch.setattr("src.cli.load_payload", lambda mode, source: {"reports": [], "loaded": source, "mode": mode})
    monkeypatch.setattr("src.cli.render_html", lambda path, payload, **kwargs: Path(path))
    monkeypatch.setattr("src.cli.render_hourly_pages", lambda *args, **kwargs: [])
    monkeypatch.setattr("src.cli._copy_static_assets", lambda directory: [Path(directory) / "assets" / "css"])
    rc = cli.run_static(args)
    assert rc == 0


def test_run_static_skip_render(monkeypatch, tmp_path):
    args = _build_fetch_like_args(tmp_path)
    args.output_dir = str(tmp_path / "site")
    args.output_json = None
    args.skip_fetch = False
    args.skip_render = True
    monkeypatch.setattr("src.cli._fetch_payload", lambda a: {"reports": []})
    monkeypatch.setattr("src.cli.write_payload_json", lambda path, payload: Path(path))
    monkeypatch.setattr("src.cli._copy_static_assets", lambda directory: [Path(directory) / "assets" / "css"])
    rc = cli.run_static(args)
    assert rc == 0


def test_run_static_uses_output_dir_for_json_and_html(monkeypatch, tmp_path):
    args = _build_fetch_like_args(tmp_path)
    args.output_dir = str(tmp_path / "site")
    args.output_json = None
    args.skip_fetch = False
    args.skip_render = False
    captured = {}

    def fake_write_payload_json(path, payload):  # noqa: ANN001
        captured["json"] = path
        return Path(path)

    def fake_render_html(path, payload, **kwargs):  # noqa: ANN001
        captured["html"] = path
        return Path(path)

    monkeypatch.setattr("src.cli._fetch_payload", lambda a: {"reports": []})
    monkeypatch.setattr("src.cli.write_payload_json", fake_write_payload_json)
    monkeypatch.setattr("src.cli.render_html", fake_render_html)
    monkeypatch.setattr("src.cli.render_hourly_pages", lambda *args, **kwargs: [])
    monkeypatch.setattr("src.cli._copy_static_assets", lambda directory: [Path(directory) / "assets" / "css"])
    cli.run_static(args)
    assert captured["json"] == str(tmp_path / "site" / "data.json")
    assert captured["html"] == str(tmp_path / "site" / "index.html")


def test_run_static_server_boot_path(monkeypatch, tmp_path, capsys):
    calls = {"closed": False, "served": False}
    captured = {}

    class DummyServer:
        def __init__(self, addr, handler):  # noqa: ANN001
            assert addr == ("127.0.0.1", 8011)
            assert callable(handler)

        def serve_forever(self):
            calls["served"] = True
            raise KeyboardInterrupt

        def server_close(self):
            calls["closed"] = True

    def fake_run_static(run_args):  # noqa: ANN001
        captured["output_dir"] = run_args.output_dir
        captured["skip_fetch"] = run_args.skip_fetch
        captured["skip_render"] = run_args.skip_render
        output_html = Path(run_args.output_dir) / "index.html"
        output_json = Path(run_args.output_dir) / "data.json"
        output_html.parent.mkdir(parents=True, exist_ok=True)
        output_html.write_text("<!doctype html>", encoding="utf-8")
        output_json.write_text("{}", encoding="utf-8")

    args = argparse.Namespace(
        host="127.0.0.1",
        port=8011,
        directory=str(tmp_path),
        resort=[],
        resorts_file="resorts.yml",
        include_all_resorts=False,
        cache_file=".cache/open_meteo_cache.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=8,
        skip_fetch=False,
        skip_render=False,
        output_dir=None,
        output_json=None,
    )
    monkeypatch.setattr("src.cli.run_static", fake_run_static)
    monkeypatch.setattr("src.cli.ThreadingHTTPServer", DummyServer)
    rc = cli.run_static_server(args)
    out = capsys.readouterr().out
    assert rc == 0
    assert captured["output_dir"] == str(tmp_path)
    assert captured["skip_fetch"] is False
    assert captured["skip_render"] is False
    assert calls["served"] is True
    assert calls["closed"] is True
    assert "Serving static site" in out
    assert "Static payload:" in out
    assert str(tmp_path.resolve()) in out


def test_run_static_server_propagates_missing_directory_when_static_skips_render(monkeypatch, tmp_path):
    args = argparse.Namespace(
        host="127.0.0.1",
        port=8011,
        directory=str(tmp_path / "missing"),
        resort=[],
        resorts_file="resorts.yml",
        include_all_resorts=False,
        cache_file=".cache/open_meteo_cache.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=8,
        skip_fetch=True,
        skip_render=True,
        output_dir=None,
        output_json=None,
    )
    monkeypatch.setattr("src.cli.run_static", lambda run_args: 0)
    with pytest.raises(FileNotFoundError, match="Static directory does not exist"):
        cli.run_static_server(args)


def test_copy_static_assets_copies_css_and_js(tmp_path):
    assets_root = tmp_path / "repo"
    (assets_root / "assets" / "css").mkdir(parents=True)
    (assets_root / "assets" / "js").mkdir(parents=True)
    (assets_root / "assets" / "css" / "weather_page.css").write_text("body{}", encoding="utf-8")
    (assets_root / "assets" / "js" / "weather_page.js").write_text("console.log('x')", encoding="utf-8")
    output_dir = assets_root / "site"
    output_dir.mkdir()

    cwd = Path.cwd()
    try:
        os.chdir(assets_root)
        copied = cli._copy_static_assets(str(output_dir))
    finally:
        os.chdir(cwd)

    assert copied == [output_dir / "assets" / "css", output_dir / "assets" / "js"]
    assert (output_dir / "assets" / "css" / "weather_page.css").read_text(encoding="utf-8") == "body{}"
    assert (output_dir / "assets" / "js" / "weather_page.js").read_text(encoding="utf-8") == "console.log('x')"


def test_run_render_uses_input_parent_when_output_dir_missing(monkeypatch, tmp_path):
    input_json = tmp_path / "site" / "data.json"
    input_json.parent.mkdir(parents=True)
    input_json.write_text("{}", encoding="utf-8")
    captured = {}

    def fake_render_html(path, payload, **kwargs):  # noqa: ANN001
        captured["html"] = path
        return Path(path)

    monkeypatch.setattr("src.cli.load_payload", lambda mode, source: {"reports": []})
    monkeypatch.setattr("src.cli.render_html", fake_render_html)
    monkeypatch.setattr("src.cli.render_hourly_pages", lambda *args, **kwargs: [])
    monkeypatch.setattr("src.cli._copy_static_assets", lambda directory: [Path(directory) / "assets" / "css"])

    cli.run_render(argparse.Namespace(input_json=str(input_json), output_dir=None))
    assert captured["html"] == str(input_json.parent / "index.html")


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


def test_main_dispatches_serve_static(monkeypatch):
    monkeypatch.setattr(
        "src.cli.build_parser",
        lambda: type("P", (), {"parse_args": staticmethod(lambda: argparse.Namespace(command="serve-static"))})(),
    )
    monkeypatch.setattr("src.cli.run_static_server", lambda args: 8)
    assert cli.main() == 8


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
