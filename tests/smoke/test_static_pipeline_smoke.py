from __future__ import annotations

import argparse
from pathlib import Path

import pytest

from src import cli


@pytest.mark.smoke
def test_static_split_pipeline_smoke(monkeypatch, tmp_path, valid_payload):
    fetch_args = argparse.Namespace(
        resort=[],
        resorts_file="resorts.txt",
        cache_file=".cache/open_meteo_cache.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=4,
        output_json=str(tmp_path / "data.json"),
    )
    monkeypatch.setattr("src.cli.fetch_static_payload", lambda **kwargs: valid_payload)

    assert cli.run_fetch(fetch_args) == 0
    assert Path(fetch_args.output_json).exists()

    render_args = argparse.Namespace(
        input_json=fetch_args.output_json,
        output_html=str(tmp_path / "index.html"),
    )
    assert cli.run_render(render_args) == 0

    html = Path(render_args.output_html).read_text(encoding="utf-8")
    assert "<!doctype html>" in html
    assert "Snowfall" in html
    assert "Rainfall" in html
    assert "Temperature" in html
