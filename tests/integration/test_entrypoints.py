from __future__ import annotations

import argparse

from src.backend import ecmwf_unified_backend
from src.backend import weather_data_server
from src.web import weather_page_static_render


def test_backend_entrypoint_main(monkeypatch, capsys):
    args = argparse.Namespace(
        resort=["A"],
        resorts_file="resorts.txt",
        use_default_resorts=False,
        output_json="o.json",
        snow_csv="s.csv",
        rain_csv="r.csv",
        temp_csv="t.csv",
        cache_file=".cache/a.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=8,
    )
    monkeypatch.setattr("src.backend.ecmwf_unified_backend.parse_args", lambda: args)
    monkeypatch.setattr(
        "src.backend.ecmwf_unified_backend.run_pipeline",
        lambda **kwargs: {"cache": {"hits": 1, "misses": 2, "file": ".cache/x.json"}, "failed": []},
    )
    rc = ecmwf_unified_backend.main()
    out = capsys.readouterr().out
    assert rc == 0
    assert "Done. JSON: o.json" in out


def test_static_render_entrypoint_main(monkeypatch, capsys):
    args = argparse.Namespace(
        resort=["A", " "],
        resorts_file="resorts.txt",
        cache_file=".cache/a.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=8,
        output_html="index.html",
    )
    captured = {}

    def fake_fetch_static_payload(**kwargs):  # noqa: ANN001
        captured["kwargs"] = kwargs
        return {"reports": []}

    monkeypatch.setattr("src.web.weather_page_static_render.parse_args", lambda: args)
    monkeypatch.setattr("src.web.weather_page_static_render.fetch_static_payload", fake_fetch_static_payload)
    monkeypatch.setattr("src.web.weather_page_static_render.render_html", lambda path, payload: path)
    monkeypatch.setattr(
        "src.web.weather_page_static_render.render_hourly_pages",
        lambda path, payload: [f"{path}:resort/snowbird-ut/index.html"],
    )
    rc = weather_page_static_render.main()
    out = capsys.readouterr().out
    assert rc == 0
    assert captured["kwargs"]["resorts"] == ["A"]
    assert captured["kwargs"]["resorts_file"] == ""
    assert "Done: index.html" in out


def test_weather_data_server_entrypoint_main(monkeypatch, capsys):
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
    monkeypatch.setattr("src.backend.weather_data_server.parse_args", lambda: args)
    monkeypatch.setattr("src.backend.weather_data_server.make_handler", lambda **kwargs: "handler")
    monkeypatch.setattr("src.backend.weather_data_server.ThreadingHTTPServer", DummyServer)
    rc = weather_data_server.main()
    out = capsys.readouterr().out
    assert rc == 0
    assert calls["served"] is True
    assert calls["closed"] is True
    assert "Serving backend data API" in out
