from __future__ import annotations

import json

from src.web.pipelines.static_site import render_hourly_pages, render_html, write_payload_json


def test_write_payload_json(tmp_path):
    p = tmp_path / "site" / "data.json"
    out = write_payload_json(str(p), {"a": 1})
    assert out == p
    assert json.loads(p.read_text(encoding="utf-8")) == {"a": 1}


def test_render_html(tmp_path, monkeypatch):
    p = tmp_path / "site" / "index.html"
    monkeypatch.setattr("src.web.pipelines.static_site.render_payload_html", lambda payload: "<html>x</html>")
    out = render_html(str(p), {"a": 1})
    assert out == p
    assert p.read_text(encoding="utf-8") == "<html>x</html>"


def test_render_hourly_pages(tmp_path):
    p = tmp_path / "site" / "index.html"
    payload = {
        "reports": [
            {"resort_id": "snowbird-ut"},
            {"resort_id": "snowbird-ut"},
            {"resort_id": "alta-ut"},
        ]
    }
    outputs = render_hourly_pages(str(p), payload)
    assert [x.relative_to(tmp_path / "site").as_posix() for x in outputs] == [
        "resort/snowbird-ut/index.html",
        "resort/alta-ut/index.html",
    ]
    html = outputs[0].read_text(encoding="utf-8")
    assert "../../assets/css/resort_hourly.css" in html
    assert 'window.CLOSESNOW_HOURLY_CONTEXT = {' in html
    assert 'resortId: "snowbird-ut"' in html
