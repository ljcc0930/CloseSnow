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
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
from typing import Any, Dict, List
import urllib.error
import urllib.request
from urllib.parse import parse_qs, urlencode, urlparse, urlsplit, urlunsplit

if str(Path(__file__).resolve().parents[2]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.web.data_sources import load_payload
from src.web.resort_hourly_context import build_resort_daily_summary_context
from src.web.weather_page_assets import ASSET_MIME_TYPES, read_asset_bytes
from src.web.weather_page_render_core import render_payload_html
from src.backend.pipelines.live_pipeline import run_live_payload
from src.backend.resort_catalog import load_resort_catalog
from src.backend.weather_data_server import (
    _available_filters,
    _default_applied_filters,
    _empty_payload,
    _hourly_payload_for_resort,
    _supported_catalog,
    select_resorts_from_query,
)
from src.shared.config import DEFAULT_RESORTS_FILE

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


def _append_query_values(base_url: str, qs: Dict[str, List[str]]) -> str:
    if not qs:
        return base_url
    parsed = urlsplit(base_url)
    merged = parse_qs(parsed.query, keep_blank_values=True)
    for key, values in qs.items():
        merged[key] = list(values)
    query = urlencode(merged, doseq=True)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, parsed.fragment))


def _hourly_endpoint_from_data_source(base_url: str) -> str:
    parsed = urlsplit(base_url)
    return urlunsplit((parsed.scheme, parsed.netloc, "/api/resort-hourly", "", ""))


_SERVER_FILTER_QUERY_KEYS = ("pass_type", "region", "country", "search", "include_all", "include_default", "search_all")


def _qs_without_server_filters(qs: Dict[str, List[str]]) -> Dict[str, List[str]]:
    return {key: list(values) for key, values in qs.items() if key not in _SERVER_FILTER_QUERY_KEYS}


def make_handler(
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
    max_workers: int,
    data_mode: str = "local",
    data_source: str = "",
    data_timeout: int = 20,
) -> type[BaseHTTPRequestHandler]:
    if data_mode not in {"local", "api", "file"}:
        raise ValueError(f"Unsupported data mode: {data_mode}")
    if data_mode in {"api", "file"} and not data_source:
        raise ValueError("--data-source is required when --data-mode is api or file")

    class Handler(BaseHTTPRequestHandler):
        def _write(self, code: int, body: bytes, content_type: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _load_request_payload(self, qs: Dict[str, List[str]], *, apply_server_filters: bool = True) -> Dict[str, Any]:
            resorts = [x.strip() for x in qs.get("resort", []) if x.strip()]
            has_server_side_filters = any(
                qs.get(key)
                for key in _SERVER_FILTER_QUERY_KEYS
            )

            if data_mode == "local" and apply_server_filters and has_server_side_filters:
                selected, resorts_file, applied, available, no_match = select_resorts_from_query(qs)
                if no_match:
                    payload = _empty_payload(
                        cache_file=cache_file,
                        geocode_cache_hours=geocode_cache_hours,
                        forecast_cache_hours=forecast_cache_hours,
                    )
                else:
                    payload = run_live_payload(
                        resorts=selected,
                        resorts_file=resorts_file,
                        cache_file=cache_file,
                        geocode_cache_hours=geocode_cache_hours,
                        forecast_cache_hours=forecast_cache_hours,
                        max_workers=max_workers,
                    )
                payload["available_filters"] = available
                payload["applied_filters"] = applied
                return payload

            source = data_source
            if data_mode == "api":
                source = _append_query_values(data_source, qs)

            payload = load_payload(
                mode=data_mode,
                source=source,
                timeout=data_timeout,
                resorts=resorts,
                cache_file=cache_file,
                geocode_cache_hours=geocode_cache_hours,
                forecast_cache_hours=forecast_cache_hours,
                max_workers=max_workers,
            )
            if "available_filters" not in payload:
                try:
                    catalog = _supported_catalog(load_resort_catalog(DEFAULT_RESORTS_FILE))
                    payload["available_filters"] = _available_filters(catalog)
                except Exception:
                    payload["available_filters"] = {"pass_type": {}, "region": {}, "country": {}}
            if "applied_filters" not in payload:
                payload["applied_filters"] = _default_applied_filters()
            return payload

        def _load_hourly_payload(self, resort_id: str, hours: int) -> tuple[int, Dict[str, Any]]:
            if data_mode == "local":
                payload = _hourly_payload_for_resort(
                    resort_id=resort_id,
                    hours=hours,
                    cache_file=cache_file,
                    geocode_cache_hours=geocode_cache_hours,
                    forecast_cache_hours=forecast_cache_hours,
                )
                if payload is None:
                    return 404, {"error": f"Unknown resort_id: {resort_id}"}
                if "error" in payload:
                    return 502, payload
                return 200, payload

            if data_mode == "api":
                hourly_base = _hourly_endpoint_from_data_source(data_source)
                hourly_url = f"{hourly_base}?{urlencode({'resort_id': resort_id, 'hours': str(hours)})}"
                try:
                    with urllib.request.urlopen(hourly_url, timeout=data_timeout) as resp:
                        body = resp.read().decode("utf-8")
                        return 200, json.loads(body)
                except urllib.error.HTTPError as exc:
                    error_body = exc.read().decode("utf-8", errors="ignore")
                    try:
                        payload = json.loads(error_body)
                    except Exception:
                        payload = {"error": error_body or f"HTTP {exc.code}"}
                    return exc.code, payload
                except urllib.error.URLError as exc:
                    return 502, {"error": str(exc)}
                except Exception as exc:
                    return 500, {"error": str(exc)}

            return 501, {"error": "Hourly endpoint unavailable in file mode"}

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            normalized_path = _normalize_known_path(parsed.path)

            asset_name = _asset_name_from_path(parsed.path)
            if asset_name in ASSET_MIME_TYPES:
                try:
                    body = read_asset_bytes(asset_name)
                except OSError:
                    self._write(404, b"Not Found", "text/plain; charset=utf-8")
                    return
                self._write(200, body, ASSET_MIME_TYPES[asset_name])
                return

            if normalized_path == "/api/health":
                body = json.dumps({"ok": True, "mode": data_mode}, ensure_ascii=False, indent=2).encode("utf-8")
                self._write(200, body, "application/json; charset=utf-8")
                return

            if normalized_path == "/api/resort-hourly":
                resort_id = (qs.get("resort_id", [""])[0] or "").strip()
                if not resort_id:
                    self._write(400, b"{\"error\":\"Missing required query parameter: resort_id\"}", "application/json")
                    return
                try:
                    hours = max(1, min(240, int((qs.get("hours", ["72"])[0] or "72"))))
                except ValueError:
                    hours = 72
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

            page_qs = _qs_without_server_filters(qs)
            payload = self._load_request_payload(page_qs, apply_server_filters=False)
            html = render_payload_html(payload, data_url="./api/data")
            self._write(200, html.encode("utf-8"), "text/html; charset=utf-8")

    return Handler


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Serve dynamic ski weather page.")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8010)
    p.add_argument("--data-mode", choices=["local", "api", "file"], default="local")
    p.add_argument("--data-source", default="")
    p.add_argument("--data-timeout", type=int, default=20)
    p.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p.add_argument("--forecast-cache-hours", type=int, default=3)
    p.add_argument("--max-workers", type=int, default=8)
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
