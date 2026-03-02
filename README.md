# Ski Weather Pipeline

This workspace now uses a unified backend pipeline for ski weather data (ECMWF via Open-Meteo).

## What is included

- Unified backend (importable): `ecmwf_unified_backend.py`
- Dynamic page server (runs pipeline on page load): `weather_page_server.py`
- Static page renderer (from CSV): `render_weather_web.py`

## Unified backend

File: `ecmwf_unified_backend.py`

Resort list file: `resorts.txt`

- Default behavior is to read resorts from `resorts.txt`.
- You can still override with `--resort ...` or `--resorts-file ...`.

### Key behavior

- Single forecast request per resort for all metrics:
  - snowfall
  - rainfall
  - temperature
- Cache-first behavior:
  - cache hit -> read local cache
  - cache miss -> call API
- Daily cache file naming:
  - base `.cache/open_meteo_cache.json`
  - actual: `.cache/open_meteo_cache_YYYY-MM-DD.json`
  - new day => automatically uses a new cache file

### Import usage

```python
from ecmwf_unified_backend import run_pipeline

result = run_pipeline(
    resorts=["snowbasin, ut", "snowbird, ut"],
    use_default_resorts=False,
    write_outputs=False,
)
print(result["resorts_count"], result["failed_count"])
```

### CLI usage

```bash
python3 ecmwf_unified_backend.py
```

Outputs by default:

- `.cache/resorts_weather_unified.json`
- `.cache/resorts_snowfall_daily.csv`
- `.cache/resorts_rainfall_daily.csv`
- `.cache/resorts_temperature_daily.csv`

## Dynamic page server

File: `weather_page_server.py`

This is not a pre-generated HTML workflow.
Each page load runs the unified pipeline directly by import.

### Start

```bash
python3 weather_page_server.py --port 8010
```

### Open

- Page: `http://127.0.0.1:8010/`
- Raw data: `http://127.0.0.1:8010/api/data`

Optional query params (repeatable):

- `?resort=snowbasin,%20ut&resort=snowbird,%20ut`

## Static renderer

File: `render_weather_web.py`

Renders from CSV files into `weather_report.html`.

```bash
python3 render_weather_web.py \
  --snowfall-csv .cache/resorts_snowfall_daily.csv \
  --rain-csv .cache/resorts_rainfall_daily.csv \
  --temperature-csv .cache/resorts_temperature_daily.csv \
  --output-html weather_report.html
```

## Notes

- All local servers started in this thread have been stopped.
- If you want one-command startup later, we can add a small `Makefile` with targets like `run`, `serve`, and `render`.
