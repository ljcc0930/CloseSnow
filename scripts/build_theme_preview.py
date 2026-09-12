#!/usr/bin/env python3
"""Build an offline, deterministic mock site for Day/Night visual review.

Run from any directory: python3 scripts/build_theme_preview.py
Then: python3 -m http.server 8012 --directory /tmp/closesnow-theme-preview
The normal homepage includes all six table tabs; every resort has local hourly
data, including an all-missing case. Re-run after editing frontend assets.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
import tempfile
from datetime import date, datetime, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from src.contract import HOURLY_METRIC_KEYS, SCHEMA_VERSION, validate_weather_payload_v1  # noqa: E402
from src.web.static_site_builder import BUNDLE_MANIFEST_FILENAME  # noqa: E402

START = date(2026, 1, 12)
DAYS = 15
HOURS = 168
MARKER = ".closesnow-mock-theme-preview"
# Each row repeats independently so the same values appear across every table.
CASES = (
    ("clear", "Zero precipitation", [0], [0], [2, 4, 8, 12, 20, 25, 0]),
    ("light-snow", "Light snow", [0, 0.1, 0.5, 1, 2, 4, 6], [0], [-8, -4, -1, 0, 2]),
    ("heavy-snow", "Heavy snow", [0, 2, 6, 10, 15, 18, 30, 45], [0], [-15, -10, -6, -3, 0]),
    ("rain", "Rain intensity", [0], [0, 0.2, 1, 3, 5, 7.6, 10, 20, 35], [4, 6, 10, 15, 22]),
    ("mixed", "Mixed snow and rain", [2, 6, 15, 20, 0, 3, 8], [3, 5, 10, 15, 20, 0, 1], [-2, 0, 2, 5]),
    ("temperature", "Cold to warm", [0], [0], [-25, -15, -10, -5, -1, 0, 4, 10, 20, 25]),
    ("partial", "Missing observations", [None, 0, 3, None, 18], [None, 0, 2, None, 8], [None, -5, 0, None, 12]),
    ("missing", "All data missing", [None], [None], [None]),
)


def daily_rows(case: tuple, *, history: bool = False) -> list[dict]:
    _, _, snow_values, rain_values, temp_values = case
    rows = []
    for index in range(14 if history else DAYS):
        day = START + timedelta(days=index - 14 if history else index)
        snow = snow_values[index % len(snow_values)]
        rain = rain_values[index % len(rain_values)]
        high = temp_values[index % len(temp_values)]
        missing = snow is None and rain is None and high is None
        weather = None if missing else 73 if snow else 63 if rain else [0, 1, 3, 45][index % 4]
        rows.append(
            {
                "date": day.isoformat(),
                "snowfall_cm": snow,
                "rain_mm": rain,
                "precipitation_mm": None if missing else round((snow or 0) + (rain or 0), 1),
                "temperature_max_c": high,
                "temperature_min_c": None if high is None else high - 7,
                "above_0": None if high is None else int(high > 0),
                "weather_code": weather,
                "sunrise_iso": None if missing else f"{day}T07:{10 + index:02d}",
                "sunset_iso": None if missing else f"{day}T17:{20 + index:02d}",
                "sunrise_local_hhmm": None if missing else f"07:{10 + index:02d}",
                "sunset_local_hhmm": None if missing else f"17:{20 + index:02d}",
            }
        )
    return rows


def weekly_total(rows: list[dict], metric: str, start: int) -> float | None:
    values = [row[metric] for row in rows[start : start + 7] if row[metric] is not None]
    return round(sum(values), 2) if values else None


def report_for(case: tuple, index: int) -> dict:
    case_id, label, *_ = case
    rows = daily_rows(case)
    return {
        "resort_id": f"mock-{case_id}",
        "query": f"Mock · {label}",
        "display_name": f"Mock · {label}",
        "matched_name": f"Mock · {label}",
        "country": "United States",
        "country_code": "US",
        "admin1": f"Mock QA {index + 1:02d}",
        "region": "north-america",
        "subregion": "usa-west",
        "pass_types": ["ikon" if index % 2 else "epic"],
        "default_resort": True,
        "model": "synthetic-theme-qa",
        "forecast_timezone": "America/Denver",
        "input_latitude": 40.0 + index / 10,
        "input_longitude": -110.0,
        "resolved_latitude": 40.0 + index / 10,
        "resolved_longitude": -110.0,
        "week1_total_snowfall_cm": weekly_total(rows, "snowfall_cm", 0),
        "week2_total_snowfall_cm": weekly_total(rows, "snowfall_cm", 7),
        "week1_total_rain_mm": weekly_total(rows, "rain_mm", 0),
        "week2_total_rain_mm": weekly_total(rows, "rain_mm", 7),
        "daily": rows,
        "past_14d_daily": daily_rows(case, history=True),
        "nearby_airports": [
            {
                "airport_id": "mock-airport",
                "iata_code": "MCK",
                "display_name": "Mock Mountain Airport",
                "location_label": "Synthetic QA location",
                "latitude": 40.5,
                "longitude": -110.5,
                "distance_miles": 24.5,
            }
        ],
    }


def hourly_for(report: dict) -> dict:
    series: dict[str, list] = {"time": []}
    series.update({key: [] for key in HOURLY_METRIC_KEYS})
    start = datetime.combine(START, datetime.min.time())
    depth = 1.2
    for index in range(HOURS):
        day = report["daily"][index // 24]
        missing = report["resort_id"] == "mock-missing" or (
            report["resort_id"] == "mock-partial" and index % 24 in (0, 1, 9, 10, 11)
        )
        snow = round((day["snowfall_cm"] or 0) * max(0, math.sin(index / 6)) / 8, 2)
        rain = round((day["rain_mm"] or 0) * max(0, math.sin(index / 5 + 1)) / 8, 2)
        depth += snow / 100
        values = {
            "snowfall": snow,
            "rain": rain,
            "precipitation_probability": round(15 + 80 * max(0, math.sin(index / 10))),
            "snow_depth": round(depth, 2),
            "wind_speed_10m": round(15 + 12 * math.sin(index / 8), 1),
            "wind_direction_10m": (index * 13 + 40) % 360,
            "visibility": round(max(150, 14000 - snow * 1600 - rain * 1100 - 2500 * math.sin(index / 9))),
        }
        series["time"].append((start + timedelta(hours=index)).isoformat(timespec="minutes"))
        for metric in HOURLY_METRIC_KEYS:
            series[metric].append(None if missing else values[metric])
    return {
        key: report[key]
        for key in (
            "resort_id",
            "query",
            "display_name",
            "model",
            "input_latitude",
            "input_longitude",
            "nearby_airports",
        )
    } | {"timezone": report["forecast_timezone"], "hours": HOURS, "hourly": series}


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def label_mock_page(path: Path) -> None:
    """Keep mock-only labels and indexing/analytics policy out of app templates."""
    html = path.read_text(encoding="utf-8")
    html = re.sub(
        r"<script\b[^>]*>.*?</script>",
        lambda match: (
            "" if any(key in match[0] for key in ("googletagmanager.com", "window.dataLayer", "gtag(")) else match[0]
        ),
        html,
        flags=re.DOTALL,
    )
    html = html.replace("<!-- Google tag (gtag.js) -->", "")
    html = html.replace("</head>", '<meta name="robots" content="noindex, nofollow" />\n</head>')
    html = html.replace("CloseSnow · Mountain forecast</title>", "CloseSnow · Mock theme preview</title>")
    html = re.sub(
        r'<div class="report-powered">.*?</div>',
        '<div class="report-powered">Synthetic data · Fixed January 2026 scenarios</div>',
        html,
    )
    banner = (
        '<aside role="note" aria-label="Mock weather preview" '
        'style="padding:12px 16px;text-align:center;background:var(--accent-soft);'
        'border-bottom:1px solid var(--accent-border);color:var(--ink-950)">'
        "<strong>Mock weather · Theme preview</strong> — Synthetic scenarios for visual review. "
        "Not a weather forecast.</aside>"
    )
    html = html.replace("</header>", f"</header>\n{banner}", 1)
    path.write_text(html, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output-dir", type=Path, default=Path(tempfile.gettempdir()) / "closesnow-theme-preview")
    args = parser.parse_args()
    output_dir = args.output_dir.resolve()
    if output_dir.exists() and any(output_dir.iterdir()) and not (output_dir / MARKER).is_file():
        parser.error(f"Refusing to replace non-preview directory {output_dir}; choose a new or empty directory.")
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / MARKER).write_text("Synthetic theme QA data. Not a weather forecast.\n", encoding="utf-8")
    reports = [report_for(case, index) for index, case in enumerate(CASES)]
    payload = {
        "schema_version": SCHEMA_VERSION,
        "generated_at_utc": f"{START}T12:00:00Z",
        "source": "Mock theme QA — synthetic data, not a weather forecast",
        "model": "synthetic-theme-qa",
        "forecast_days": DAYS,
        "units": {
            "snowfall_cm": "cm",
            "rain_mm": "mm",
            "precipitation_mm": "mm",
            "temperature_max_c": "celsius",
            "temperature_min_c": "celsius",
        },
        "cache": {"file": "", "hits": 0, "misses": 0, "geocode_cache_hours": 0, "forecast_cache_hours": 0},
        "resorts_count": len(reports),
        "failed_count": 0,
        "failed": [],
        "reports": reports,
    }
    validate_weather_payload_v1(payload)
    write_json(output_dir / "data.json", payload)
    for report in reports:
        write_json(output_dir / "resort" / report["resort_id"] / "hourly.json", hourly_for(report))
    write_json(
        output_dir / BUNDLE_MANIFEST_FILENAME,
        {
            "schema_version": "closesnow_static_bundle_v1",
            "daily_json": "data.json",
            "hourly_hours": HOURS,
            "hourly": {report["resort_id"]: f"resort/{report['resort_id']}/hourly.json" for report in reports},
            "missing_hourly": [],
        },
    )
    command = [
        sys.executable,
        "-m",
        "src.cli",
        "static",
        "--skip-fetch",
        "--max-workers",
        "8",
        "--output-dir",
        str(output_dir),
    ]
    subprocess.run(command, cwd=REPO_ROOT, check=True)
    label_mock_page(output_dir / "index.html")
    for report in reports:
        label_mock_page(output_dir / "resort" / report["resort_id"] / "index.html")
    print(f"Mock theme preview: {output_dir}")
    print("8 mock resorts; 15 forecast days; 14 history days; 168 hourly samples per resort.")
    print("Review all 6 tabs, both unit systems, Day/Night, and /resort/mock-heavy-snow/ plus /resort/mock-missing/.")
    print(f"Serve: python3 -m http.server 8012 --directory {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
