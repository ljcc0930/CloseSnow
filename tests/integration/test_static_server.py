from __future__ import annotations

import argparse
import threading
import urllib.request
from pathlib import Path

import pytest
from src import cli
from src.web.asset_manifest import WEB_ASSET_MANIFEST
from src.web.static_assets import copy_static_assets
from src.web.static_site_validator import main as validate_static_site_main
from src.web.static_site_validator import validate_static_site


def _start_static_server(site_dir: Path):
    args = argparse.Namespace(host="127.0.0.1", port=0, directory=str(site_dir))
    handler = cli.partial(cli.SimpleHTTPRequestHandler, directory=str(site_dir.resolve()))
    server = cli.ThreadingHTTPServer((args.host, args.port), handler)
    host, port = server.server_address
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread, f"http://{host}:{port}"


def _write_valid_pages_site(site_dir: Path) -> None:
    resort_dir = site_dir / "resort" / "snowbird-ut"
    resort_dir.mkdir(parents=True)
    (site_dir / "index.html").write_text("<!doctype html><title>CloseSnow</title>", encoding="utf-8")
    (site_dir / "data.json").write_text('{"ok":true}', encoding="utf-8")
    (site_dir / ".nojekyll").touch()
    (resort_dir / "index.html").write_text("<!doctype html><title>Snowbird</title>", encoding="utf-8")
    (resort_dir / "hourly.json").write_text('{"hours":0,"hourly":{}}', encoding="utf-8")
    copy_static_assets(str(site_dir))


def test_static_site_validator_accepts_complete_pages_artifact(tmp_path, capsys):
    site_dir = tmp_path / "site"
    _write_valid_pages_site(site_dir)

    assert validate_static_site(site_dir, require_pages_artifacts=True) == ()
    assert validate_static_site_main(["--site-dir", str(site_dir), "--require-pages-artifacts"]) == 0
    assert "Static site validation passed" in capsys.readouterr().out


@pytest.mark.parametrize("asset", WEB_ASSET_MANIFEST, ids=lambda asset: asset.repository_path)
def test_static_site_validator_detects_each_missing_manifest_asset(tmp_path, asset):
    site_dir = tmp_path / "site"
    _write_valid_pages_site(site_dir)
    missing_path = site_dir / asset.repository_path
    missing_path.unlink()

    issues = validate_static_site(site_dir, require_pages_artifacts=True)

    assert any(issue.path == missing_path and "missing manifest asset" in issue.message for issue in issues)


def test_static_site_validator_reports_actionable_required_entry_paths(tmp_path, capsys):
    site_dir = tmp_path / "site"
    site_dir.mkdir()

    issues = validate_static_site(site_dir, require_pages_artifacts=True)
    rendered = {issue.render() for issue in issues}

    assert any(str(site_dir / "index.html") in issue for issue in rendered)
    assert any(str(site_dir / "data.json") in issue for issue in rendered)
    assert any(str(site_dir / ".nojekyll") in issue for issue in rendered)
    assert any(str(site_dir / "resort/*/index.html") in issue for issue in rendered)
    assert any(str(site_dir / "resort/*/hourly.json") in issue for issue in rendered)
    assert validate_static_site_main(["--site-dir", str(site_dir), "--require-pages-artifacts"]) == 1
    assert str(site_dir / "index.html") in capsys.readouterr().err


def test_static_server_serves_site_and_resort_routes(tmp_path):
    site_dir = tmp_path / "site"
    resort_dir = site_dir / "resort" / "snowbird-ut"
    resort_dir.mkdir(parents=True)
    (site_dir / "index.html").write_text("<!doctype html><title>CloseSnow</title>", encoding="utf-8")
    (site_dir / "data.json").write_text('{"ok":true}', encoding="utf-8")
    (resort_dir / "index.html").write_text("<!doctype html><title>Snowbird</title>", encoding="utf-8")

    server, thread, base = _start_static_server(site_dir)
    try:
        root_html = urllib.request.urlopen(f"{base}/", timeout=3).read().decode("utf-8")
        assert "CloseSnow" in root_html

        data_json = urllib.request.urlopen(f"{base}/data.json", timeout=3).read().decode("utf-8")
        assert data_json == '{"ok":true}'

        resort_html = urllib.request.urlopen(f"{base}/resort/snowbird-ut/", timeout=3).read().decode("utf-8")
        assert "Snowbird" in resort_html
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)
