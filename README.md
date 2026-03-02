# CloseSnow

A ski resort weather toolkit powered by ECMWF data.
The main workflow uses **Open-Meteo ECMWF IFS 0.25** and fetches 14-day snowfall, rainfall, and temperature data in a single forecast request per resort.

## Core Workflow

- `ecmwf_unified_backend.py`: unified backend (primary entrypoint, recommended)
- `weather_page_server.py`: dynamic web page (runs backend on each request, cache-aware)
- `weather_page_static_render.py`: static page renderer (uses the same payload-to-HTML logic as dynamic server)
- `weather_report_transform.py`: shared report-to-table transformation helpers
- `weather_html_renderer.py`: shared HTML rendering helpers

## Quick Start

1. Prepare Python (3.9+ recommended).
2. Install dependencies if you need legacy tools.
3. Run the unified backend:

```bash
python3 ecmwf_unified_backend.py
```

If you only use the core workflow, no third-party package install is required.

If you also use scripts under `legacy/`:

```bash
pip install -r requirements.txt
```

Default outputs:
- `.cache/resorts_weather_unified.json`
- `.cache/resorts_snowfall_daily.csv`
- `.cache/resorts_rainfall_daily.csv`
- `.cache/resorts_temperature_daily.csv`

## Resorts Input

- By default, resorts are read from `resorts.txt` (one resort per line, `#` comments supported).
- You can also provide:
  - `--resort "snowbasin, ut"` (repeatable)
  - `--resorts-file path/to/file.txt`
  - `--use-default-resorts` (use built-in script defaults)

## Unified Backend

Script: `ecmwf_unified_backend.py`

```bash
python3 ecmwf_unified_backend.py \
  --resorts-file resorts.txt \
  --forecast-cache-hours 3 \
  --geocode-cache-hours 720
```

Import usage:

```python
from ecmwf_unified_backend import run_pipeline

result = run_pipeline(
    resorts=["snowbasin, ut", "snowbird, ut"],
    use_default_resorts=False,
    write_outputs=False,
)
print(result["resorts_count"], result["failed_count"])
```

## Cache Behavior

- Cache-first: cache hit reads local data; cache miss triggers an API call.
- Cache files are date-partitioned automatically:
  - Base name: `.cache/open_meteo_cache.json`
  - Actual file: `.cache/open_meteo_cache_YYYY-MM-DD.json`
- Default TTL:
  - geocode: 30 days
  - forecast: 3 hours

## Dynamic Web Server

Script: `weather_page_server.py`

```bash
python3 weather_page_server.py --host 127.0.0.1 --port 8010
```

- Page: `http://127.0.0.1:8010/`
- Raw JSON: `http://127.0.0.1:8010/api/data`
- You can pass resorts via query params (repeatable):
  - `/?resort=snowbasin,%20ut&resort=snowbird,%20ut`

## Static HTML Renderer

Script: `weather_page_static_render.py`

```bash
python3 weather_page_static_render.py \
  --resorts-file resorts.txt \
  --forecast-cache-hours 3 \
  --geocode-cache-hours 720 \
  --output-html index.html
```

Or pass resorts directly (repeatable):

```bash
python3 weather_page_static_render.py \
  --resort "snowbasin, ut" \
  --resort "snowbird, ut" \
  --output-html index.html
```

- Default output path is `index.html` (good for GitHub Pages root publishing).

## GitHub Pages Automation

- Workflow file: `.github/workflows/deploy-pages.yml`
- Trigger:
  - manual (`workflow_dispatch`)
  - push to `main`
  - scheduled daily at **00:01 America/Los_Angeles**
- The workflow runs `weather_page_static_render.py` and deploys `site/index.html` to GitHub Pages.

## Legacy/Utility Scripts

These scripts are still available but are no longer the recommended primary path:

- `legacy/ecmwf_ski_forecast.py`: snowfall only (Open-Meteo)
- `legacy/ecmwf_rain_pipeline.py`: rainfall only (Open-Meteo)
- `legacy/ecmwf_temperature_table.py`: temperature only (Open-Meteo)
- `legacy/ecmwf_snowfall_opendata.py`: ECMWF Open Data GRIB snowfall flow
- `legacy/colorize_weather_excel.py`: generate a colorized Excel workbook from snowfall/temperature CSV files

## Optional Dependencies

The main workflow (unified backend + dynamic server + HTML renderer) uses only Python standard libraries.
Optional scripts require additional packages:

- `openpyxl` (Excel colorization)
- `numpy` `xarray` `cfgrib` `ecmwf-opendata` (Open Data GRIB flow)

Example:

```bash
pip install -r requirements.txt
```

## License

MIT, see `LICENSE`.
