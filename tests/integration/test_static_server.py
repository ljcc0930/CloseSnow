from __future__ import annotations

import argparse
import threading
import urllib.request
from pathlib import Path

from src import cli


def _start_static_server(site_dir: Path):
    args = argparse.Namespace(host="127.0.0.1", port=0, directory=str(site_dir))
    handler = cli.partial(cli.SimpleHTTPRequestHandler, directory=str(site_dir.resolve()))
    server = cli.ThreadingHTTPServer((args.host, args.port), handler)
    host, port = server.server_address
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread, f"http://{host}:{port}"


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
