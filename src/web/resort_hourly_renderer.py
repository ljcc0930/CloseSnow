from __future__ import annotations

import json
from html import escape
from pathlib import Path
from typing import Any, Mapping

_HOURLY_TEMPLATE = (Path(__file__).resolve().parent / "templates" / "resort_hourly_page.html").read_text(
    encoding="utf-8"
)


def render_hourly_page_html(
    resort_id: str,
    daily_summary: Mapping[str, Any] | None = None,
    *,
    asset_prefix: str,
    back_href: str,
    hourly_data_url: str | None = None,
) -> str:
    """Render the shared hourly shell with paths supplied by its delivery mode."""
    context: dict[str, Any] = {"resortId": resort_id}
    if daily_summary:
        context["dailySummary"] = dict(daily_summary)
    if hourly_data_url is not None:
        context["hourlyDataUrl"] = hourly_data_url

    # A script element is parsed as HTML before JavaScript; JSON quotes alone
    # cannot stop metadata from closing it or changing its parsing state.
    context_json = json.dumps(context, ensure_ascii=False).replace("<", "\\u003c")
    return (
        _HOURLY_TEMPLATE.replace("{{asset_prefix}}", escape(asset_prefix, quote=True))
        .replace("{{back_href}}", escape(back_href, quote=True))
        .replace("{{resort_id}}", escape(resort_id, quote=True))
        .replace("{{hourly_context_json}}", context_json)
    )
