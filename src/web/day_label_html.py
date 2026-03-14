#!/usr/bin/env python3
from __future__ import annotations

import html


def render_day_label_html(label: str) -> str:
    text = (label or "").strip()
    if not text:
        return ""
    if text.lower() == "today":
        text = "Today"

    parts = text.split(None, 1)
    if len(parts) == 2 and "-" in parts[0]:
        date_part, weekday_part = parts
        return (
            f"<span class='day-label-date'>{html.escape(date_part)}</span>"
            f"<span class='day-label-weekday'>{html.escape(weekday_part)}</span>"
        )

    return html.escape(text)
