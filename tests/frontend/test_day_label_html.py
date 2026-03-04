from __future__ import annotations

from src.web.day_label_html import render_day_label_html


def test_render_day_label_html_splits_date_and_weekday():
    out = render_day_label_html("03-04 Wed")
    assert "day-label-date" in out
    assert "day-label-weekday" in out
    assert ">03-04<" in out
    assert ">Wed<" in out


def test_render_day_label_html_keeps_fallback_labels_single_line():
    assert render_day_label_html("today") == "today"
    assert render_day_label_html("day 2") == "day 2"
