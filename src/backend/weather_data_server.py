#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
from typing import Dict, List
from urllib.parse import parse_qs, urlparse

if str(Path(__file__).resolve().parents[2]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.backend.pipelines.live_pipeline import run_live_payload
from src.backend.services.hourly_payload_service import build_hourly_payload_for_resort
from src.backend.services.resort_selection_service import (
    apply_catalog_filters,
    available_filters,
    build_empty_payload,
    catalog_item_with_display_name,
    default_applied_filters,
    load_supported_resort_catalog,
    select_resorts_from_query,
    split_query_values,
    supported_catalog,
)
from src.shared.config import DEFAULT_RESORTS_FILE

def _append_common_headers(handler: BaseHTTPRequestHandler, allow_origin: str) -> None:
    handler.send_header("Access-Control-Allow-Origin", allow_origin)
    handler.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")


def _split_query_values(values: List[str], *, to_upper: bool = False) -> List[str]:
    return split_query_values(values, to_upper=to_upper)


def _supported_catalog(catalog: List[Dict[str, object]]) -> List[Dict[str, object]]:
    return supported_catalog(catalog)


def _catalog_item_with_display_name(item: Dict[str, object]) -> Dict[str, object]:
    return catalog_item_with_display_name(item)


def _available_filters(catalog: List[Dict[str, object]]) -> Dict[str, Dict[str, int]]:
    return available_filters(catalog)


def _apply_catalog_filters(
    catalog: List[Dict[str, object]],
    *,
    pass_types: List[str],
    region: str,
    subregions: List[str],
    countries: List[str],
    search: str,
) -> List[Dict[str, object]]:
    return apply_catalog_filters(
        catalog,
        pass_types=pass_types,
        region=region,
        subregions=subregions,
        countries=countries,
        search=search,
    )


def _empty_payload(cache_file: str, geocode_cache_hours: int, forecast_cache_hours: int) -> Dict[str, object]:
    return build_empty_payload(cache_file, geocode_cache_hours, forecast_cache_hours)


def _default_applied_filters() -> Dict[str, object]:
    return default_applied_filters()


def _hourly_payload_for_resort(
    *,
    resort_id: str,
    hours: int,
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
) -> Dict[str, object] | None:
    return build_hourly_payload_for_resort(
        resort_id=resort_id,
        hours=hours,
        cache_file=cache_file,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
    )


def _parse_hours(raw: str, default: int = 72) -> int:
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = default
    return max(1, min(240, value))


def make_handler(
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
    max_workers: int,
    allow_origin: str = "*",
) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def _write_json(self, code: int, payload: dict) -> None:
            body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
            self.send_response(code)
            _append_common_headers(self, allow_origin)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _selected_resorts(self, qs: dict) -> tuple[List[str], str, dict, dict, bool]:
            return select_resorts_from_query(qs)

        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_response(204)
            _append_common_headers(self, allow_origin)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            if parsed.path == "/api/health":
                self._write_json(
                    200,
                    {
                        "ok": True,
                        "service": "closesnow-backend-data",
                        "time_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                    },
                )
                return
            if parsed.path == "/api/resort-hourly":
                resort_id = (qs.get("resort_id", [""])[0] or "").strip()
                if not resort_id:
                    self._write_json(400, {"error": "Missing required query parameter: resort_id"})
                    return
                hours = _parse_hours((qs.get("hours", ["72"])[0] or "72"), default=72)
                try:
                    result = build_hourly_payload_for_resort(
                        resort_id=resort_id,
                        hours=hours,
                        cache_file=cache_file,
                        geocode_cache_hours=geocode_cache_hours,
                        forecast_cache_hours=forecast_cache_hours,
                    )
                except Exception as exc:
                    self._write_json(500, {"error": f"Failed to build hourly payload: {exc}"})
                    return
                if result is None:
                    self._write_json(404, {"error": f"Unknown resort_id: {resort_id}"})
                    return
                if "error" in result:
                    self._write_json(502, result)
                    return
                self._write_json(200, result)
                return
            if parsed.path == "/api/resorts":
                search_text = (qs.get("search", [""])[0] or "").strip()
                try:
                    catalog = load_supported_resort_catalog(DEFAULT_RESORTS_FILE)
                except Exception as exc:
                    self._write_json(500, {"error": f"Failed to load resort catalog: {exc}"})
                    return
                pass_types = _split_query_values(qs.get("pass_type", []))
                region = (qs.get("region", [""])[0] or "").strip().lower()
                subregions = _split_query_values(qs.get("subregion", []))
                countries = _split_query_values(qs.get("country", []), to_upper=True)
                items = _apply_catalog_filters(
                    catalog,
                    pass_types=pass_types,
                    region=region,
                    subregions=subregions,
                    countries=countries,
                    search=search_text,
                )
                self._write_json(
                    200,
                    {
                        "source_file": DEFAULT_RESORTS_FILE,
                        "search": search_text,
                        "applied_filters": {
                            "pass_type": pass_types,
                            "region": region,
                            "subregion": subregions,
                            "country": countries,
                            "search_all": True,
                            "include_default": False,
                            "include_all": False,
                        },
                        "available_filters": _available_filters(catalog),
                        "count": len(items),
                        "items": [_catalog_item_with_display_name(item) for item in items],
                    },
                )
                return
            if parsed.path != "/api/data":
                self._write_json(404, {"error": "Not Found"})
                return

            resorts, resorts_file, applied_filters, available_filters, no_match = self._selected_resorts(qs)
            if no_match:
                payload = _empty_payload(
                    cache_file=cache_file,
                    geocode_cache_hours=geocode_cache_hours,
                    forecast_cache_hours=forecast_cache_hours,
                )
            else:
                payload = run_live_payload(
                    resorts=resorts,
                    resorts_file=resorts_file,
                    cache_file=cache_file,
                    geocode_cache_hours=geocode_cache_hours,
                    forecast_cache_hours=forecast_cache_hours,
                    max_workers=max_workers,
                )
            payload["available_filters"] = available_filters
            payload["applied_filters"] = applied_filters
            self._write_json(200, payload)

    return Handler


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Serve backend weather payload API.")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8020)
    p.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p.add_argument("--forecast-cache-hours", type=int, default=3)
    p.add_argument("--max-workers", type=int, default=8)
    p.add_argument("--allow-origin", default="*")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    handler = make_handler(
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        max_workers=args.max_workers,
        allow_origin=args.allow_origin,
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving backend data API at http://{args.host}:{args.port}")
    print("Open /api/data, /api/resorts, /api/resort-hourly, and /api/health.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
