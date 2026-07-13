#!/usr/bin/env python3
"""
Dynamic weather page server.

Modes:
1. local (default): resolves payload through communication local adapter.
2. api: fetches contract payload from remote API endpoint.
3. file: loads payload contract from local JSON artifact.
"""

from __future__ import annotations

import argparse
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import parse_qs, urlparse

if str(Path(__file__).resolve().parents[2]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.backend.constants import API_RETRY_TIMES, DEFAULT_PAYLOAD_CACHE_TTL_SECONDS
from src.backend.services.hourly_options import parse_hour_count
from src.backend.services.payload_memory_cache import PayloadMemoryCache, frozen_query_params
from src.contract import WeatherPayloadV1
from src.shared.cli_options import add_cache_runtime_options, add_server_bind_options
from src.web.asset_manifest import asset_for_path, read_asset_bytes
from src.web.data_sources import load_hourly_payload, load_request_payload, strip_server_filter_query
from src.web.resort_hourly_context import build_resort_daily_summary_context
from src.web.weather_page_render_core import render_payload_html

_HOURLY_TEMPLATE = (Path(__file__).resolve().parent / "templates" / "resort_hourly_page.html").read_text(
    encoding="utf-8"
)


def _render_hourly_page_html(resort_id: str, daily_summary: Dict[str, Any] | None = None) -> str:
    hourly_context: Dict[str, Any] = {"resortId": resort_id}
    if daily_summary:
        hourly_context["dailySummary"] = daily_summary
    hourly_context_json = json.dumps(hourly_context, ensure_ascii=False)
    return (
        _HOURLY_TEMPLATE.replace("{{asset_prefix}}", "../assets")
        .replace("{{back_href}}", "../")
        .replace("{{resort_id}}", resort_id)
        .replace("{{hourly_context_json}}", hourly_context_json)
    )


def _normalize_known_path(path: str) -> str:
    if path in {"", "/"}:
        return "/"
    for marker in ("/api/health", "/api/data", "/api/resort-hourly", "/resort/"):
        idx = path.find(marker)
        if idx >= 0:
            return path[idx:]
    return path


def _asset_name_from_path(path: str) -> str:
    if path.startswith("/assets/"):
        return path.lstrip("/")
    marker = "/assets/"
    idx = path.find(marker)
    if idx >= 0:
        return path[idx + 1 :]
    return path.lstrip("/")


def make_handler(
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
    max_workers: int,
    data_mode: str = "local",
    data_source: str = "",
    data_timeout: int = 20,
    api_retries: int = API_RETRY_TIMES,
    payload_cache_ttl_seconds: int = DEFAULT_PAYLOAD_CACHE_TTL_SECONDS,
) -> type[BaseHTTPRequestHandler]:
    if data_mode not in {"local", "api", "file"}:
        raise ValueError(f"Unsupported data mode: {data_mode}")
    if data_mode in {"api", "file"} and not data_source:
        raise ValueError("--data-source is required when --data-mode is api or file")
    payload_cache = PayloadMemoryCache(payload_cache_ttl_seconds)

    class Handler(BaseHTTPRequestHandler):
        def _write(self, code: int, body: bytes, content_type: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _load_request_payload(
            self, qs: Dict[str, List[str]], *, apply_server_filters: bool = True
        ) -> WeatherPayloadV1:
            def load() -> WeatherPayloadV1:
                return load_request_payload(
                    mode=data_mode,
                    source=data_source,
                    query_params=qs,
                    apply_server_filters=apply_server_filters,
                    timeout=data_timeout,
                    cache_file=cache_file,
                    geocode_cache_hours=geocode_cache_hours,
                    forecast_cache_hours=forecast_cache_hours,
                    max_workers=max_workers,
                    api_retries=api_retries,
                )

            if data_mode != "local":
                return load()

            return payload_cache.get_or_load(
                (
                    frozen_query_params(qs),
                    apply_server_filters,
                    cache_file,
                    geocode_cache_hours,
                    forecast_cache_hours,
                    max_workers,
                    api_retries,
                ),
                load,
            )

        def _load_hourly_payload(self, resort_id: str, hours: int) -> tuple[int, Dict[str, Any]]:
            return load_hourly_payload(
                mode=data_mode,
                source=data_source,
                resort_id=resort_id,
                hours=hours,
                timeout=data_timeout,
                cache_file=cache_file,
                geocode_cache_hours=geocode_cache_hours,
                forecast_cache_hours=forecast_cache_hours,
                api_retries=api_retries,
            )

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            normalized_path = _normalize_known_path(parsed.path)

            asset_name = _asset_name_from_path(parsed.path)
            asset = asset_for_path(asset_name)
            if asset is not None:
                try:
                    body = read_asset_bytes(asset.repository_path)
                except OSError:
                    self._write(404, b"Not Found", "text/plain; charset=utf-8")
                    return
                self._write(200, body, asset.mime_type)
                return

            if normalized_path == "/api/health":
                body = json.dumps({"ok": True, "mode": data_mode}, ensure_ascii=False, indent=2).encode("utf-8")
                self._write(200, body, "application/json; charset=utf-8")
                return

            if normalized_path == "/api/resort-hourly":
                resort_id = (qs.get("resort_id", [""])[0] or "").strip()
                if not resort_id:
                    self._write(400, b'{"error":"Missing required query parameter: resort_id"}', "application/json")
                    return
                hours = parse_hour_count(qs.get("hours", [""])[0])
                code, payload = self._load_hourly_payload(resort_id, hours)
                body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
                self._write(code, body, "application/json; charset=utf-8")
                return

            if normalized_path.startswith("/resort/"):
                resort_id = normalized_path.split("/resort/", 1)[1].strip()
                if not resort_id:
                    self._write(404, b"Not Found", "text/plain; charset=utf-8")
                    return
                daily_summary = None
                try:
                    page_payload = self._load_request_payload({}, apply_server_filters=False)
                    daily_summary = build_resort_daily_summary_context(page_payload, resort_id)
                except Exception:
                    daily_summary = None
                html = _render_hourly_page_html(resort_id, daily_summary)
                self._write(200, html.encode("utf-8"), "text/html; charset=utf-8")
                return

            if normalized_path == "/api/data":
                payload = self._load_request_payload(qs, apply_server_filters=True)
                body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
                self._write(200, body, "application/json; charset=utf-8")
                return

            page_qs = strip_server_filter_query(qs)
            payload = self._load_request_payload(page_qs, apply_server_filters=False)
            html = render_payload_html(payload, data_url="./api/data")
            self._write(200, html.encode("utf-8"), "text/html; charset=utf-8")

    return Handler


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Serve dynamic ski weather page.")
    add_server_bind_options(p, default_port=8010)
    p.add_argument("--data-mode", choices=["local", "api", "file"], default="local")
    p.add_argument("--data-source", default="")
    p.add_argument("--data-timeout", type=int, default=20)
    add_cache_runtime_options(p)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    handler = make_handler(
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
        data_mode=args.data_mode,
        data_source=args.data_source,
        data_timeout=args.data_timeout,
        api_retries=args.api_retries,
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving dynamic page at http://{args.host}:{args.port}")
    print(f"Data mode: {args.data_mode}")
    if args.data_mode in {"api", "file"}:
        print(f"Data source: {args.data_source}")
    print("Open / for page, /resort/<id> for hourly page, /api/data, /api/resort-hourly, /api/health.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
