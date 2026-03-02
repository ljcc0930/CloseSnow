#!/usr/bin/env python3
"""
Fetch snowfall from ECMWF Open Data (IFS 0.25) with local caching.

Notes:
- Uses variable `sf` (snowfall, accumulated, meters of water equivalent).
- Converts to snowfall depth with ratio used by Open-Meteo style conversion:
  1 mm water equivalent -> 0.7 cm snow.
- ECMWF Open Data IFS horizon is shorter than 14 full days for this product.
  Output still keeps 14 daily columns and leaves missing days blank.
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
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import numpy as np
import xarray as xr
from ecmwf.opendata import Client

try:
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover
    ZoneInfo = None  # type: ignore


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


@dataclass
class ResortLocation:
    query: str
    name: str
    latitude: float
    longitude: float
    timezone: str


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
                d = json.load(f)
            if isinstance(d, dict) and isinstance(d.get("entries"), dict):
                self.data = d
        except Exception:
            self.data = {"version": 1, "entries": {}}

    def get(self, key: str, ttl_seconds: int) -> Optional[Any]:
        item = self.data["entries"].get(key)
        if not item:
            self.misses += 1
            return None
        ts = item.get("ts")
        if not isinstance(ts, (int, float)):
            self.misses += 1
            return None
        if time.time() - ts > ttl_seconds:
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
        headers={"User-Agent": "ecmwf-opendata-snowfall/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    cache.set(key, payload)
    return payload


def geocode_resort(name: str, cache: JsonCache, geocode_ttl_seconds: int) -> Optional[ResortLocation]:
    r = fetch_json(
        GEOCODING_URL,
        {"name": name, "count": 1, "language": "en", "format": "json"},
        cache=cache,
        namespace="geocode_openmeteo",
        ttl_seconds=geocode_ttl_seconds,
    )
    results = r.get("results") or []
    if results:
        top = results[0]
        return ResortLocation(
            query=name,
            name=top.get("name", name),
            latitude=float(top["latitude"]),
            longitude=float(top["longitude"]),
            timezone=top.get("timezone") or "UTC",
        )

    r2 = fetch_json(
        NOMINATIM_URL,
        {"q": name, "format": "jsonv2", "limit": 1, "addressdetails": 1},
        cache=cache,
        namespace="geocode_nominatim",
        ttl_seconds=geocode_ttl_seconds,
    )
    if not r2:
        return None
    top2 = r2[0]
    return ResortLocation(
        query=name,
        name=top2.get("display_name", name),
        latitude=float(top2["lat"]),
        longitude=float(top2["lon"]),
        timezone="UTC",
    )


def ensure_ecmwf_sf_grib(cache_dir: str) -> Dict[str, Any]:
    os.makedirs(cache_dir, exist_ok=True)
    client = Client(model="ifs", resol="0p25")

    # Use a 00z run for the longest deterministic horizon in open-data.
    date_obj = client.latest({"time": 0, "stream": "oper", "type": "fc", "step": 240, "param": "sf"})
    run_date = date_obj.strftime("%Y%m%d")
    run_hour = "00"
    grib_path = os.path.join(cache_dir, f"ifs_sf_{run_date}_{run_hour}.grib2")
    meta_path = os.path.join(cache_dir, f"ifs_sf_{run_date}_{run_hour}.json")

    if not os.path.exists(grib_path):
        steps = list(range(0, 145, 3)) + list(range(150, 241, 6))
        client.retrieve(
            date=date_obj,
            time=0,
            stream="oper",
            type="fc",
            step=steps,
            param="sf",
            target=grib_path,
        )
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "run_date": run_date,
                    "run_hour_utc": run_hour,
                    "variable": "sf",
                    "units": "m of water equivalent",
                    "steps_requested": steps,
                },
                f,
                ensure_ascii=False,
                indent=2,
            )

    return {"grib_path": grib_path, "run_date": run_date, "run_hour_utc": run_hour}


def to_local_date_str(dt64: np.datetime64, tz_name: str) -> str:
    # Treat cfgrib valid_time as UTC timestamps.
    secs = int(dt64.astype("datetime64[s]").astype(np.int64))
    dt_utc = datetime.fromtimestamp(secs, tz=timezone.utc)
    if ZoneInfo is None:
        return dt_utc.date().isoformat()
    try:
        return dt_utc.astimezone(ZoneInfo(tz_name)).date().isoformat()
    except Exception:
        return dt_utc.date().isoformat()


def extract_daily_snowfall_cm(
    ds: xr.Dataset,
    lat: float,
    lon: float,
    tz_name: str,
) -> Dict[str, float]:
    lat_vals = ds["latitude"].values
    lon_vals = ds["longitude"].values
    lon_q = lon
    if float(np.nanmax(lon_vals)) > 180 and lon_q < 0:
        lon_q = (lon_q + 360) % 360

    ilat = int(np.abs(lat_vals - lat).argmin())
    ilon = int(np.abs(lon_vals - lon_q).argmin())

    # sf is accumulated; deaccumulate to interval amounts.
    accum = ds["sf"][:, ilat, ilon].values.astype(float)
    increments = np.diff(accum, prepend=accum[0])
    increments = np.where(increments < 0, 0, increments)

    # m water equivalent -> mm -> cm snowfall (1 mm we -> 0.7 cm snow)
    snowfall_cm = increments * 1000.0 * 0.7

    valid_times = ds["valid_time"].values
    by_date: Dict[str, float] = {}
    for i in range(len(valid_times)):
        day = to_local_date_str(valid_times[i], tz_name)
        by_date[day] = by_date.get(day, 0.0) + float(snowfall_cm[i])
    return by_date


def make_row(
    location: ResortLocation,
    run_date_utc: str,
    daily_map: Dict[str, float],
) -> Dict[str, Any]:
    start_day = datetime.strptime(run_date_utc, "%Y%m%d").date()
    days = [(start_day + timedelta(days=i)).isoformat() for i in range(14)]

    row: Dict[str, Any] = {"query": location.query, "matched_name": location.name}
    totals = []
    for i, d in enumerate(days, start=1):
        v = daily_map.get(d)
        row[f"day_{i}_cm"] = round(v, 2) if v is not None else ""
        totals.append(v if v is not None else 0.0)

    row["week1_total_cm"] = f"{sum(totals[0:7]):.2f}"
    row["week2_total_cm"] = f"{sum(totals[7:14]):.2f}"
    return row


def write_csv(path: str, rows: List[Dict[str, Any]]) -> None:
    fields = ["query", "week1_total_cm", "week2_total_cm"] + [f"day_{i}_cm" for i in range(1, 15)]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            r = dict(r)
            r.pop("matched_name", None)
            w.writerow(r)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="ECMWF Open Data snowfall table for ski resorts.")
    p.add_argument("--resort", action="append", default=[], help="Resort name (repeatable).")
    p.add_argument("--output-csv", default="resorts_snowfall_daily_ecmwf_opendata.csv")
    p.add_argument("--cache-file", default=".cache/open_meteo_cache.json")
    p.add_argument("--ecmwf-cache-dir", default=".cache/ecmwf_opendata")
    p.add_argument("--geocode-cache-hours", type=int, default=24 * 30)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    resorts = [r.strip() for r in args.resort if r.strip()]
    if not resorts:
        print("No resorts provided.", file=sys.stderr)
        return 1

    cache = JsonCache(args.cache_file)
    geocode_ttl = args.geocode_cache_hours * 3600

    missing: List[str] = []
    locations: List[ResortLocation] = []
    for r in resorts:
        loc = geocode_resort(r, cache=cache, geocode_ttl_seconds=geocode_ttl)
        if not loc:
            missing.append(r)
        else:
            locations.append(loc)

    cache.save()

    if missing:
        print("Missing geocoding:", file=sys.stderr)
        for m in missing:
            print(f"- {m}", file=sys.stderr)
        return 2

    run_info = ensure_ecmwf_sf_grib(args.ecmwf_cache_dir)
    ds = xr.open_dataset(run_info["grib_path"], engine="cfgrib")

    rows: List[Dict[str, Any]] = []
    for loc in locations:
        daily = extract_daily_snowfall_cm(ds, loc.latitude, loc.longitude, loc.timezone)
        rows.append(make_row(loc, run_info["run_date"], daily))

    write_csv(args.output_csv, rows)
    print(f"Done. CSV: {args.output_csv}")
    print(f"Run used: {run_info['run_date']} {run_info['run_hour_utc']}z UTC", file=sys.stderr)
    print(f"Geocode cache: hits={cache.hits}, misses={cache.misses}, file={args.cache_file}", file=sys.stderr)
    print(f"GRIB cache dir: {args.ecmwf_cache_dir}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
