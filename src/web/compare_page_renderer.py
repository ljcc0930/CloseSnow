from __future__ import annotations

import json
from pathlib import Path

from src.web.compare_selection_contract import COMPARE_SELECTION_BOOTSTRAP

_COMPARE_TEMPLATE = (
    Path(__file__).resolve().parent / "templates" / "resort_compare_page.html"
).read_text(encoding="utf-8")


def render_compare_html(
    *,
    asset_prefix: str,
    home_href: str,
    data_url: str,
) -> str:
    compare_context_json = json.dumps(
        {
            "dataUrl": data_url,
            "compareSelection": COMPARE_SELECTION_BOOTSTRAP,
        },
        ensure_ascii=False,
    )
    return (
        _COMPARE_TEMPLATE.replace("{{asset_prefix}}", asset_prefix)
        .replace("{{home_href}}", home_href)
        .replace("{{compare_context_json}}", compare_context_json)
    )
