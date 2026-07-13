from __future__ import annotations

import argparse
from pathlib import Path
from types import SimpleNamespace

from src.backend import ecmwf_unified_backend, weather_data_server
from src.web import weather_page_static_render


def test_backend_entrypoint_main(monkeypatch, capsys):
    args = argparse.Namespace(
        resort=["A"],
        resorts_file="resorts.yml",
        use_default_resorts=False,
        output_json="o.json",
        snow_csv="s.csv",
        rain_csv="r.csv",
        temp_csv="t.csv",
        cache_file=".cache/a.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=8,
        api_retries=2,
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
        resorts_file="resorts.yml",
        cache_file=".cache/a.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=8,
        api_retries=2,
        output_dir="site",
    )
    captured = {}

    monkeypatch.setattr("src.web.weather_page_static_render.parse_args", lambda: args)

    def fake_build_static_site(request):  # noqa: ANN001
        captured["request"] = request
        return SimpleNamespace(
            render_result=SimpleNamespace(
                index_html=Path("site/index.html"),
                hourly_page_paths=(Path("site/resort/snowbird-ut/index.html"),),
            )
        )

    monkeypatch.setattr("src.web.weather_page_static_render.build_static_site", fake_build_static_site)
    rc = weather_page_static_render.main()
    out = capsys.readouterr().out
    assert rc == 0
    payload_request = captured["request"].fetch.payload_request
    assert payload_request.resorts == ("A",)
    assert payload_request.resorts_file == ""
    assert payload_request.runtime.max_workers == 8
    assert captured["request"].render.input_json == "site/data.json"
    assert "Done: site/index.html" in out


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
        api_retries=2,
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
