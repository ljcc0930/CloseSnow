from __future__ import annotations

from src.web.weather_page_assets import ASSET_MIME_TYPES, asset_path, read_asset_bytes


def test_asset_path_points_to_repo_assets():
    css_path = asset_path("assets/css/weather_page.css")
    js_path = asset_path("assets/js/weather_page.js")
    assert str(css_path).endswith("assets/css/weather_page.css")
    assert str(js_path).endswith("assets/js/weather_page.js")


def test_read_asset_bytes_reads_known_assets():
    css = read_asset_bytes("assets/css/weather_page.css")
    js = read_asset_bytes("assets/js/weather_page.js")
    assert len(css) > 100
    assert len(js) > 100
    assert ASSET_MIME_TYPES["assets/css/weather_page.css"].startswith("text/css")
    assert ASSET_MIME_TYPES["assets/js/weather_page.js"].startswith("application/javascript")

