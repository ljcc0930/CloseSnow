from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

from src.web.weather_page_render_core import render_payload_html


def write_payload_json(path: str, payload: Dict[str, Any]) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


def render_html(path: str, payload: Dict[str, Any]) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_payload_html(payload), encoding="utf-8")
    return out
