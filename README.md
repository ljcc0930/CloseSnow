# CloseSnow

A ski resort weather toolkit powered by ECMWF data.
The main workflow uses **Open-Meteo ECMWF IFS 0.25** and fetches 14-day snowfall, rainfall, and temperature data in a single forecast request per resort.

## Core Workflow

- `ecmwf_unified_backend.py`: unified backend (primary entrypoint, recommended)
- `weather_page_server.py`: dynamic web page (runs backend on each request, cache-aware)
- `render_weather_web.py`: static page renderer (builds `weather_report.html` from CSV files)

## Quick Start

1. Prepare Python (3.9+ recommended).
2. Install dependencies as needed (main workflow uses only the standard library; optional tools are listed below).
3. Run the unified backend:

```bash
python3 ecmwf_unified_backend.py
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

Script: `render_weather_web.py`

```bash
python3 render_weather_web.py \
  --snowfall-csv .cache/resorts_snowfall_daily.csv \
  --rain-csv .cache/resorts_rainfall_daily.csv \
  --temperature-csv .cache/resorts_temperature_daily.csv \
  --output-html weather_report.html
```

## Legacy/Utility Scripts

These scripts are still available but are no longer the recommended primary path:

- `ecmwf_ski_forecast.py`: snowfall only (Open-Meteo)
- `ecmwf_rain_pipeline.py`: rainfall only (Open-Meteo)
- `ecmwf_temperature_table.py`: temperature only (Open-Meteo)
- `ecmwf_snowfall_opendata.py`: ECMWF Open Data GRIB snowfall flow
- `colorize_weather_excel.py`: generate a colorized Excel workbook from snowfall/temperature CSV files

## Optional Dependencies

The main workflow (unified backend + dynamic server + HTML renderer) uses only Python standard libraries.
Optional scripts require additional packages:

- `openpyxl` (Excel colorization)
- `numpy` `xarray` `cfgrib` `ecmwf-opendata` (Open Data GRIB flow)

Example:

```bash
pip install openpyxl numpy xarray cfgrib ecmwf-opendata
```

## License

MIT, see `LICENSE`.
