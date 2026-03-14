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

from src.backend.cache import JsonCache, ResortCoordinateCache, dated_cache_path
from src.backend.constants import COORDINATES_CACHE_FILE
from src.backend.compute.payload_metadata import build_payload_metadata
from src.backend.open_meteo import fetch_hourly_forecast, geocode
from src.backend.pipelines.live_pipeline import run_live_payload
from src.backend.resort_catalog import load_resort_catalog, search_resort_catalog
from src.shared.config import DEFAULT_RESORTS_FILE

_SUPPORTED_PASS_TYPES = {"epic", "ikon"}


def _append_common_headers(handler: BaseHTTPRequestHandler, allow_origin: str) -> None:
    handler.send_header("Access-Control-Allow-Origin", allow_origin)
    handler.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")


def _split_query_values(values: List[str]) -> List[str]:
    out: List[str] = []
    for raw in values:
        for part in raw.split(","):
            val = part.strip().lower()
            if val:
                out.append(val)
    seen = set()
    return [x for x in out if not (x in seen or seen.add(x))]


def _to_bool_flag(raw: str) -> bool:
    return (raw or "").strip().lower() in {"1", "true", "yes", "on"}


def _supported_catalog(catalog: List[Dict[str, object]]) -> List[Dict[str, object]]:
    out: List[Dict[str, object]] = []
    for item in catalog:
        raw_pass_types = item.get("pass_types")
        if not isinstance(raw_pass_types, list):
            continue
        pass_types = {str(v).strip().lower() for v in raw_pass_types if str(v).strip()}
        if pass_types.intersection(_SUPPORTED_PASS_TYPES):
            out.append(item)
    return out


def _catalog_item_with_display_name(item: Dict[str, object]) -> Dict[str, object]:
    out = dict(item)
    out["display_name"] = str(item.get("display_name") or item.get("query") or "").strip()
    return out


def _available_filters(catalog: List[Dict[str, object]]) -> Dict[str, Dict[str, int]]:
    pass_type_counts: Dict[str, int] = {}
    region_counts: Dict[str, int] = {}
    country_counts: Dict[str, int] = {}
    for item in catalog:
        region = str(item.get("region", "")).strip().lower()
        if region:
            region_counts[region] = region_counts.get(region, 0) + 1
        country = str(item.get("country", "")).strip().upper()
        if country:
            country_counts[country] = country_counts.get(country, 0) + 1
        for pass_type in item.get("pass_types", []) if isinstance(item.get("pass_types"), list) else []:
            pt = str(pass_type).strip().lower()
            if pt:
                pass_type_counts[pt] = pass_type_counts.get(pt, 0) + 1
    return {
        "pass_type": pass_type_counts,
        "region": region_counts,
        "country": country_counts,
    }


def _apply_catalog_filters(
    catalog: List[Dict[str, object]],
    *,
    pass_types: List[str],
    region: str,
    country: str,
    search: str,
) -> List[Dict[str, object]]:
    items = search_resort_catalog(catalog, search)
    if pass_types:
        allowed = set(pass_types)
        items = [
            item
            for item in items
            if allowed.intersection(
                {str(v).strip().lower() for v in (item.get("pass_types") or []) if str(v).strip()}
            )
        ]
    if region:
        want = region.lower()
        items = [item for item in items if str(item.get("region", "")).strip().lower() == want]
    if country:
        want_country = country.upper()
        items = [item for item in items if str(item.get("country", "")).strip().upper() == want_country]
    return items


def _empty_payload(cache_file: str, geocode_cache_hours: int, forecast_cache_hours: int) -> Dict[str, object]:
    return build_payload_metadata(
        cache_path=cache_file,
        cache_hits=0,
        cache_misses=0,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
        reports=[],
        failed=[],
    )


def _default_applied_filters() -> Dict[str, object]:
    return {
        "pass_type": [],
        "region": "",
        "country": "",
        "search": "",
        "search_all": True,
        "include_default": True,
        "include_all": False,
    }


def select_resorts_from_query(qs: dict) -> tuple[List[str], str, dict, dict, bool]:
    resorts = [x.strip() for x in qs.get("resort", []) if x.strip()]
    pass_types = _split_query_values(qs.get("pass_type", []))
    region = (qs.get("region", [""])[0] or "").strip().lower()
    country = (qs.get("country", [""])[0] or "").strip().upper()
    search_text = (qs.get("search", [""])[0] or "").strip()
    has_search_all = "search_all" in qs
    search_all = _to_bool_flag((qs.get("search_all", [""])[0] or "")) if has_search_all else True
    has_include_default = "include_default" in qs
    include_default = _to_bool_flag((qs.get("include_default", [""])[0] or "")) if has_include_default else False
    include_all = _to_bool_flag((qs.get("include_all", [""])[0] or ""))
    applied = {
        "pass_type": pass_types,
        "region": region,
        "country": country,
        "search": search_text,
        "search_all": search_all,
        "include_default": include_default,
        "include_all": include_all,
    }

    catalog = _supported_catalog(load_resort_catalog(DEFAULT_RESORTS_FILE))
    available = _available_filters(catalog)
    has_filters = bool(
        pass_types or region or country or search_text or include_all or has_include_default or has_search_all
    )
    if not has_filters:
        applied["search_all"] = True
        applied["include_default"] = not bool(resorts)
        applied["include_all"] = False
        resorts_file = "" if resorts else DEFAULT_RESORTS_FILE
        return resorts, resorts_file, applied, available, False

    if search_text and search_all:
        # Search-all mode ignores pass/region/country/default scope and searches full supported catalog.
        filtered_catalog = search_resort_catalog(catalog, search_text)
    elif include_default:
        default_catalog = [item for item in catalog if bool(item.get("default_enabled", False))]
        filtered_catalog = _apply_catalog_filters(
            default_catalog,
            pass_types=pass_types,
            region=region,
            country=country,
            search=search_text,
        )
    elif include_all and not (pass_types or region or country or search_text):
        filtered_catalog = list(catalog)
    else:
        filtered_catalog = _apply_catalog_filters(
            catalog,
            pass_types=pass_types,
            region=region,
            country=country,
            search=search_text,
        )

    allowed_queries = {
        str(item.get("query", "")).strip()
        for item in filtered_catalog
        if str(item.get("query", "")).strip()
    }
    if resorts:
        selected = [r for r in resorts if r in allowed_queries]
    else:
        selected = [
            str(item["query"]).strip()
            for item in filtered_catalog
            if str(item.get("query", "")).strip()
        ]
    no_match = len(selected) == 0
    return selected, "", applied, available, no_match


def _parse_hours(raw: str, default: int = 72) -> int:
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = default
    return max(1, min(240, value))


def _hourly_payload_for_resort(
    *,
    resort_id: str,
    hours: int,
    cache_file: str,
    geocode_cache_hours: int,
    forecast_cache_hours: int,
) -> Dict[str, object] | None:
    catalog = _supported_catalog(load_resort_catalog(DEFAULT_RESORTS_FILE))
    item = next((r for r in catalog if str(r.get("resort_id", "")) == resort_id), None)
    if item is None:
        return None

    cache_path = dated_cache_path(cache_file)
    cache = JsonCache(cache_path)
    coord_cache = ResortCoordinateCache(COORDINATES_CACHE_FILE)
    query = str(item.get("query", "")).strip()
    location = geocode(
        query,
        cache=cache,
        ttl_seconds=geocode_cache_hours * 3600,
        coord_cache=coord_cache,
    )
    if location is None:
        return {
            "error": f"Unable to geocode resort '{query}'",
            "resort_id": resort_id,
            "query": query,
        }

    forecast = fetch_hourly_forecast(
        location,
        cache=cache,
        ttl_seconds=forecast_cache_hours * 3600,
        hours=hours,
    )
    cache.save()
    coord_cache.save()

    hourly = forecast.get("hourly", {}) if isinstance(forecast, dict) else {}
    times = list(hourly.get("time", []))
    n = min(hours, len(times))
    metric_keys = [
        "snowfall",
        "rain",
        "precipitation_probability",
        "snow_depth",
        "wind_speed_10m",
        "wind_direction_10m",
        "visibility",
    ]
    trimmed_hourly: Dict[str, object] = {"time": times[:n]}
    for key in metric_keys:
        values = hourly.get(key, [])
        if isinstance(values, list):
            trimmed_hourly[key] = values[:n]
        else:
            trimmed_hourly[key] = []

    return {
        "resort_id": resort_id,
        "query": query,
        "display_name": str(item.get("display_name") or query).strip(),
        "matched_name": location.name,
        "country": item.get("country"),
        "region": item.get("region"),
        "pass_types": item.get("pass_types", []),
        "timezone": forecast.get("timezone"),
        "model": "ecmwf_ifs025",
        "resolved_latitude": forecast.get("latitude"),
        "resolved_longitude": forecast.get("longitude"),
        "hours": n,
        "hourly": trimmed_hourly,
    }


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
                    result = _hourly_payload_for_resort(
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
                    catalog = _supported_catalog(load_resort_catalog(DEFAULT_RESORTS_FILE))
                except Exception as exc:
                    self._write_json(500, {"error": f"Failed to load resort catalog: {exc}"})
                    return
                pass_types = _split_query_values(qs.get("pass_type", []))
                region = (qs.get("region", [""])[0] or "").strip().lower()
                country = (qs.get("country", [""])[0] or "").strip().upper()
                items = _apply_catalog_filters(
                    catalog,
                    pass_types=pass_types,
                    region=region,
                    country=country,
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
                            "country": country,
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
