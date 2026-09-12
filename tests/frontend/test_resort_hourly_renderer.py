from __future__ import annotations

import json
from html.parser import HTMLParser

import pytest
from src.web.pipelines.static_site import render_hourly_pages
from src.web.resort_hourly_renderer import render_hourly_page_html
from src.web.weather_page_server import _render_hourly_page_html


class _ScriptParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.scripts: list[str] = []
        self.in_script = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "script":
            self.in_script = True
            self.scripts.append("")

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self.in_script = False

    def handle_data(self, data: str) -> None:
        if self.in_script:
            self.scripts[-1] += data


def _context_from_parsed_html(html: str) -> dict:
    parser = _ScriptParser()
    parser.feed(html)
    assignment = "window.CLOSESNOW_HOURLY_CONTEXT = "
    scripts = [script for script in parser.scripts if assignment in script]
    assert len(scripts) == 1
    return json.loads(scripts[0].split(assignment, 1)[1].strip().removesuffix(";"))


@pytest.mark.parametrize("mode", ["static", "dynamic"])
@pytest.mark.parametrize(
    "display_name",
    [
        '</script><script>window.unexpected = "executed";</script>',
        "雪山 </ScRiPt><p>Mountain & valley</p>",
        "<!--<script>Snow report</script>",
    ],
)
def test_hourly_page_keeps_metadata_inside_bootstrap_script(tmp_path, mode, display_name):
    daily_summary = {"query": "Snowbird, UT", "display_name": display_name, "daily": []}
    if mode == "static":
        payload = {"reports": [{"resort_id": "snowbird-ut", **daily_summary}]}
        paths = render_hourly_pages(str(tmp_path / "index.html"), payload)
        html = paths[0].read_text(encoding="utf-8")
    else:
        html = _render_hourly_page_html("snowbird-ut", daily_summary)

    context = _context_from_parsed_html(html)

    assert context["resortId"] == "snowbird-ut"
    assert context["dailySummary"]["display_name"] == display_name
    assert "hourlyDataUrl" not in context


def test_hourly_renderer_preserves_static_paths_and_data_source():
    html = render_hourly_page_html(
        "snowbird-ut",
        asset_prefix="../../assets",
        back_href="../../",
        hourly_data_url="./hourly.json",
    )

    assert 'src="../../assets/js/resort_hourly.js"' in html
    assert 'href="../../"' in html
    assert _context_from_parsed_html(html) == {"resortId": "snowbird-ut", "hourlyDataUrl": "./hourly.json"}
