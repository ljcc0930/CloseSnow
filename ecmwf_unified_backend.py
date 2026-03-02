#!/usr/bin/env python3
"""
Unified backend pipeline for ski weather data (Open-Meteo ECMWF IFS 0.25).

One pipeline, one forecast request per resort, shared cache:
- geocoding (Open-Meteo + Nominatim fallback)
- snowfall
- rainfall
- temperature

Outputs:
- unified JSON
- snowfall CSV (compatible with existing renderer)
- rainfall CSV (daily only)
- temperature CSV (compatible with existing renderer)
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
from datetime import date
from typing import Any, Dict, List, Optional, Tuple


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

DEFAULT_RESORTS = [
    "steamboat, co",
    "winter park, co",
    "arapahoe basin, co",
    "copper mountain, co",
    "aspen snowmass, co",
    "snowbasin, ut",
    "snowbird, ut",
    "solitude, ut",
    "brighton, ut",
    "jackson hole, wy",
    "big sky, mt",
    "palisades tahoe, ca",
    "mammoth mountain, ca",
]


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


def dated_cache_path(path: str, d: Optional[date] = None) -> str:
    if d is None:
        d = date.today()
    base, ext = os.path.splitext(path)
    suffix = d.isoformat()
    if ext:
        return f"{base}_{suffix}{ext}"
    return f"{path}_{suffix}"


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
    namespace: str,
    ttl_seconds: int,
    timeout: int = 20,
) -> Any:
    query = canonical_query(params)
    key = f"{namespace}:{url}?{query}"
    cached = cache.get(key, ttl_seconds)
    if cached is not None:
        return cached

    req = urllib.request.Request(
        f"{url}?{query}",
        headers={
            "User-Agent": "ecmwf-unified-backend/1.0 (+local script)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    cache.set(key, payload)
    return payload


def geocode(name: str, cache: JsonCache, ttl_seconds: int) -> Optional[ResortLocation]:
    data = fetch_json(
        GEOCODING_URL,
        {"name": name, "count": 1, "language": "en", "format": "json"},
        cache=cache,
        namespace="geocode_openmeteo",
        ttl_seconds=ttl_seconds,
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

    data2 = fetch_json(
        NOMINATIM_URL,
        {"q": name, "format": "jsonv2", "limit": 1, "addressdetails": 1},
        cache=cache,
        namespace="geocode_nominatim",
        ttl_seconds=ttl_seconds,
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


def fetch_forecast(location: ResortLocation, cache: JsonCache, ttl_seconds: int) -> Dict[str, Any]:
    return fetch_json(
        FORECAST_URL,
        {
            "latitude": location.latitude,
            "longitude": location.longitude,
            "forecast_days": 14,
            "timezone": "auto",
            "models": "ecmwf_ifs025",
            "daily": "snowfall_sum,rain_sum,precipitation_sum,temperature_2m_max,temperature_2m_min",
        },
        cache=cache,
        namespace="forecast_ecmwf_unified",
        ttl_seconds=ttl_seconds,
    )


def as_float_list(values: List[Any]) -> List[Optional[float]]:
    out: List[Optional[float]] = []
    for v in values:
        try:
            out.append(float(v))
        except Exception:
            out.append(None)
    return out


def safe_sum(values: List[Optional[float]]) -> float:
    return float(sum(v for v in values if v is not None))


def build_report(location: ResortLocation, forecast: Dict[str, Any]) -> Dict[str, Any]:
    daily = forecast.get("daily", {})
    dates = daily.get("time", [])
    snowfall = as_float_list(daily.get("snowfall_sum", []))
    rain = as_float_list(daily.get("rain_sum", []))
    precipitation = as_float_list(daily.get("precipitation_sum", []))
    tmax = as_float_list(daily.get("temperature_2m_max", []))
    tmin = as_float_list(daily.get("temperature_2m_min", []))

    rows: List[Dict[str, Any]] = []
    n = max(len(dates), len(snowfall), len(rain), len(precipitation), len(tmax), len(tmin))
    for i in range(n):
        max_v = tmax[i] if i < len(tmax) else None
        rows.append(
            {
                "date": dates[i] if i < len(dates) else None,
                "snowfall_cm": snowfall[i] if i < len(snowfall) else None,
                "rain_mm": rain[i] if i < len(rain) else None,
                "precipitation_mm": precipitation[i] if i < len(precipitation) else None,
                "temperature_max_c": max_v,
                "temperature_min_c": tmin[i] if i < len(tmin) else None,
                "above_0": 1 if (max_v is not None and max_v > 0) else 0,
            }
        )

    snow_w1 = snowfall[0:7]
    snow_w2 = snowfall[7:14]
    rain_w1 = rain[0:7]
    rain_w2 = rain[7:14]

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
        "week1_total_snowfall_cm": safe_sum(snow_w1),
        "week2_total_snowfall_cm": safe_sum(snow_w2),
        "week1_total_rain_mm": safe_sum(rain_w1),
        "week2_total_rain_mm": safe_sum(rain_w2),
        "daily": rows,
    }


def write_snow_csv(path: str, reports: List[Dict[str, Any]]) -> None:
    fields = ["query", "week1_total_cm", "week2_total_cm"] + [f"day_{i}_cm" for i in range(1, 15)]
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in reports:
            row: Dict[str, Any] = {
                "query": r["query"],
                "week1_total_cm": f"{r['week1_total_snowfall_cm']:.2f}",
                "week2_total_cm": f"{r['week2_total_snowfall_cm']:.2f}",
            }
            daily = r.get("daily", [])
            for i in range(14):
                v = daily[i]["snowfall_cm"] if i < len(daily) else None
                row[f"day_{i+1}_cm"] = v if v is not None else ""
            w.writerow(row)


def write_rain_csv(path: str, reports: List[Dict[str, Any]]) -> None:
    fields = ["query"] + [f"day_{i}_rain_mm" for i in range(1, 15)]
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in reports:
            row: Dict[str, Any] = {"query": r["query"]}
            daily = r.get("daily", [])
            for i in range(14):
                v = daily[i]["rain_mm"] if i < len(daily) else None
                row[f"day_{i+1}_rain_mm"] = v if v is not None else ""
            w.writerow(row)


def write_temp_csv(path: str, reports: List[Dict[str, Any]]) -> None:
    max_cols = [f"day_{i}_max_c" for i in range(1, 15)]
    min_cols = [f"day_{i}_min_c" for i in range(1, 15)]
    flag_cols = [f"day_{i}_above_0" for i in range(1, 15)]
    fields = ["query", "matched_name"] + max_cols + min_cols + flag_cols
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in reports:
            row: Dict[str, Any] = {"query": r["query"], "matched_name": r.get("matched_name", "")}
            daily = r.get("daily", [])
            for i in range(14):
                day = daily[i] if i < len(daily) else {}
                row[f"day_{i+1}_max_c"] = day.get("temperature_max_c", "")
                row[f"day_{i+1}_min_c"] = day.get("temperature_min_c", "")
                row[f"day_{i+1}_above_0"] = day.get("above_0", 0)
            w.writerow(row)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Unified ECMWF backend pipeline for ski weather.")
    p.add_argument("--resort", action="append", default=[], help="Resort name (repeatable).")
    p.add_argument("--resorts-file", default="resorts.txt", help="Text file with one resort per line.")
    p.add_argument("--use-default-resorts", action="store_true", help="Use built-in resort list.")
    p.add_argument("--output-json", default=".cache/resorts_weather_unified.json")
    p.add_argument("--snow-csv", default=".cache/resorts_snowfall_daily.csv")
    p.add_argument("--rain-csv", default=".cache/resorts_rainfall_daily.csv")
    p.add_argument("--temp-csv", default=".cache/resorts_temperature_daily.csv")
    p.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    p.add_argument("--forecast-cache-hours", type=int, default=3)
    return p.parse_args()


def read_resorts(path: str) -> List[str]:
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]


def run_pipeline(
    resorts: Optional[List[str]] = None,
    resorts_file: str = "resorts.txt",
    use_default_resorts: bool = False,
    output_json: str = ".cache/resorts_weather_unified.json",
    snow_csv: str = ".cache/resorts_snowfall_daily.csv",
    rain_csv: str = ".cache/resorts_rainfall_daily.csv",
    temp_csv: str = ".cache/resorts_temperature_daily.csv",
    cache_file: str = ".cache/open_meteo_cache.json",
    geocode_cache_hours: int = 24 * 30,
    forecast_cache_hours: int = 3,
    write_outputs: bool = True,
) -> Dict[str, Any]:
    selected: List[str] = [r.strip() for r in (resorts or []) if r and r.strip()]
    if resorts_file:
        selected.extend(read_resorts(resorts_file))
    if use_default_resorts:
        selected.extend(DEFAULT_RESORTS)
    if not selected:
        selected = list(DEFAULT_RESORTS)

    seen = set()
    selected = [r for r in selected if not (r in seen or seen.add(r))]

    cache_path = dated_cache_path(cache_file)
    cache = JsonCache(cache_path)
    geocode_ttl = geocode_cache_hours * 3600
    forecast_ttl = forecast_cache_hours * 3600

    reports: List[Dict[str, Any]] = []
    failed: List[Dict[str, str]] = []
    for resort in selected:
        try:
            # Cache hit => local read; cache miss => API call.
            loc = geocode(resort, cache=cache, ttl_seconds=geocode_ttl)
            if not loc:
                failed.append({"query": resort, "reason": "No geocoding match"})
                continue
            fc = fetch_forecast(loc, cache=cache, ttl_seconds=forecast_ttl)
            reports.append(build_report(loc, fc))
        except Exception as exc:  # noqa: BLE001
            failed.append({"query": resort, "reason": str(exc)})

    out = {
        "source": "Open-Meteo",
        "model": "ecmwf_ifs025",
        "forecast_days": 14,
        "units": {
            "snowfall_cm": "cm",
            "rain_mm": "mm",
            "precipitation_mm": "mm",
            "temperature_max_c": "celsius",
            "temperature_min_c": "celsius",
        },
        "cache": {
            "file": cache_path,
            "hits": cache.hits,
            "misses": cache.misses,
            "geocode_cache_hours": geocode_cache_hours,
            "forecast_cache_hours": forecast_cache_hours,
        },
        "resorts_count": len(reports),
        "failed_count": len(failed),
        "failed": failed,
        "reports": reports,
    }

    cache.save()
    if write_outputs:
        out_parent = os.path.dirname(output_json)
        if out_parent:
            os.makedirs(out_parent, exist_ok=True)
        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        write_snow_csv(snow_csv, reports)
        write_rain_csv(rain_csv, reports)
        write_temp_csv(temp_csv, reports)

    return out


def main() -> int:
    args = parse_args()
    out = run_pipeline(
        resorts=args.resort,
        resorts_file=args.resorts_file,
        use_default_resorts=args.use_default_resorts,
        output_json=args.output_json,
        snow_csv=args.snow_csv,
        rain_csv=args.rain_csv,
        temp_csv=args.temp_csv,
        cache_file=args.cache_file,
        geocode_cache_hours=args.geocode_cache_hours,
        forecast_cache_hours=args.forecast_cache_hours,
        write_outputs=True,
    )
    cache_info = out["cache"]

    print(f"Done. JSON: {args.output_json}")
    print(f"Done. Snow CSV: {args.snow_csv}")
    print(f"Done. Rain CSV: {args.rain_csv}")
    print(f"Done. Temp CSV: {args.temp_csv}")
    print(
        f"Cache: hits={cache_info['hits']}, misses={cache_info['misses']}, file={cache_info['file']}",
        file=sys.stderr,
    )
    if out["failed"]:
        print(f"Warnings: {len(out['failed'])} resort(s) failed.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
