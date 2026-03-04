# CloseSnow

CloseSnow is a ski resort weather toolkit powered by Open-Meteo ECMWF IFS 0.25.
Its core flow fetches 15-day forecast data per resort in one pipeline and outputs snowfall, rain, and temperature together.

## Highlights

- Unified backend: one pipeline produces JSON + 3 CSV files
- Backend JSON now includes `past_14d_daily` per resort (last 14 completed days, via Forecast API `past_days`)
- Unified CLI: one entrypoint for static rendering and dynamic server
- Dynamic page: runs pipeline on request (cache hit reads local data)
- Static page: generates `index.html` for GitHub Pages
- Dual geocoding path: Open-Meteo first, Nominatim fallback
- Date-partitioned cache files: `*_YYYY-MM-DD.json`
- Google tag is embedded in page HTML: `G-V9NBX3H6M9`

## Repository Layout

```text
.
├── src
│   ├── cli.py
│   ├── backend
│   │   ├── constants.py
│   │   ├── models.py
│   │   ├── cache.py
│   │   ├── open_meteo.py
│   │   ├── report_builder.py
│   │   ├── writers.py
│   │   ├── pipeline.py
│   │   └── ecmwf_unified_backend.py
│   └── web
│       ├── weather_page_server.py
│       ├── weather_page_static_render.py
│       ├── weather_page_render_core.py
│       ├── weather_html_renderer.py
│       ├── weather_report_transform.py
│       ├── weather_page_assets.py
│       ├── weather_table_renderer.py
│       ├── weather_table_styles.py
│       ├── snowfall_desktop_renderer.py
│       └── snowfall_mobile_renderer.py
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

### 1) Render static HTML

```bash
python3 -m src.cli static --output-html index.html
```

### 2) Run dynamic server

```bash
python3 -m src.cli serve --host 127.0.0.1 --port 8010
```

Open:

- Page: `http://127.0.0.1:8010/`
- Raw JSON: `http://127.0.0.1:8010/api/data`

## CLI Commands

### `static`

```bash
python3 -m src.cli static \
  [--resort "snowbasin, ut"] \
  [--resorts-file resorts.txt] \
  [--cache-file .cache/open_meteo_cache.json] \
  [--geocode-cache-hours 720] \
  [--forecast-cache-hours 3] \
  [--output-html index.html]
```

Notes:

- `--resort` is repeatable; if provided, `--resorts-file` is ignored
- This command only writes HTML (no unified JSON/CSV outputs)

### `serve`

```bash
python3 -m src.cli serve \
  [--host 127.0.0.1] \
  [--port 8010] \
  [--cache-file .cache/open_meteo_cache.json] \
  [--geocode-cache-hours 720] \
  [--forecast-cache-hours 3]
```

Notes:

- Each request runs pipeline with `write_outputs=False`
- You can override resorts by query params:

```text
/?resort=snowbasin,%20ut&resort=snowbird,%20ut
```

## Run Modules Directly

If you do not want to use the unified CLI, you can run modules directly.

## Frontend Rendering Structure

- `src/web/weather_table_renderer.py` is the table composition entrypoint.
- Snowfall table layout is decoupled:
  - Desktop layout: `src/web/snowfall_desktop_renderer.py`
  - Mobile layout: `src/web/snowfall_mobile_renderer.py`
- Shared table cell style logic (snow/rain/temp color mapping and numeric parsing):
  - `src/web/weather_table_styles.py`
- Runtime mode switch remains in browser JS:
  - `assets/js/weather_page.js` toggles `body.mobile-simple`
  - `assets/css/weather_page.css` controls `.desktop-only` / `.mobile-only`

### Unified backend (writes JSON/CSV)

```bash
python3 -m src.backend.ecmwf_unified_backend \
  --resorts-file resorts.txt \
  --forecast-cache-hours 3 \
  --geocode-cache-hours 720
```

Default outputs:

- `.cache/resorts_weather_unified.json`
- `.cache/resorts_snowfall_daily.csv`
- `.cache/resorts_rainfall_daily.csv`
- `.cache/resorts_temperature_daily.csv`

### Dynamic server

```bash
python3 -m src.web.weather_page_server --host 127.0.0.1 --port 8010
```

### Static renderer

```bash
python3 -m src.web.weather_page_static_render --output-html index.html
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
from src.backend.ecmwf_unified_backend import run_pipeline

result = run_pipeline(
    resorts=["snowbasin, ut", "snowbird, ut"],
    use_default_resorts=False,
    write_outputs=False,
)

print(result["resorts_count"], result["failed_count"])
```

## GitHub Pages Automation

Workflow file: `.github/workflows/deploy-pages.yml`

Triggers:

- `workflow_dispatch`
- push to `main`
- schedule (daily at local `America/Los_Angeles` 00:01 with PST/PDT dual cron)

Build steps:

- Run `python -m src.web.weather_page_static_render --output-html site/index.html`
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
