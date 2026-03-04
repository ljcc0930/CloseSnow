# CloseSnow

CloseSnow is a ski resort weather toolkit built on Open-Meteo ECMWF IFS 0.25.
It fetches a unified 15-day payload (snow, rain, temperature, weather code, sunrise/sunset), then serves or renders forecast pages from the same contract.

## Highlights

- Unified payload contract: `weather_payload_v1`
- Unified CLI: `fetch`, `render`, `static`, `serve`, `serve-data`, `serve-web`
- Static site generation (`index.html`) plus per-resort hourly pages (`/resort/<resort_id>/`)
- Dynamic web mode and decoupled deployment mode
- Resort catalog metadata support (`pass_types`, `region`, `country`, `default_enabled`)
- Search/filter/sort controls in frontend and matching backend query filters
- Per-table unit toggles (`cm/in`, `mm/in`, `C/F`) persisted in browser
- Concurrency support via `--max-workers`
- Date-suffixed API cache + persistent coordinate cache

## Requirements

- Python `3.9+`
- Main code in `src/` uses Python standard library only
- Optional dependencies in `requirements.txt` are for `legacy/` scripts

## Quick Start

### 1) One-shot static build (recommended)

```bash
python3 -m src.cli static --output-json site/data.json --output-html site/index.html
mkdir -p site/assets
cp -R assets/css site/assets/
cp -R assets/js site/assets/
```

Then open `site/index.html` (or deploy `site/`).

### 2) Split static pipeline

```bash
python3 -m src.cli fetch --output-json site/data.json
python3 -m src.cli render --input-json site/data.json --output-html site/index.html
mkdir -p site/assets
cp -R assets/css site/assets/
cp -R assets/js site/assets/
```

### 3) Coupled dynamic server

```bash
python3 -m src.cli serve --host 127.0.0.1 --port 8010
```

- Page: `http://127.0.0.1:8010/`
- Payload: `http://127.0.0.1:8010/api/data`
- Hourly API: `http://127.0.0.1:8010/api/resort-hourly?resort_id=snowbird-ut&hours=72`

### 4) Decoupled deployment (backend + frontend)

Terminal A:

```bash
python3 -m src.cli serve-data --host 127.0.0.1 --port 8020
```

Terminal B:

```bash
python3 -m src.cli serve-web \
  --host 127.0.0.1 \
  --port 8010 \
  --data-mode api \
  --data-source http://127.0.0.1:8020/api/data
```

- Frontend: `http://127.0.0.1:8010/`
- Frontend health: `http://127.0.0.1:8010/api/health`
- Backend health: `http://127.0.0.1:8020/api/health`

## CLI Reference

### `fetch`

Fetch payload and write JSON artifact.

```bash
python3 -m src.cli fetch \
  [--resort "Snowbird, UT"] \
  [--resorts-file resorts.yml] \
  [--cache-file .cache/open_meteo_cache.json] \
  [--geocode-cache-hours 720] \
  [--forecast-cache-hours 3] \
  [--max-workers 8] \
  [--output-json site/data.json]
```

### `render`

Render HTML from payload JSON.

```bash
python3 -m src.cli render \
  [--input-json site/data.json] \
  [--output-html index.html]
```

Notes:

- Validates payload contract before rendering.
- Also generates per-resort hourly HTML routes (`resort/<resort_id>/index.html`).
- Does not embed hourly JSON data by default.

### `static`

Fetch + render in one command.

```bash
python3 -m src.cli static \
  [--resort "Snowbird, UT"] \
  [--resorts-file resorts.yml] \
  [--cache-file .cache/open_meteo_cache.json] \
  [--geocode-cache-hours 720] \
  [--forecast-cache-hours 3] \
  [--max-workers 8] \
  [--output-json .cache/static_payload.json] \
  [--output-html index.html] \
  [--skip-fetch] \
  [--skip-render]
```

Notes:

- `--resort` is repeatable. If provided, `--resorts-file` is ignored.
- `--skip-fetch`: reuse existing `--output-json`.
- `--skip-render`: refresh payload only.
- When rendering, generates per-resort hourly pages and writes `hourly.json` for each resort route.

### `serve`

Coupled dynamic server (frontend + in-process local backend).

```bash
python3 -m src.cli serve [--host 127.0.0.1] [--port 8010] [...]
```

### `serve-data`

Backend API server only.

```bash
python3 -m src.cli serve-data [--host 127.0.0.1] [--port 8020] [...] [--allow-origin *]
```

### `serve-web`

Frontend web server with data source mode.

```bash
python3 -m src.cli serve-web \
  [--host 127.0.0.1] \
  [--port 8010] \
  [--data-mode api|file|local] \
  [--data-source http://127.0.0.1:8020/api/data] \
  [--data-timeout 20]
```

Notes:

- CLI default `--data-mode` is `api`.
- `--data-source` default is `CLOSESNOW_DATA_URL`, fallback `http://127.0.0.1:8020/api/data`.

## HTTP Endpoints

### Backend API (`serve-data`)

- `GET /api/data`
- `GET /api/resorts`
- `GET /api/resort-hourly`
- `GET /api/health`
- `OPTIONS *` (CORS preflight)

`/api/data` query parameters:

- `resort` (repeatable)
- `pass_type` (repeatable or comma-separated)
- `region` (`west|east|intl`)
- `country` (ISO-2)
- `search` (free text)
- `include_all` (`1|true|yes|on`)

`/api/resort-hourly` query parameters:

- `resort_id` (required)
- `hours` (`1..240`, default `72`)

### Frontend server (`serve` / `serve-web`)

- `GET /`
- `GET /api/data`
- `GET /api/resort-hourly`
- `GET /api/health`
- `GET /resort/<resort_id>`
- `GET /assets/css/*`, `GET /assets/js/*`

## Resort Catalog

Default resort source is `resorts.yml` (repo root), loaded as JSON array.

Entry fields:

- `resort_id`
- `query`
- `name`
- `state`
- `country`
- `region`
- `pass_types` (`ikon|epic|indy`)
- `default_enabled` (controls default inclusion when no filters request full catalog)

`resorts.txt` is still supported by catalog loader, but main defaults point to `resorts.yml`.

## Static Output Structure

When output is `site/index.html`, generated files are:

- `site/index.html`
- `site/data.json` (if using `fetch` or `static` with that path)
- `site/resort/<resort_id>/index.html`
- `site/resort/<resort_id>/hourly.json` (only when hourly data embedding is enabled, e.g. `cli static`)
- `site/assets/css/*` and `site/assets/js/*` (copy from repo `assets/`)

## Payload Contract (`weather_payload_v1`)

Top-level keys:

- `schema_version`
- `generated_at_utc`
- `source`
- `model`
- `forecast_days`
- `units`
- `cache`
- `resorts_count`
- `failed_count`
- `failed`
- `reports`

Validated by `src/contract/validators.py`.

## Cache Behavior

- API cache base: `.cache/open_meteo_cache.json`
- Runtime cache file: `.cache/open_meteo_cache_YYYY-MM-DD.json`
- Coordinate cache: `.cache/resort_coordinates.json`
- Default TTL:
  - geocode: `720` hours
  - forecast: `3` hours

## Testing

Run all tests:

```bash
python3 -m pytest -q
```

By layer:

```bash
python3 -m pytest tests/backend -q
python3 -m pytest tests/frontend -q
python3 -m pytest tests/integration -q
python3 -m pytest tests/smoke -q
```

By marker:

```bash
python3 -m pytest -m smoke -q
python3 -m pytest -m integration -q
```

## Compatibility Entrypoints

Legacy-compatible entrypoint (still maintained):

```bash
python3 -m src.backend.ecmwf_unified_backend
```

Default artifacts:

- `.cache/resorts_weather_unified.json`
- `.cache/resorts_snowfall_daily.csv`
- `.cache/resorts_rainfall_daily.csv`
- `.cache/resorts_temperature_daily.csv`

## Resort Catalog Sync Scripts

- `scripts/sync_resorts_catalog.py`
- `scripts/sync_pass_resorts.py` (wrapper)

Examples:

```bash
python3 scripts/sync_resorts_catalog.py --validate-only
python3 scripts/sync_resorts_catalog.py --input resorts.yml --output resorts.yml
```

`sync_resorts_catalog.py` merges Ikon/Epic/Indy sources, preserves existing defaults, and validates catalog integrity + pass coverage.

## GitHub Pages Workflow

Workflow: `.github/workflows/deploy-pages.yml`

Triggers:

- `workflow_dispatch`
- push to `main`
- hourly schedule (`1 * * * *`)

Build command:

```bash
python -m src.cli static --output-json site/data.json --output-html site/index.html --max-workers 8
mkdir -p site/assets
cp -R assets/css site/assets/
cp -R assets/js site/assets/
```

## Legacy Scripts

`legacy/` contains historical/specialized flows:

- `legacy/ecmwf_ski_forecast.py`
- `legacy/ecmwf_rain_pipeline.py`
- `legacy/ecmwf_temperature_table.py`
- `legacy/ecmwf_snowfall_opendata.py`
- `legacy/colorize_weather_excel.py`

Install optional dependencies for those scripts:

```bash
pip install -r requirements.txt
```

## Architecture Docs

- `docs/FRONTEND_BACKEND_FLOW_ARCHITECTURE.md`
- `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`
- `docs/CODEBASE_VALIDATION_PLAYBOOK.md`
- `docs/FEATURE_DESIGN_SKI_WEATHER_FULL_INFO.md`
- `docs/REFACTOR_PROGRESS_LEDGER.md`

## License

MIT (see `LICENSE`).
