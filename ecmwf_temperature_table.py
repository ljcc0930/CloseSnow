#!/usr/bin/env python3
"""
Fetch 14-day temperature table for ski resorts using Open-Meteo ECMWF.

Output format:
- one row per resort
- day_1_max_c ... day_14_max_c
- day_1_min_c ... day_14_min_c
- day_1_above_0 ... day_14_above_0 (1/0, based on daily max > 0C)
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
from typing import Any, Dict, List, Optional


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


@dataclass
class ResortLocation:
    query: str
    name: str
    latitude: float
    longitude: float


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
    pairs = []
    for k in sorted(params.keys()):
        v = params[k]
        if isinstance(v, list):
            for x in v:
                pairs.append((k, str(x)))
        else:
            pairs.append((k, str(v)))
    return urllib.parse.urlencode(pairs, doseq=True)


def fetch_json(
    url: str,
    params: Dict[str, Any],
    cache: JsonCache,
    namespace: str,
    ttl_seconds: int,
) -> Any:
    query = canonical_query(params)
    key = f"{namespace}:{url}?{query}"
    cached = cache.get(key, ttl_seconds)
    if cached is not None:
        return cached

    req = urllib.request.Request(
        f"{url}?{query}",
        headers={"User-Agent": "ecmwf-temperature/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    cache.set(key, payload)
    return payload


def geocode(name: str, cache: JsonCache, ttl_seconds: int) -> Optional[ResortLocation]:
    r = fetch_json(
        GEOCODING_URL,
        {"name": name, "count": 1, "language": "en", "format": "json"},
        cache=cache,
        namespace="geocode_openmeteo",
        ttl_seconds=ttl_seconds,
    )
    results = r.get("results") or []
    if results:
        top = results[0]
        return ResortLocation(
            query=name,
            name=top.get("name", name),
            latitude=float(top["latitude"]),
            longitude=float(top["longitude"]),
        )

    r2 = fetch_json(
        NOMINATIM_URL,
        {"q": name, "format": "jsonv2", "limit": 1, "addressdetails": 1},
        cache=cache,
        namespace="geocode_nominatim",
        ttl_seconds=ttl_seconds,
    )
    if not r2:
        return None
    top2 = r2[0]
    return ResortLocation(
        query=name,
        name=top2.get("display_name", name),
        latitude=float(top2["lat"]),
        longitude=float(top2["lon"]),
    )


def fetch_temperature(location: ResortLocation, cache: JsonCache, ttl_seconds: int) -> Dict[str, Any]:
    return fetch_json(
        FORECAST_URL,
        {
            "latitude": location.latitude,
            "longitude": location.longitude,
            "forecast_days": 14,
            "timezone": "auto",
            "models": "ecmwf_ifs025",
            "daily": "temperature_2m_max,temperature_2m_min",
        },
        cache=cache,
        namespace="forecast_ecmwf_temperature",
        ttl_seconds=ttl_seconds,
    )


def write_csv(path: str, rows: List[Dict[str, Any]]) -> None:
    max_cols = [f"day_{i}_max_c" for i in range(1, 15)]
    min_cols = [f"day_{i}_min_c" for i in range(1, 15)]
    flag_cols = [f"day_{i}_above_0" for i in range(1, 15)]
    fields = ["query", "matched_name"] + max_cols + min_cols + flag_cols

    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="ECMWF 14-day temperature table for ski resorts.")
    p.add_argument("--resort", action="append", default=[], help="Resort name (repeatable).")
    p.add_argument("--resorts-file", default="resorts.txt", help="Text file with one resort per line.")
    p.add_argument("--output-csv", default=".cache/resorts_temperature_daily.csv")
    p.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p.add_argument("--forecast-cache-hours", type=int, default=3)
    return p.parse_args()


def read_resorts(path: str) -> List[str]:
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]


def main() -> int:
    args = parse_args()
    resorts = [r.strip() for r in args.resort if r.strip()]
    if args.resorts_file:
        resorts.extend(read_resorts(args.resorts_file))
    resorts = [r for r in resorts if r]
    if not resorts:
        print("No resorts provided.", file=sys.stderr)
        return 1

    cache = JsonCache(args.cache_file)
    geocode_ttl = args.geocode_cache_hours * 3600
    forecast_ttl = args.forecast_cache_hours * 3600

    rows: List[Dict[str, Any]] = []
    missing_geocode: List[str] = []

    for resort in resorts:
        loc = geocode(resort, cache=cache, ttl_seconds=geocode_ttl)
        if not loc:
            missing_geocode.append(resort)
            continue

        forecast = fetch_temperature(loc, cache=cache, ttl_seconds=forecast_ttl)
        daily = forecast["daily"]
        tmax = daily["temperature_2m_max"]
        tmin = daily["temperature_2m_min"]

        row: Dict[str, Any] = {"query": resort, "matched_name": loc.name}
        for i in range(14):
            max_v = tmax[i] if i < len(tmax) else None
            min_v = tmin[i] if i < len(tmin) else None
            row[f"day_{i+1}_max_c"] = max_v
            row[f"day_{i+1}_min_c"] = min_v
            row[f"day_{i+1}_above_0"] = 1 if (max_v is not None and max_v > 0) else 0
        rows.append(row)

    cache.save()
    write_csv(args.output_csv, rows)
    print(f"Done. CSV: {args.output_csv}")
    print(f"Cache: hits={cache.hits}, misses={cache.misses}, file={args.cache_file}", file=sys.stderr)

    if missing_geocode:
        print("Missing geocoding:", file=sys.stderr)
        for name in missing_geocode:
            print(f"- {name}", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
