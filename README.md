# CloseSnow

CloseSnow is a ski resort weather toolkit built on Open-Meteo ECMWF IFS 0.25.
It fetches one unified payload contract (`weather_payload_v1`) and reuses that contract for:

- Static site generation
- Dynamic page serving
- Decoupled backend API + frontend web deployment

## Highlights

- Unified CLI: `fetch`, `render`, `static`, `serve-static`, `serve`, `serve-data`, `serve-web`
- Unified payload contract (`weather_payload_v1`) with validator in `src/contract/validators.py`
- Main page sections: Daily Summary, Snowfall, Rainfall, Temperature, Weather (emoji), Sunrise/Sunset
- Per-resort hourly page: `/resort/<resort_id>` and hourly API `/api/resort-hourly`
- Main page is shell-first: lightweight `index.html` + client-side render from payload JSON
- Frontend filters are browser-side (URL state sync, no reload)
- Backend `/api/data` supports query-based filtering for API clients
- Resort catalog metadata (`resorts.yml`): `resort_id`, `query`, `display_name`, `website`, `pass_types`, `region`, `subregion`, `country`, `default_enabled`
- Concurrent resort processing via `--max-workers`
- Date-suffixed API cache + persistent coordinate cache

## Requirements

- Python `3.9+`
- Main workflow uses Python standard library only

## Repository Map

- `src/cli.py`: unified CLI entrypoint
- `src/backend/`: weather fetch pipeline, report builder, backend HTTP API
- `src/web/`: HTML rendering, page servers, data-source adapters
- `src/contract/`: payload contract schema + validator
- `assets/`: frontend CSS/JS
- `scripts/`: resort catalog sync/validation tooling
- `tests/`: backend/frontend/integration/smoke test suites
- `.github/workflows/deploy-pages.yml`: GitHub Pages build/deploy workflow

## Quick Start

### 1) One-shot static build (recommended)

```bash
python3 -m src.cli static --output-dir site
```

Open `site/index.html`.

Or build and preview the static site locally in one command:

```bash
python3 -m src.cli serve-static --directory site --host 127.0.0.1 --port 8011
```

This command also copies `assets/css` and `assets/js` into `site/assets/`.

Notes:

- This command uses default-enabled resorts from `resorts.yml`
- Add `--include-all-resorts` to include non-default resorts
- Per-resort static hourly pages are generated with sibling `hourly.json` files, so `site/resort/<resort_id>/` works on a plain static file server once `site/assets/` has been copied

### 2) Split static pipeline

```bash
python3 -m src.cli fetch --output-json site/data.json
python3 -m src.cli render --input-json site/data.json --output-dir site
```

Notes:

- `fetch` writes a complete bundle: the daily JSON, per-resort hourly JSON, and bundle metadata
- `render` is offline: it only reads that bundle, generates routes, and copies canonical web assets
- When `--output-dir` differs from the bundle directory, `render` copies the daily payload to
  `<output-dir>/data.json` and hourly payloads to `<output-dir>/resort/<resort_id>/hourly.json`
- If you serve `site/` over localhost, resort pages under `site/resort/<resort_id>/` will load from local `hourly.json` instead of requiring `/api/resort-hourly`

### 3) Coupled dynamic server

```bash
python3 -m src.cli serve --host 127.0.0.1 --port 8010
```

- Page: `http://127.0.0.1:8010/`
- Data: `http://127.0.0.1:8010/api/data`
- Hourly API: `http://127.0.0.1:8010/api/resort-hourly?resort_id=snowbird-ut&hours=72`

### 4) Decoupled deployment (recommended runtime split)

Terminal A (backend):

```bash
python3 -m src.cli serve-data --host 127.0.0.1 --port 8020
```

Terminal B (frontend):

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

Fetch daily and hourly payloads and write a reusable static bundle.

```bash
python3 -m src.cli fetch \
  [--resort "Snowbird, UT"] \
  [--resorts-file resorts.yml] \
  [--include-all-resorts] \
  [--cache-file .cache/open_meteo_cache.json] \
  [--geocode-cache-hours 720] \
  [--forecast-cache-hours 3] \
  [--api-retries 2] \
  [--max-workers 8] \
  [--output-json site/data.json]
```

The bundle root is the parent directory of `--output-json`. It contains the requested daily JSON,
`resort/<resort_id>/hourly.json`, and `.closesnow-static-bundle.json`. Use a distinct parent directory
for each concurrent fetch so the bundle roots do not overlap.

### `render`

Render HTML from payload JSON artifact.

```bash
python3 -m src.cli render \
  [--input-json site/data.json] \
  [--output-dir site]
```

Notes:

- Validates payload contract before rendering
- Performs no backend or network fetches
- Writes `index.html` and a canonical `data.json` into `--output-dir`
- Generates per-resort hourly HTML routes (`resort/<resort_id>/index.html`)
- Copies bundled `resort/<resort_id>/hourly.json` files and points each static hourly page at `./hourly.json`
- Copies and validates the assets declared by the canonical web asset manifest

### `static`

Fetch + render in one command.

```bash
python3 -m src.cli static \
  [--resort "Snowbird, UT"] \
  [--resorts-file resorts.yml] \
  [--include-all-resorts] \
  [--cache-file .cache/open_meteo_cache.json] \
  [--geocode-cache-hours 720] \
  [--forecast-cache-hours 3] \
  [--api-retries 2] \
  [--max-workers 8] \
  [--output-json site/data.json] \
  [--output-dir site] \
  [--skip-fetch] \
  [--skip-render]
```

Notes:

- `--resort` is repeatable; when set, `--include-all-resorts` is ignored
- Default `--output-json` resolves to `--output-dir/data.json`
- `index.html`, `resort/...`, and `assets/...` are written under `--output-dir`
- `--skip-fetch`: reuse an existing offline bundle
- `--skip-render`: refresh the daily and hourly bundle without rendering
- Runtime/cache/worker flags affect fetch only; render always consumes files from the bundle

### `serve`

Coupled frontend server (`data_mode=local`).

```bash
python3 -m src.cli serve [--host 127.0.0.1] [--port 8010] [...]
```

### `serve-static`

Run the static build pipeline and then serve the output directory such as `site/`.

```bash
python3 -m src.cli serve-static [--host 127.0.0.1] [--port 8011] [--directory site] [--max-workers 8]
```

Notes:

- By default this reuses the `static` workflow and writes `data.json` + `index.html` into the target directory before serving
- It inherits the static-fetch worker default, so daily/hourly fetch uses `8` workers unless `--max-workers` is provided
- It also copies repo `assets/css` and `assets/js` into `<directory>/assets/`
- Use `--skip-fetch` or `--skip-render` to reuse existing build artifacts with the same semantics as `static`
- Directory indexes work as expected, so generated resort pages under `site/resort/<resort_id>/` are reachable directly
- This is a plain file server; it does not provide `/api/data` or other dynamic endpoints

### `serve-data`

Backend API server only.

```bash
python3 -m src.cli serve-data [--host 127.0.0.1] [--port 8020] [...] [--allow-origin *]
```

### `serve-web`

Frontend server with selectable data source.

```bash
python3 -m src.cli serve-web \
  [--host 127.0.0.1] \
  [--port 8010] \
  [--data-mode api|file|local] \
  [--data-source http://127.0.0.1:8020/api/data] \
  [--data-timeout 20]
```

Notes:

- Default `--data-mode` is `api`
- Default `--data-source` uses `CLOSESNOW_DATA_URL`, fallback `http://127.0.0.1:8020/api/data`

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
- `subregion` (repeatable or comma-separated: `rockies|west-coast|midwest|mid-atlantic|northeast|europe|asia|australia-new-zealand|south-america`)
- `country` (repeatable or comma-separated ISO-2)
- `search` (free text)
- `search_all` (`1|true|yes|on`)
- `include_default` (`1|true|yes|on`)
- `include_all` (`1|true|yes|on`)

`/api/resorts` query parameters:

- `pass_type` (repeatable or comma-separated)
- `region`
- `subregion` (repeatable or comma-separated)
- `country` (repeatable or comma-separated ISO-2)
- `search`

`/api/resort-hourly` query parameters:

- `resort_id` (required)
- `hours` (`1..240`, default `72`)

### Frontend server (`serve` / `serve-web`)

- `GET /`
- `GET /api/data`
- `GET /api/resort-hourly`
- `GET /api/health`
- `GET /resort/<resort_id>`
- `GET /assets/css/*`
- `GET /assets/js/*`

### Static file server (`serve-static`)

- `GET /`
- `GET /data.json`
- `GET /resort/<resort_id>/`
- `GET /assets/*` when those files exist under the served directory

## Filter Behavior (Current)

- Main page filters are client-side in `assets/js/weather_page.js`
- Main page shell loads payload JSON from its bootstrap `dataUrl` and renders rows in-browser
- Main page filter state is persisted in `localStorage` (no page reload)
- Main page favorites are browser-local only via `closesnow_favorite_resorts_v1`
- On frontend page route `/`, server-side filter query keys are ignored by design
- `/api/data` still supports server-side filtering for API clients
- `Default resorts only` checked means `include_default=1` (show only `default_enabled=true`)
- `Favorites only` and `Favorites First` are frontend-only behaviors on the main page
- Search keyword + `search_all=1` ignores pass/region/subregion/country/default scope filters

This keeps static and dynamic page behavior aligned.

## Resort Catalog

Default source is `resorts.yml` (JSON-compatible list format). The old repo-root `resorts.txt` sample file is no longer part of the workflow; if needed, pass any custom plain-text file explicitly via `--resorts-file`.

Catalog fields:

- `resort_id`
- `query`
- `name`
- `display_name`
- `website`
- `state`
- `country`
- `region`
- `subregion` (`rockies|west-coast|midwest|mid-atlantic|northeast|europe|asia|australia-new-zealand|south-america`)
- `pass_types` (`ikon|epic|indy|independent`)
- `default_enabled`

Notes:

- Sync tooling manages Ikon/Epic/Indy metadata; independent entries are manually curated
- Main page filter controls currently expose Ikon/Epic toggles
- Runtime API/filter scope currently includes resorts that have Epic, Ikon, or independent pass types

## Static Output Structure

If output HTML is `site/index.html`, generated artifacts include:

- `site/index.html`
- `site/data.json` (when chosen as fetch/static output JSON)
- `site/resort/<resort_id>/index.html`
- `site/resort/<resort_id>/hourly.json` (when hourly fetch succeeds)
- `site/assets/css/*` and `site/assets/js/*` (copied automatically by `render`, `static`, and `serve-static`)
- `<bundle-root>/.closesnow-static-bundle.json` and `<output-dir>/.closesnow-static-site.json` (builder ownership metadata; both are under `site/` when bundle and render output share that directory)

## Payload Contract (`weather_payload_v1`)

Top-level validated keys:

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

Contract types are defined in `src/contract/weather_payload_v1.py`.

## Cache Behavior

- Base cache path: `.cache/open_meteo_cache.json`
- Runtime date-suffixed cache: `.cache/open_meteo_cache_YYYY-MM-DD.json`
- Coordinate cache: `.cache/resort_coordinates.json`
- Default TTL:
  - Geocode: `720` hours
  - Forecast/hourly: `3` hours
- API failures retry `--api-retries` times, default `2`, with a non-blocking `10` second async delay in concurrent fetch paths

## Resort Catalog Sync Script

Scripts:

- `scripts/sync_resorts_catalog.py`
- `scripts/sync_pass_resorts.py` (wrapper)

Examples:

```bash
python3 scripts/sync_resorts_catalog.py --validate-only
python3 scripts/sync_resorts_catalog.py --validate-only --skip-ikon-destinations-check
python3 scripts/sync_resorts_catalog.py --input resorts.yml --output resorts.yml
```

The sync script:

- Pulls Ikon/Epic/Indy source lists
- Merges into existing catalog (preserving `default_enabled`)
- Validates catalog schema and pass coverage
- Checks Ikon destination coverage against `https://www.ikonpass.com/en/destinations` (can be skipped)

## Testing

Install development dependencies:

```bash
python3 -m pip install -r requirements-dev.txt
```

Run formatter:

```bash
./scripts/format.sh
```

Run lint checks:

```bash
./scripts/lint.sh
```

This runs Python formatting/lint checks plus JavaScript, HTML, CSS, and shell syntax checks.

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

Install the repository pre-push hook:

```bash
git config core.hooksPath .githooks
```

The pre-push hook runs `./scripts/lint.sh` and `python3 -m pytest -q`.

## GitHub Pages Workflow

Workflow file: `.github/workflows/deploy-pages.yml`

Triggers:

- `workflow_dispatch`
- Push to `main`
- Hourly schedule (`1 * * * *`)

Build command used by workflow:

```bash
python -m src.cli static --output-dir site --max-workers 8 --include-all-resorts
touch site/.nojekyll
```

## Compatibility Surfaces

Legacy-compatible backend entrypoint:

```bash
python3 -m src.backend.ecmwf_unified_backend
```

Default artifacts:

- `.cache/resorts_weather_unified.json`
- `.cache/resorts_snowfall_daily.csv`
- `.cache/resorts_rainfall_daily.csv`
- `.cache/resorts_temperature_daily.csv`

Legacy Python table renderers under `src/web/weather_table_renderer.py`, `src/web/split_metric_renderer.py`, and `src/web/desktop`/`src/web/mobile` are retained as compatibility and regression-test surface. The current main page shell bootstraps payload data and renders forecast tables in browser JavaScript.

## Architecture Docs

- `docs/CODEBASE_VALIDATION_PLAYBOOK.md`
- `docs/FEATURE_DESIGN_MAIN_PAGE_FAVORITES_LOCAL_UPDATE.md`
- `docs/FEATURE_DESIGN_RESORT_COORDINATE_VERIFICATION_LINKS.md`
- `docs/FEATURE_DESIGN_RESORT_PAGE_DAILY_SUMMARY_REUSE.md`
- `docs/FEATURE_DESIGN_SERVE_STATIC.md`
- `docs/REFACTOR_PROGRESS_LEDGER.md`

## License

MIT (see `LICENSE`).
