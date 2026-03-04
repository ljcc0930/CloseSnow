# CloseSnow

CloseSnow is a ski resort weather toolkit powered by Open-Meteo ECMWF IFS 0.25.
Its core flow fetches 15-day forecast data per resort in one pipeline and outputs snowfall, rain, and temperature together.

## Highlights

- Generate 15-day ski weather reports for multiple resorts in one run (snowfall, rainfall, temperature).
- Export results as unified JSON plus daily CSV tables for downstream use.
- Serve the report as either dynamic web page (`/` + `/api/data`) or pre-rendered static HTML (`index.html`).
- Support desktop/mobile table layouts with synced scrolling for large forecast grids.
- Provide per-table unit switching (snow: `cm/in`, rain: `mm/in`, temperature: `°C/°F`) with saved browser preference.
- Fetch resort data concurrently with configurable worker count (`--max-workers`).

## Repository Layout

```text
.
├── src
│   ├── cli.py
│   ├── contract
│   │   ├── weather_payload_v1.py
│   │   └── validators.py
│   ├── backend
│   │   ├── constants.py
│   │   ├── models.py
│   │   ├── cache.py
│   │   ├── open_meteo.py
│   │   ├── report_builder.py
│   │   ├── writers.py
│   │   ├── pipeline.py
│   │   ├── ecmwf_unified_backend.py
│   │   ├── services
│   │   │   └── weather_service.py
│   │   └── pipelines
│   │       ├── live_pipeline.py
│   │       └── static_pipeline.py
│   └── web
│       ├── weather_page_server.py
│       ├── weather_page_static_render.py
│       ├── weather_page_render_core.py
│       ├── weather_html_renderer.py
│       ├── weather_report_transform.py
│       ├── weather_page_assets.py
│       ├── weather_table_renderer.py
│       ├── weather_table_styles.py
│       ├── data_sources
│       │   ├── static_json_source.py
│       │   ├── api_source.py
│       │   └── source_selector.py
│       ├── desktop
│       │   ├── snowfall_renderer.py
│       │   ├── rainfall_renderer.py
│       │   └── temperature_renderer.py
│       └── mobile
│           ├── snowfall_renderer.py
│           └── rainfall_renderer.py
├── assets
│   ├── css/weather_page.css
│   └── js/weather_page.js
├── resorts.txt
├── legacy
│   ├── ecmwf_ski_forecast.py
│   ├── ecmwf_rain_pipeline.py
│   ├── ecmwf_temperature_table.py
│   ├── ecmwf_snowfall_opendata.py
│   └── colorize_weather_excel.py
└── .github/workflows/deploy-pages.yml
```

## Requirements

- Python 3.9+
- Main flow (`src/`) uses Python standard library only
- `legacy/` scripts require extra packages (see `requirements.txt`)

## Quick Start (Recommended: Unified CLI)

### 1) One-shot static render (fetch + render)

```bash
python3 -m src.cli static --output-html index.html
```

### 2) Split static pipeline (optional: fetch then render)

```bash
python3 -m src.cli fetch --output-json site/data.json
python3 -m src.cli render --input-json site/data.json --output-html site/index.html
```

### 3) Run dynamic server

```bash
python3 -m src.cli serve --host 127.0.0.1 --port 8010
```

Open:

- Page: `http://127.0.0.1:8010/`
- Raw JSON: `http://127.0.0.1:8010/api/data`

## CLI Commands

### `fetch`

```bash
python3 -m src.cli fetch \
  [--resort "snowbasin, ut"] \
  [--resorts-file resorts.txt] \
  [--cache-file .cache/open_meteo_cache.json] \
  [--geocode-cache-hours 720] \
  [--forecast-cache-hours 3] \
  [--max-workers 8] \
  [--output-json site/data.json]
```

Notes:

- Writes one validated contract payload JSON artifact.
- No HTML/CSV output in this command.

### `render`

```bash
python3 -m src.cli render \
  [--input-json site/data.json] \
  [--output-html index.html]
```

Notes:

- Reads payload JSON from disk, validates schema, then renders HTML.
- Useful when backend fetch and frontend render are run as separate stages.

### `static`

```bash
python3 -m src.cli static \
  [--resort "snowbasin, ut"] \
  [--resorts-file resorts.txt] \
  [--cache-file .cache/open_meteo_cache.json] \
  [--geocode-cache-hours 720] \
  [--forecast-cache-hours 3] \
  [--max-workers 8] \
  [--output-json .cache/static_payload.json] \
  [--skip-fetch] \
  [--skip-render] \
  [--output-html index.html]
```

Notes:

- `--resort` is repeatable; if provided, `--resorts-file` is ignored.
- Default behavior is fetch + render in one command.
- `--skip-fetch` reuses `--output-json`; `--skip-render` only refreshes payload.
- Still no CSV output in this command.

### `serve`

```bash
python3 -m src.cli serve \
  [--host 127.0.0.1] \
  [--port 8010] \
  [--cache-file .cache/open_meteo_cache.json] \
  [--geocode-cache-hours 720] \
  [--forecast-cache-hours 3] \
  [--max-workers 8]
```

Notes:

- Each request fetches payload via live backend pipeline and returns contract JSON at `/api/data`.
- You can override resorts by query params:

```text
/?resort=snowbasin,%20ut&resort=snowbird,%20ut
```

## Run Modules Directly

If you do not want to use the unified CLI, you can run modules directly.

## Architecture (Refactor State)

- Backend produces a single payload contract (`weather_payload_v1`).
- Communication layer validates and loads payload from file or API (`src/web/data_sources`).
- Frontend renderer consumes contract payload only (`render_payload_html` path shared by static/dynamic).

## Frontend Rendering Structure

- `src/web/weather_table_renderer.py` is the table composition entrypoint.
- Renderers are separated by platform folders:
  - Desktop: `src/web/desktop/`
  - Mobile: `src/web/mobile/`
- Snowfall and rainfall both have desktop + mobile renderers.
- Temperature currently has desktop renderer only:
  - `src/web/desktop/temperature_renderer.py`
- If a mobile renderer is missing, rendering automatically falls back to desktop.
- Rainfall and snowfall both render `weekly + daily` sections.
- Shared table cell style logic (snow/rain/temp color mapping and numeric parsing):
  - `src/web/weather_table_styles.py`
- Runtime mode switch remains in browser JS:
  - `assets/js/weather_page.js` toggles `body.mobile-simple`
  - `assets/css/weather_page.css` controls `.desktop-only` / `.mobile-only`
- Unit conversion switch is also in browser JS:
  - each table has its own unit toggle (`cm/in`, `mm/in`, `°C/°F`)
  - displayed values are converted client-side from metric source values
  - saved unit modes are restored before page reveal to avoid loading flicker

### Unified backend (writes JSON/CSV)

```bash
python3 -m src.backend.ecmwf_unified_backend \
  --resorts-file resorts.txt \
  --forecast-cache-hours 3 \
  --geocode-cache-hours 720 \
  --max-workers 8
```

Default outputs:

- `.cache/resorts_weather_unified.json`
- `.cache/resorts_snowfall_daily.csv`
- `.cache/resorts_rainfall_daily.csv`
- `.cache/resorts_temperature_daily.csv`

### Dynamic server

```bash
python3 -m src.web.weather_page_server --host 127.0.0.1 --port 8010 --max-workers 8
```

### Static renderer

```bash
python3 -m src.web.weather_page_static_render --output-html index.html --max-workers 8
```

## Resort Input Rules

- Default input file is repository root `resorts.txt`
- File format: one resort per line; `#` comments are supported
- Backend deduplicates resorts while preserving order
- If no valid resort is provided:
  - unified backend falls back to built-in `DEFAULT_RESORTS`

The current list includes ski resorts that ljcc prefers; since he only has an Ikon Pass, only Ikon Pass resorts are included.

## Cache Behavior

- Default cache base name: `.cache/open_meteo_cache.json`
- Actual cache file is date-suffixed: `.cache/open_meteo_cache_YYYY-MM-DD.json`
- Default TTL:
  - geocode: 30 days (720 hours)
  - forecast: 3 hours

## Python API Example

```python
from src.backend.pipelines.live_pipeline import run_live_payload

result = run_live_payload(
    resorts=["snowbasin, ut", "snowbird, ut"],
    resorts_file="",
    max_workers=8,
)

print(result["resorts_count"], result["failed_count"])
```

## GitHub Pages Automation

Workflow file: `.github/workflows/deploy-pages.yml`

Triggers:

- `workflow_dispatch`
- push to `main`
- schedule (hourly at minute 1)

Build steps:

- Run `python -m src.cli fetch --output-json site/data.json --max-workers 8`
- Run `python -m src.cli render --input-json site/data.json --output-html site/index.html`
- Copy `assets/css/weather_page.css` and `assets/js/weather_page.js` into `site/`
- Deploy `site/` to GitHub Pages

## Legacy Scripts

The following scripts are kept for historical/specialized workflows:

- `legacy/ecmwf_ski_forecast.py`: snowfall only (Open-Meteo)
- `legacy/ecmwf_rain_pipeline.py`: rainfall only (Open-Meteo)
- `legacy/ecmwf_temperature_table.py`: temperature only (Open-Meteo)
- `legacy/ecmwf_snowfall_opendata.py`: ECMWF Open Data + GRIB flow
- `legacy/colorize_weather_excel.py`: colorize snowfall/temperature CSV and export XLSX

Examples:

```bash
python3 legacy/ecmwf_ski_forecast.py --resorts-file resorts.txt
python3 legacy/ecmwf_rain_pipeline.py --resorts-file resorts.txt
python3 legacy/ecmwf_temperature_table.py --resorts-file resorts.txt
python3 legacy/ecmwf_snowfall_opendata.py --resort "snowbird, ut"
python3 legacy/colorize_weather_excel.py \
  --snowfall-csv .cache/resorts_snowfall_daily.csv \
  --temperature-csv .cache/resorts_temperature_daily.csv \
  --output-xlsx .cache/resorts_colored.xlsx
```

## Optional Dependencies (Legacy Only)

```bash
pip install -r requirements.txt
```

`requirements.txt` includes: `openpyxl`, `numpy`, `xarray`, `cfgrib`, `ecmwf-opendata`.

## License

MIT, see `LICENSE`.
