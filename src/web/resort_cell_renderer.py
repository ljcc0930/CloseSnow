#!/usr/bin/env python3
from __future__ import annotations

import html
from typing import Dict
from urllib.parse import quote


def default_resort_marker(row: Dict[str, str]) -> str:
    if bool(row.get("default_resort")):
        return "1"
    if bool(row.get("ljcc_favorite")):
        return "1"
    return ""


def filter_attrs(row: Dict[str, str]) -> str:
    pass_types = html.escape(row.get("filter_pass_types", ""), quote=True)
    region = html.escape(row.get("filter_region", ""), quote=True)
    country = html.escape(row.get("filter_country", ""), quote=True)
    state = html.escape(row.get("filter_state", ""), quote=True)
    default_resort = html.escape(default_resort_marker(row), quote=True)
    return (
        f" data-pass-types='{pass_types}' data-region='{region}' data-country='{country}'"
        f" data-state='{state}' data-default-resort='{default_resort}'"
    )


def query_cell_html(row: Dict[str, str]) -> str:
    query_text = html.escape(row.get("query", ""))
    resort_id = row.get("resort_id", "").strip()
    link_html = query_text
    if resort_id:
        href = f"resort/{quote(resort_id)}"
        link_html = f"<a class='resort-link' href='{href}'>{query_text}</a>"

    button_html = ""
    if resort_id:
        button_html = (
            f"<button type='button' class='favorite-btn' data-resort-id='{html.escape(resort_id, quote=True)}'"
            " data-favorite-active='0' aria-pressed='false' aria-label='Add resort to favorites'>"
            "<span aria-hidden='true'>♡</span>"
            "</button>"
        )

    return (
        "<td class='query-col'>"
        "<div class='resort-cell'>"
        f"{button_html}"
        f"<div class='resort-link-wrap'>{link_html}</div>"
        "</div>"
        "</td>"
    )
