#!/usr/bin/env python3
"""
Fetch 14-day snowfall forecasts for multiple ski resorts using Open-Meteo ECMWF.

Caching is enabled by default to reduce API calls:
- geocoding cache TTL: 30 days
- forecast cache TTL: 3 hours
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


@dataclass
class ResortLocation:
    query: str
    name: str
    latitude: float
    longitude: float
    country: Optional[str]
    admin1: Optional[str]


class JsonCache:
    def __init__(self, path: str) -> None:
        self.path = path
        self.data: Dict[str, Any] = {"version": 1, "entries": {}}
        self.hits = 0
        self.misses = 0
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self.path):
            return
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                parsed = json.load(f)
            if isinstance(parsed, dict) and isinstance(parsed.get("entries"), dict):
                self.data = parsed
        except Exception:
            # Corrupt cache should not break script execution.
            self.data = {"version": 1, "entries": {}}

    def get(self, key: str, max_age_seconds: int) -> Optional[Any]:
        item = self.data["entries"].get(key)
        if not item:
            self.misses += 1
            return None
        ts = item.get("ts")
        if not isinstance(ts, (int, float)):
            self.misses += 1
            return None
        if time.time() - ts > max_age_seconds:
            self.misses += 1
            return None
        self.hits += 1
        return item.get("value")

    def set(self, key: str, value: Any) -> None:
        self.data["entries"][key] = {"ts": time.time(), "value": value}

    def save(self) -> None:
        parent = os.path.dirname(self.path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False)


def canonical_query(params: Dict[str, Any]) -> str:
    pairs: List[Tuple[str, str]] = []
    for k in sorted(params.keys()):
        v = params[k]
        if isinstance(v, list):
            for item in v:
                pairs.append((k, str(item)))
        else:
            pairs.append((k, str(v)))
    return urllib.parse.urlencode(pairs, doseq=True)


def fetch_json(
    url: str,
    params: Dict[str, Any],
    cache: JsonCache,
    cache_namespace: str,
    cache_ttl_seconds: int,
    timeout: int = 20,
) -> Any:
    query = canonical_query(params)
    key = f"{cache_namespace}:{url}?{query}"
    cached = cache.get(key, cache_ttl_seconds)
    if cached is not None:
        return cached

    req = urllib.request.Request(
        f"{url}?{query}",
        headers={
            "User-Agent": "ecmwf-snowfall/1.0 (+local script)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    cache.set(key, payload)
    return payload


def geocode_resort(
    name: str,
    cache: JsonCache,
    geocode_ttl_seconds: int,
) -> Optional[ResortLocation]:
    data = fetch_json(
        GEOCODING_URL,
        {
            "name": name,
            "count": 1,
            "language": "en",
            "format": "json",
        },
        cache=cache,
        cache_namespace="geocode_openmeteo",
        cache_ttl_seconds=geocode_ttl_seconds,
    )
    results = data.get("results") or []
    if results:
        top = results[0]
        return ResortLocation(
            query=name,
            name=top.get("name", name),
            latitude=float(top["latitude"]),
            longitude=float(top["longitude"]),
            country=top.get("country"),
            admin1=top.get("admin1"),
        )

    # Fallback geocoder for resort names that Open-Meteo doesn't resolve directly.
    data2 = fetch_json(
        NOMINATIM_URL,
        {
            "q": name,
            "format": "jsonv2",
            "limit": 1,
            "addressdetails": 1,
        },
        cache=cache,
        cache_namespace="geocode_nominatim",
        cache_ttl_seconds=geocode_ttl_seconds,
    )
    if not data2:
        return None
    top2 = data2[0]
    addr = top2.get("address", {})
    return ResortLocation(
        query=name,
        name=top2.get("display_name", name),
        latitude=float(top2["lat"]),
        longitude=float(top2["lon"]),
        country=addr.get("country"),
        admin1=addr.get("state") or addr.get("region"),
    )


def fetch_snowfall_forecast(
    location: ResortLocation,
    cache: JsonCache,
    forecast_ttl_seconds: int,
) -> Dict[str, Any]:
    return fetch_json(
        FORECAST_URL,
        {
            "latitude": location.latitude,
            "longitude": location.longitude,
            "forecast_days": 14,
            "timezone": "auto",
            "models": "ecmwf_ifs025",
            "daily": "snowfall_sum",
        },
        cache=cache,
        cache_namespace="forecast_ecmwf_snowfall",
        cache_ttl_seconds=forecast_ttl_seconds,
    )


def avg(values: List[Optional[float]]) -> Optional[float]:
    good = [v for v in values if v is not None]
    if not good:
        return None
    return sum(good) / len(good)


def build_report(location: ResortLocation, forecast: Dict[str, Any]) -> Dict[str, Any]:
    daily = forecast["daily"]
    dates = daily["time"]
    snowfall = daily["snowfall_sum"]
    rows = [{"date": d, "snowfall_cm": s} for d, s in zip(dates, snowfall)]

    week1 = snowfall[0:7]
    week2 = snowfall[7:14]
    return {
        "query": location.query,
        "matched_name": location.name,
        "country": location.country,
        "admin1": location.admin1,
        "input_latitude": location.latitude,
        "input_longitude": location.longitude,
        "model": "ecmwf_ifs025",
        "forecast_timezone": forecast.get("timezone"),
        "resolved_latitude": forecast.get("latitude"),
        "resolved_longitude": forecast.get("longitude"),
        "week1_avg_snowfall_cm": avg(week1),
        "week2_avg_snowfall_cm": avg(week2),
        "week1_total_snowfall_cm": sum(v for v in week1 if v is not None),
        "week2_total_snowfall_cm": sum(v for v in week2 if v is not None),
        "daily": rows,
    }


def write_csv(path: str, reports: List[Dict[str, Any]]) -> None:
    day_fields = [f"day_{i}_cm" for i in range(1, 15)]
    fields = ["query", "week1_total_cm", "week2_total_cm"] + day_fields
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for report in reports:
            week1_total = report["week1_total_snowfall_cm"]
            week2_total = report["week2_total_snowfall_cm"]
            row: Dict[str, Any] = {
                "query": report["query"],
                "week1_total_cm": f"{week1_total:.2f}" if week1_total is not None else "",
                "week2_total_cm": f"{week2_total:.2f}" if week2_total is not None else "",
            }
            for i in range(14):
                value = report["daily"][i]["snowfall_cm"] if i < len(report["daily"]) else None
                row[f"day_{i+1}_cm"] = value
            writer.writerow(row)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Fetch ECMWF 14-day snowfall for ski resorts.")
    p.add_argument("--resort", action="append", default=[], help="Resort name (repeatable).")
    p.add_argument(
        "--resorts-file",
        default="resorts.yml",
        help="Resort catalog file (.yml/.json) or plain text file with one resort query per line.",
    )
    p.add_argument("--output-json", default=".cache/ecmwf_snowfall.json", help="JSON output path.")
    p.add_argument("--output-csv", default=".cache/ecmwf_snowfall_daily.csv", help="CSV output path.")
    p.add_argument("--cache-file", default=".cache/open_meteo_cache.json", help="Cache file path.")
    p.add_argument(
        "--geocode-cache-hours",
        type=int,
        default=24 * 30,
        help="Geocoding cache TTL in hours (default: 720).",
    )
    p.add_argument(
        "--forecast-cache-hours",
        type=int,
        default=3,
        help="Forecast cache TTL in hours (default: 3).",
    )
    return p.parse_args()


def read_resorts(path: str) -> List[str]:
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]


def main() -> int:
    args = parse_args()
    resorts = list(args.resort)
    if args.resorts_file:
        resorts.extend(read_resorts(args.resorts_file))
    resorts = [r.strip() for r in resorts if r.strip()]
    if not resorts:
        print("No resorts provided. Use --resort or --resorts-file.", file=sys.stderr)
        return 1

    cache = JsonCache(args.cache_file)
    geocode_ttl = args.geocode_cache_hours * 3600
    forecast_ttl = args.forecast_cache_hours * 3600

    reports: List[Dict[str, Any]] = []
    failed: List[Dict[str, str]] = []
    for resort in resorts:
        try:
            loc = geocode_resort(resort, cache=cache, geocode_ttl_seconds=geocode_ttl)
            if not loc:
                failed.append({"query": resort, "reason": "No geocoding match"})
                continue
            forecast = fetch_snowfall_forecast(
                loc, cache=cache, forecast_ttl_seconds=forecast_ttl
            )
            reports.append(build_report(loc, forecast))
        except Exception as exc:  # noqa: BLE001
            failed.append({"query": resort, "reason": str(exc)})

    out = {
        "source": "Open-Meteo",
        "model": "ecmwf_ifs025",
        "forecast_days": 14,
        "cache": {
            "file": args.cache_file,
            "hits": cache.hits,
            "misses": cache.misses,
            "geocode_cache_hours": args.geocode_cache_hours,
            "forecast_cache_hours": args.forecast_cache_hours,
        },
        "resorts_count": len(reports),
        "failed_count": len(failed),
        "failed": failed,
        "reports": reports,
    }

    cache.save()
    out_parent = os.path.dirname(args.output_json)
    if out_parent:
        os.makedirs(out_parent, exist_ok=True)
    with open(args.output_json, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    write_csv(args.output_csv, reports)

    print(f"Done. JSON: {args.output_json}")
    print(f"Done. CSV:  {args.output_csv}")
    print(
        f"Cache: hits={cache.hits}, misses={cache.misses}, file={args.cache_file}",
        file=sys.stderr,
    )
    if failed:
        print(f"Warnings: {len(failed)} resort(s) failed.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
