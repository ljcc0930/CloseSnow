from __future__ import annotations

import json

from src.web.pipelines.static_site import render_html, write_payload_json


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
