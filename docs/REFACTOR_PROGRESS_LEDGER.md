# CloseSnow Refactor Progress Ledger

This file is the recovery anchor for long-running refactor work.

Always read in this order before continuing:

1. `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`
2. `docs/CODEBASE_VALIDATION_PLAYBOOK.md`
3. `docs/REFACTOR_PROGRESS_LEDGER.md` (this file)

---

## Current Objective

Implement the v4 classification/simplification objective:

`Frontend -> Communication -> Backend`

while keeping existing CLI/server/static behavior runnable at every step.

Status: v4 classification+merge pass implemented and validated on 2026-03-04 local.

---

## Current Baseline (Confirmed)

1. Backend fetch pipeline supports concurrent resort processing with `--max-workers`.
2. Cache read/write paths are lock-protected for concurrent access.
3. Frontend has per-table unit toggles (`cm/in`, `mm/in`, `C/F`) with persisted browser preference.
4. Desktop/mobile renderer split exists with merged precipitation wrappers by platform.
5. Two planning docs already exist:
   - `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`
   - `docs/CODEBASE_VALIDATION_PLAYBOOK.md`
6. Automated pytest suite exists under `tests/` and is runnable via `python3 -m pytest -q`.

---

## Completed Milestones

## 2026-03-04 00:55 (v4 classification + merge pass)

### Scope
- Tighten file classification and merge redundant frontend/backend wrapper layers while preserving runtime behavior.

### Changes
- Files:
  - `src/web/desktop/precipitation_renderer.py` (new)
  - `src/web/mobile/precipitation_renderer.py` (new)
  - `src/web/weather_table_renderer.py`
  - `src/web/weather_page_server.py`
  - `src/web/data_sources/clients.py`
  - `src/web/data_sources/gateway.py`
  - `src/web/data_sources/local_source.py` (new)
  - `src/web/data_sources/__init__.py`
  - removed:
    - `src/web/desktop/snowfall_renderer.py`
    - `src/web/desktop/rainfall_renderer.py`
    - `src/web/mobile/snowfall_renderer.py`
    - `src/web/mobile/rainfall_renderer.py`
  - `src/backend/services/weather_service.py`
  - `src/backend/services/__init__.py`
  - removed:
    - `src/backend/services/request_options.py`
  - `src/cli.py`
  - `src/backend/pipelines/live_pipeline.py`
  - `src/backend/pipelines/static_pipeline.py`
  - tests:
    - `tests/frontend/test_renderers.py`
    - `tests/integration/test_web_server.py`
    - `tests/integration/test_data_sources.py`
    - `tests/smoke/test_dynamic_server_smoke.py`
  - docs:
    - `README.md`
    - `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`
    - `docs/FRONTEND_BACKEND_FLOW_ARCHITECTURE.md`
    - `docs/CODEBASE_VALIDATION_PLAYBOOK.md`
- Behavior impact:
  - Snow/rain desktop+mobile renderer wrappers were merged by platform into precipitation modules.
  - Dynamic server now resolves all `local/api/file` data modes through communication layer adapters.
  - Backend weather service removed pass-through request-option wrapper layer and keeps one normalized entry.
  - Static pipeline compatibility alias remains, while duplicated logic was reduced.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/backend -q`
  - `python3 -m pytest tests/frontend -q`
  - `python3 -m pytest tests/integration -q`
  - `python3 -m pytest tests/smoke -q`
  - `python3 -m pytest -q`
  - `rg -n "from src\\.web|import src\\.web" src/backend -S`
  - `rg -n "from src\\.backend\\.open_meteo|from src\\.backend\\.pipeline\\b|from src\\.backend\\.cache" src/web -S`
  - `rg -n "from src\\.backend\\.pipelines\\.live_pipeline" src/web -S`
- Results:
  - compileall: pass
  - backend tests: `39 passed`
  - frontend tests: `14 passed`
  - integration tests: `55 passed`
  - smoke tests: `3 passed`
  - full suite: `111 passed`
  - boundary checks:
    - backend -> web import: no matches
    - web direct backend low-level import check: no matches
    - backend live pipeline import in web: one expected match in `src/web/data_sources/local_source.py`

### Risks / Notes
- `src/web/weather_page_static_render.py` still imports backend pipeline for compatibility static entrypoint (intentional compatibility path).

### Next Slice
- Optional: extract reusable JS table sync/toggle controller to reduce duplication in `assets/js/weather_page.js`.

## 2026-03-04 (v3 implementation: frontend/backend simplification + dynamic decoupling)

### Scope
- Implement the planned v3 refactor end-to-end.
- Keep backward compatibility for existing CLI flows.

### Changes
- Frontend modularization:
  - `src/web/weather_table_renderer.py` now uses metric config + reusable section composition.
  - Reduced duplicated section shell/toggle rendering across snow/rain/temp.
- Frontend static template extraction:
  - added `src/web/templates/weather_page.html`
  - `src/web/weather_html_renderer.py` now injects dynamic fragments into template.
- Communication layer modularization:
  - added `src/web/data_sources/clients.py`
  - `src/web/data_sources/gateway.py` now builds and uses payload client adapters.
- Dynamic decoupled runtime:
  - added backend API server: `src/backend/weather_data_server.py`
  - `src/web/weather_page_server.py` supports `data_mode=local|api|file` and `/api/health`
  - CLI supports:
    - `serve` (compatibility local mode)
    - `serve-data` (backend only)
    - `serve-web` (frontend only, remote/file/local data source)
- Backend compute modularization:
  - added `src/backend/compute/resort_selection.py`
  - added `src/backend/compute/payload_metadata.py`
  - added `src/backend/io/cache_seed.py`
  - added `src/backend/services/request_options.py`
  - `src/backend/pipeline.py` delegates resort selection + payload metadata build to compute modules.
- Frontend split-layout dedup:
  - added `src/web/split_metric_renderer.py`
  - snowfall/rainfall desktop+mobile modules now use shared split primitives.
- Tests:
  - added backend compute tests
  - added backend data server integration tests
  - expanded CLI/web/gateway integration tests for new modes/commands
  - added backend io cache-seed tests

### Validation
- `python3 -m compileall src`
- `python3 -m pytest tests/backend -q` (`39 passed`)
- `python3 -m pytest tests/frontend -q` (`14 passed`)
- `python3 -m pytest tests/integration -q` (`53 passed`)
- `python3 -m pytest tests/smoke -q` (`3 passed`)
- `python3 -m pytest -q` (`109 passed`)

### Outcome
- v3 Definition of Done met for current scope:
  1. Frontend rendering is configuration-driven and less duplicated.
  2. HTML shell is template-based instead of Python full-document literal.
  3. Backend has dedicated compute/io/request-option submodules for reusable orchestration pieces.
  4. Dynamic pipeline supports independent FE/BE startup and cross-server communication.
  5. Compatibility mode (`serve`) remains available.

## 2026-03-03/04 (v3 planning reset + test suite restructuring)

### Scope
- Rewrite next refactor target around frontend/backend simplification and full dynamic decoupling.
- Restructure tests by responsibility and add explicit smoke/integration coverage.

### Changes
- Rewrote planning doc:
  - `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md` now tracks v3 objective:
    - frontend modularization and HTML/static extraction plan
    - backend simplification boundaries
    - decoupled dynamic communication layer design
- Restructured tests:
  - added folders:
    - `tests/backend/`
    - `tests/frontend/`
    - `tests/integration/`
    - `tests/smoke/`
  - split mixed test responsibilities (backend vs frontend static-site tests)
  - added smoke tests:
    - static split pipeline smoke
    - dynamic server smoke
  - added integration test:
    - gateway -> renderer path (`file` and `api`)
  - added marker config:
    - `pytest.ini` with `smoke` and `integration`
- Updated docs:
  - `README.md` testing layout/commands
  - `docs/CODEBASE_VALIDATION_PLAYBOOK.md` layered test commands and marker checks

### Validation
- `python3 -m compileall src`
- `python3 -m pytest -q` (`91 passed`)
- `python3 -m pytest tests/backend -q` (`34 passed`)
- `python3 -m pytest tests/frontend -q` (`14 passed`)
- `python3 -m pytest tests/integration -q` (`41 passed`)
- `python3 -m pytest tests/smoke -q` (`2 passed`)
- `python3 -m pytest -m smoke -q` (`2 passed, 89 deselected`)
- `python3 -m pytest -m integration -q` (`2 passed, 89 deselected`)

### Outcome
- Codebase now has test structure aligned with v3 refactor execution needs.
- At that time, v3 architecture execution was the next implementation slice (completed in the 2026-03-04 implementation milestone above).

## 2026-03-03/04 (v2 boundary hardening)

### Scope
- Finish remaining architecture-boundary refactor items from v2 guide.

### Changes
- Shared config extraction:
  - added `src/shared/config.py`
  - moved cross-layer `DEFAULT_RESORTS_FILE` usage to shared config
  - updated `src/cli.py`, `src/web/weather_page_server.py`, `src/web/weather_page_static_render.py`
- Communication gateway unification:
  - added `src/web/data_sources/gateway.py` as canonical runtime loader
  - migrated CLI render/static loading paths to `load_payload(...)`
  - removed legacy `src/web/data_sources/source_selector.py`
- Backend compute/export separation:
  - added `src/backend/export/payload_exporter.py`
  - `src/backend/pipeline.py` now uses compute function + export orchestrator split
  - service path switched to compute-only function (`build_weather_payload` no file outputs)
- Updated docs to reflect final v2 architecture:
  - `README.md`
  - `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`
  - `docs/CODEBASE_VALIDATION_PLAYBOOK.md`

### Validation
- `python3 -m compileall src`
- `python3 -m pytest -q` (`87 passed`)
- `python3 -m src.cli fetch --output-json /tmp/final_refactor_data.json --max-workers 8`
- `python3 -m src.cli render --input-json /tmp/final_refactor_data.json --output-html /tmp/final_refactor_index.html`
- `python3 -m src.cli static --output-html /tmp/final_refactor_static.html --max-workers 8`
- `python3 -m src.cli serve --host 127.0.0.1 --port 8010 --max-workers 8` + smoke `GET /api/data`, `GET /`
- boundary checks:
  - `rg -n "from src\\.web|import src\\.web" src/backend -S` -> no matches
  - `rg -n "from src\\.backend\\.constants" src/web src/cli.py -S` -> no matches

### Outcome
- v2 Definition of Done met:
  1. Web/CLI no longer depend on backend constants for shared config.
  2. Communication gateway is the single runtime payload-loading entry.
  3. Backend compute and export are separated internally.
  4. Backend imports do not reference web modules.
  5. Docs/tests/workflow align with architecture.

## 2026-03-03 (automated pytest coverage expansion)

### Scope
- Add broad regression suite for refactored architecture and runtime entrypoints.

### Changes
- Added `tests/` suite covering:
  - contract validators
  - file/api data sources
  - CLI command branches
  - backend cache/open-meteo/pipeline/service/writer modules
  - web table/style/renderer/html/assets/server paths
  - compatibility entrypoints
- Updated docs to include automated test workflow:
  - `README.md`
  - `docs/CODEBASE_VALIDATION_PLAYBOOK.md`
  - `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`

### Validation
- `python3 -m pytest -q`

### Outcome
- Automated regression baseline established (`86 passed` in local run).

## 2026-03-03 (contract + communication + split static pipeline)

### Scope
- Complete the contract-driven refactor without breaking existing entrypoints.

### Changes
- Added contract layer:
  - `src/contract/weather_payload_v1.py`
  - `src/contract/validators.py`
- Updated backend pipeline output:
  - `src/backend/pipeline.py` now emits `schema_version` and `generated_at_utc` and validates payload.
- Added backend service/pipeline abstraction:
  - `src/backend/services/weather_service.py`
  - `src/backend/pipelines/live_pipeline.py`
  - `src/backend/pipelines/static_pipeline.py`
- Added communication/data-source layer:
  - `src/web/data_sources/static_json_source.py`
  - `src/web/data_sources/api_source.py`
  - `src/web/data_sources/source_selector.py`
- Reworked CLI into split + wrapper commands:
  - `src/cli.py` supports `fetch`, `render`, `static`, `serve`.
- Migrated legacy web entrypoints to new pipeline abstraction:
  - `src/web/weather_page_server.py`
  - `src/web/weather_page_static_render.py`
- Synced docs/workflow with current behavior:
  - `README.md`
  - `.github/workflows/deploy-pages.yml`
  - `docs/CODEBASE_VALIDATION_PLAYBOOK.md`

### Validation
- `python3 -m compileall src`
- `python3 -m src.cli fetch --output-json site/data.json --max-workers 8`
- `python3 -m src.cli render --input-json site/data.json --output-html site/index.html`
- `python3 -m src.cli static --output-html index.html --max-workers 8`
- `python3 -m src.cli static --skip-fetch --output-json .cache/static_payload.json --output-html /tmp/static_from_cached_payload.html`
- `python3 -m src.cli static --skip-render --output-json /tmp/static_payload_only.json --max-workers 8`
- `python3 -m src.cli serve --host 127.0.0.1 --port 8010 --max-workers 8` + smoke `GET /api/data`, `GET /`
- `python3 -m src.web.weather_page_static_render --output-html /tmp/legacy_static_render.html --max-workers 8`
- workflow-equivalent local build:
  - `python3 -m src.cli fetch --output-json <tmp>/data.json --max-workers 8`
  - `python3 -m src.cli render --input-json <tmp>/data.json --output-html <tmp>/index.html`
  - copy assets to `<tmp>/assets/...`

### Outcome
- Refactor objective reached:
  1. Backend produces explicit validated contract payload.
  2. Communication layer supports file/API payload loading with schema validation.
  3. Frontend render path is shared and contract-driven for static and dynamic flows.
  4. Static pipeline supports split stages and wrapper command.
  5. Deploy workflow now uses split static pipeline (`fetch + render`).

## 2026-03-03 (recent merged work)

### Scope
- Stabilize UI unit toggles and backend concurrent fetch controls.

### Key commits
- `8a6b0d7` concurrent backend fetch + `--max-workers` + docs/workflow sync
- `578d6bd` per-table unit toggle UX + docs alignment
- `87112af` one-shot initial render to avoid unit flicker
- `0178896` sliding toggle + table refresh animation
- `ad92eee` per-table metric/imperial toggles
- `2c7d3c2` desktop/mobile renderer folders + fallback behavior

### Validation
- `python3 -m compileall src`
- `python3 -m src.cli static --output-html index.html --max-workers 8`
- `python3 -m src.cli serve --max-workers 8` (smoke paths `/` and `/api/data`)

### Outcome
- Codebase is runnable and deploy workflow is aligned with unified CLI static rendering.

---

## In-Progress Refactor Theme

Move from backend-driven HTML composition toward a strict contract-driven interface:

1. Backend produces one explicit payload contract object.
2. Communication layer validates/adapts payload.
3. Frontend rendering depends only on contract and data source.

No functional rewrite in one shot. Use small, reversible slices.

Current status: this theme has been implemented for the existing HTML rendering model.

---

## Next Slices (Post-Refactor, Optional)

1. Add `pytest-cov` and establish a minimum coverage gate in CI.
2. Add typed adapters for report row shape if frontend contract granularity increases.
3. Consider client-side online mode (`index.html` loads `/api/data`) as a separate evolution, not part of this completed slice.

---

## Open Risks

1. Contract drift between static output and online API if schema is not centralized.
2. Refactor scope creep if frontend and backend changes are mixed in a single PR.
3. Behavior regressions if migration removes compatibility paths too early.

---

## Resume Checklist (Use Every Session)

1. `git status --short`
2. Read the three docs listed at top.
3. Pick exactly one slice from "Next Slices".
4. Implement only that slice.
5. Run validation from `CODEBASE_VALIDATION_PLAYBOOK.md`.
6. Append a new ledger entry before ending session.

---

## Session Entry Template

Copy this template for each new work session:

```markdown
## YYYY-MM-DD HH:MM (local)

### Scope
- [single slice summary]

### Changes
- Files:
  - path/a
  - path/b
- Behavior impact:
  - [what changed]

### Validation
- Commands:
  - `...`
  - `...`
- Results:
  - [pass/fail + key output]

### Risks / Notes
- [risk or none]

### Next Slice
- [single next action]
```

## 2026-03-04 01:44 (local)

### Scope
- Implement F7: replace generic day headers with concrete date labels across snowfall/rainfall/temperature tables.

### Changes
- Files:
  - src/web/weather_report_transform.py
  - src/web/split_metric_renderer.py
  - src/web/desktop/temperature_renderer.py
  - tests/frontend/test_renderers.py
  - tests/frontend/test_styles_and_transform.py
- Behavior impact:
  - Transform layer now derives `label_day_N` from `daily[].date` in format `MM-DD Ddd`.
  - Snowfall/rainfall desktop+mobile headers now show concrete dates when available, with fallback to `today/day N`.
  - Temperature desktop headers now show concrete dates when available, with fallback to `today/day N`.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_styles_and_transform.py`
  - `pytest -q tests/frontend`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "03-" index.html | head -n 20`
- Results:
  - All targeted frontend tests passed (`12 passed`).
  - Full frontend test suite passed (`16 passed`).
  - Static render succeeded and output includes concrete date headers such as `03-04 Wed`.

### Risks / Notes
- `label_day_N` keys are currently generated per-row; renderer uses first-row labels for headers by design.

### Next Slice
- Implement F1: add `weather_code` backend field and emoji rendering section with tests and static verification.

## 2026-03-04 03:48 (local)

### Scope
- Implement F1 weather_code end-to-end: backend payload inclusion plus frontend emoji weather section.

### Changes
- Files:
  - `src/backend/open_meteo.py`
  - `src/backend/report_builder.py`
  - `src/web/weather_code_emoji.py`
  - `src/web/weather_report_transform.py`
  - `src/web/weather_table_renderer.py`
  - `src/web/weather_html_renderer.py`
  - `src/web/weather_page_render_core.py`
  - `src/web/templates/weather_page.html`
  - `tests/frontend/test_renderers.py`
- Behavior impact:
  - Forecast/history daily requests now include `weather_code`.
  - Each `daily` item in report includes `weather_code` (`int | null`).
  - Main page now renders a dedicated `Weather` section with emoji per day and WMO-code tooltip.

### Validation
- Commands:
- `pytest -q tests/backend tests/frontend`
  - `pytest -q`
  - `python3 -m src.cli fetch --output-json /tmp/closesnow_f1_data.json`
  - `jq '.reports[0].daily[0] | {date, weather_code}' /tmp/closesnow_f1_data.json`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "<h2>Weather</h2>|☀️|🌧️|❄️|⛈️|❓|WMO code" index.html`
- Results:
  - Targeted suites and full suite passed (`113 passed`).
  - API payload sample contains `weather_code` with numeric value.
  - Static HTML includes Weather section, emoji rendering, and WMO tooltip text.

### Risks / Notes
- Weather emoji mapping is intentionally coarse-grained by WMO category; unknown codes fallback to `❓`.

### Next Slice
- Implement F2 sunrise/sunset daily fields and a dedicated sunrise/sunset section in frontend.

## 2026-03-04 04:52 (local)

### Scope
- Implement F2 sunrise/sunset end-to-end with backend daily fields and frontend Sunrise/Sunset section.

### Changes
- Files:
  - `src/backend/open_meteo.py`
  - `src/backend/report_builder.py`
  - `src/web/weather_report_transform.py`
  - `src/web/desktop/sun_renderer.py` (new)
  - `src/web/weather_table_renderer.py`
  - `src/web/weather_html_renderer.py`
  - `src/web/weather_page_render_core.py`
  - `src/web/templates/weather_page.html`
  - `assets/css/weather_page.css`
  - `assets/js/weather_page.js`
  - `tests/backend/test_report_builder.py`
  - `tests/backend/test_open_meteo.py`
  - `tests/frontend/test_styles_and_transform.py`
  - `tests/frontend/test_renderers.py`
- Behavior impact:
  - Forecast/history daily requests now include `sunrise,sunset`.
  - Daily payload now carries `sunrise_iso`, `sunset_iso`, and formatted `sunrise_local_hhmm` / `sunset_local_hhmm`.
  - Main page now includes a dedicated `Sunrise / Sunset` split table (temperature-like layout) with concrete date headers.

### Validation
- Commands:
  - `pytest -q tests/backend/test_report_builder.py tests/backend/test_open_meteo.py tests/frontend/test_renderers.py tests/frontend/test_styles_and_transform.py`
  - `pytest -q`
  - `python3 -m src.cli fetch --output-json /tmp/closesnow_f2_data.json`
  - `jq '.reports[0].daily[0] | {date, sunrise_local_hhmm, sunset_local_hhmm}' /tmp/closesnow_f2_data.json`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "Sunrise / Sunset|sunrise|sunset|[0-2][0-9]:[0-5][0-9]" index.html | head -n 40`
- Results:
  - Targeted suite passed (`27 passed`).
  - Full suite passed (`116 passed`).
  - Payload sample contains `sunrise_local_hhmm` and `sunset_local_hhmm`.
  - Static HTML contains `Sunrise / Sunset` section and rendered HH:MM values.

### Risks / Notes
- Sunrise/sunset HH:MM extraction currently assumes Open-Meteo ISO-like time format and truncates to minute precision.

### Next Slice
- Start F5: migrate resort source to YAML metadata and add searchable/structured resort attributes.

## 2026-03-04 04:57 (local)

### Scope
- Implement F5 resort catalog migration to YAML metadata, add searchable catalog API, and add frontend resort search UI.

### Changes
- Files:
  - `resorts.yml` (new)
  - `src/shared/config.py`
  - `src/backend/resort_catalog.py` (new)
  - `src/backend/pipeline.py`
  - `src/backend/weather_data_server.py`
  - `src/web/templates/weather_page.html`
  - `assets/css/weather_page.css`
  - `assets/js/weather_page.js`
  - `tests/backend/test_resort_catalog.py` (new)
  - `tests/backend/test_pipeline.py`
  - `tests/integration/test_backend_data_server.py`
  - `tests/frontend/test_renderers.py`
- Behavior impact:
  - Default resort source is now `resorts.yml` (JSON-compatible YAML list with structured attributes).
  - Resort loading supports both `.yml/.yaml` catalog and legacy `.txt` list.
  - Backend adds `/api/resorts?search=...` for catalog search across name/query/state/region/pass type.
  - Frontend adds a `Search Resorts` box that filters visible rows across snow/rain/weather/sun/temp sections.

### Validation
- Commands:
  - `pytest -q tests/backend/test_resort_catalog.py tests/backend/test_pipeline.py tests/integration/test_backend_data_server.py tests/frontend/test_renderers.py`
  - `pytest -q`
  - `python3 -m src.cli fetch --output-json /tmp/closesnow_f5_data.json`
  - `jq '{resorts_count, sample_query:.reports[0].query}' /tmp/closesnow_f5_data.json`
  - `python3 - <<'PY'\nfrom src.backend.resort_catalog import load_resort_catalog, search_resort_catalog\nitems = load_resort_catalog('resorts.yml')\nprint('count', len(items))\nprint('epic', [x['query'] for x in search_resort_catalog(items, 'epic')])\nPY`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "resort-search-input|Search Resorts" index.html`
- Results:
  - Targeted tests passed (`20 passed`).
  - Full suite passed (`120 passed`).
  - Default fetch uses YAML catalog with `resorts_count: 18`.
  - Catalog search returns expected match for `epic`.
  - Static HTML includes resort search controls.

### Risks / Notes
- `resorts.yml` is currently stored as JSON-compatible YAML for zero-dependency parsing.

### Next Slice
- Implement F4: filter modal with pass type / east-west / country backed by catalog metadata.

## 2026-03-04 05:05 (local)

### Scope
- Implement F4 resort filter capability with backend filter query support and frontend filter modal.

### Changes
- Files:
  - `src/backend/weather_data_server.py`
  - `src/backend/pipeline.py`
  - `src/web/weather_report_transform.py`
  - `src/web/split_metric_renderer.py`
  - `src/web/desktop/temperature_renderer.py`
  - `src/web/desktop/sun_renderer.py`
  - `src/web/weather_table_renderer.py`
  - `src/web/templates/weather_page.html`
  - `assets/js/weather_page.js`
  - `assets/css/weather_page.css`
  - `tests/integration/test_backend_data_server.py`
  - `tests/backend/test_pipeline.py`
  - `tests/frontend/test_styles_and_transform.py`
  - `tests/frontend/test_renderers.py`
  - `docs/FEATURE_DESIGN_SKI_WEATHER_FULL_INFO.md`
- Behavior impact:
  - `/api/data` supports filters: `pass_type`, `region`, `country`, `search`.
  - `/api/data` response now includes `available_filters` and `applied_filters` metadata.
  - Reports are enriched with catalog metadata (`resort_id`, `pass_types`, `region`, `country_code`).
  - Frontend rows carry filter data attributes and a filter modal can filter by pass type / east-west / country.

### Validation
- Commands:
  - `pytest -q tests/backend/test_pipeline.py tests/integration/test_backend_data_server.py tests/frontend/test_renderers.py tests/frontend/test_styles_and_transform.py`
  - `pytest -q`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "filter-open-btn|filter-modal|data-pass-types|data-region|data-country='US'" index.html`
- Results:
  - Targeted suites passed (`23 passed`).
  - Full suite passed (`121 passed`).
  - Static HTML includes filter modal controls and row metadata attributes used by client filtering.

### Risks / Notes
- Frontend filter modal currently applies client-side row filtering (static-friendly); URL sync for filters is not added yet.

### Next Slice
- Implement F6 by extending resort catalog coverage toward full Ikon/Epic/Indy set.

## 2026-03-04 05:14 (local)

### Scope
- Implement F3 per-resort hourly standalone flow: backend hourly endpoint, frontend hourly page route/assets, and main-table resort links.

### Changes
- Files:
  - `src/backend/open_meteo.py`
  - `src/backend/weather_data_server.py`
  - `src/web/weather_page_server.py`
  - `src/web/weather_page_assets.py`
  - `src/web/templates/resort_hourly_page.html` (new)
  - `assets/css/resort_hourly.css` (new)
  - `assets/js/resort_hourly.js` (new)
  - `src/web/weather_report_transform.py`
  - `src/web/split_metric_renderer.py`
  - `src/web/desktop/temperature_renderer.py`
  - `src/web/desktop/sun_renderer.py`
  - `src/web/weather_table_renderer.py`
  - `assets/css/weather_page.css`
  - tests:
    - `tests/backend/test_open_meteo.py`
    - `tests/integration/test_backend_data_server.py`
    - `tests/integration/test_web_server.py`
    - `tests/frontend/test_assets.py`
    - `tests/frontend/test_renderers.py`
    - `tests/frontend/test_styles_and_transform.py`
  - docs:
    - `docs/FEATURE_DESIGN_SKI_WEATHER_FULL_INFO.md`
- Behavior impact:
  - Backend adds `GET /api/resort-hourly?resort_id=<id>&hours=<n>` with hourly metrics:
    - `snowfall`, `rain`, `precipitation_probability`, `snow_depth`, `wind_speed_10m`, `wind_direction_10m`, `visibility`.
  - Web server adds:
    - `/resort/<resort_id>` hourly page route
    - `/api/resort-hourly` proxy/local endpoint for page data fetch
  - Main weather tables now link resort names to `/resort/<resort_id>`.

### Validation
- Commands:
  - `pytest -q tests/backend/test_open_meteo.py tests/integration/test_backend_data_server.py tests/integration/test_web_server.py tests/frontend/test_assets.py tests/frontend/test_renderers.py`
  - `pytest -q`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "/resort/|filter-open-btn" index.html | head -n 40`
  - `python3 -m src.cli serve-data --host 127.0.0.1 --port 8031` + `curl /api/resort-hourly?...` smoke
  - `python3 -m src.cli serve-web --host 127.0.0.1 --port 8032 --data-mode local` + `curl /resort/snowbird-ut` and `curl /api/resort-hourly?...` smoke
- Results:
  - Targeted suites passed (`32 passed`).
  - Full suite passed (`124 passed`).
  - Static HTML contains `/resort/<id>` links in resort columns.
  - Backend/web smoke checks return hourly payload with required keys and valid route rendering.

### Risks / Notes
- `hours` is capped to `240` for endpoint stability.

### Next Slice
- F6 remaining: extend `resorts.yml` coverage to full Ikon/Epic/Indy catalog.

## 2026-03-04 05:34 (local)

### Scope
- Implement F6 full-pass catalog coverage for Ikon/Epic/Indy with automated catalog sync/validation, include-all filtering path, and large-catalog-ready filter UX metadata.

### Changes
- Files:
  - `resorts.yml`
  - `scripts/sync_resorts_catalog.py` (new)
  - `scripts/sync_pass_resorts.py`
  - `src/backend/resort_catalog.py`
  - `src/backend/weather_data_server.py`
  - `src/web/weather_page_server.py`
  - `src/web/weather_html_renderer.py`
  - `src/web/weather_page_render_core.py`
  - `src/web/templates/weather_page.html`
  - `assets/css/weather_page.css`
  - `assets/js/weather_page.js`
  - `tests/backend/test_resort_catalog.py`
  - `tests/integration/test_backend_data_server.py`
  - `tests/integration/test_web_server.py`
  - `tests/frontend/test_renderers.py`
  - `docs/FEATURE_DESIGN_SKI_WEATHER_FULL_INFO.md`
- Behavior impact:
  - Added `scripts/sync_resorts_catalog.py` with network sync + `--validate-only` integrity checks (required fields, duplicate ids/queries, pass coverage).
  - Expanded `resorts.yml` to full synced catalog coverage for Ikon/Epic/Indy while keeping default page scope manageable via `default_enabled` entries.
  - Backend `/api/data` now supports `include_all=1` in applied filters and selection logic.
  - Web server query passthrough now forwards `pass_type/region/country/search/include_all` to API mode and executes backend-equivalent filtered selection in local mode.
  - Frontend filter modal now includes `Include full catalog (slower)`, dynamic pass/country/region counts, URL-sync/reload behavior for server-side filtering, and visible resort count summary.
  - HTML render core now injects filter metadata (`window.CLOSESNOW_FILTER_META`) into page output.

### Validation
- Commands:
  - `pytest -q tests/backend/test_resort_catalog.py tests/integration/test_backend_data_server.py tests/integration/test_web_server.py tests/frontend/test_renderers.py`
  - `pytest -q`
  - `python3 scripts/sync_resorts_catalog.py --validate-only`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "filter-include-all|CLOSESNOW_FILTER_META|data-pass-count|include_all" index.html`
  - `python3 -m src.cli serve-data --host 127.0.0.1 --port 8041` + `curl "http://127.0.0.1:8041/api/data?search=snowbird&include_all=1" | jq ...`
  - `python3 -m src.cli serve-web --host 127.0.0.1 --port 8042 --data-mode local` + `curl "http://127.0.0.1:8042/?search=snowbird&include_all=1"`
- Results:
  - Targeted suites passed (`26 passed`).
  - Full suite passed (`128 passed`).
  - Catalog validation passed for expanded `resorts.yml` (`total 362`, pass counts include `ikon/epic/indy`).
  - Static render succeeded and includes new full-catalog controls and filter metadata script.
  - Runtime smoke checks confirmed include-all query path and server-side filtered render behavior.

### Risks / Notes
- `include_all=1` without additional narrowing can trigger very large fetches; UI labels this mode as slower.

### Next Slice
- Feature backlog in current design doc is fully implemented; next work should be user-prioritized polish/performance iteration on full-catalog workflows.

## 2026-03-04 05:38 (local)

### Scope
- Fix incorrect resort hourly links under sub-path deployments by converting hard-coded absolute hourly routes/assets/API paths to prefix-safe relative addressing.

### Changes
- Files:
  - `src/web/weather_table_renderer.py`
  - `src/web/split_metric_renderer.py`
  - `src/web/desktop/temperature_renderer.py`
  - `src/web/desktop/sun_renderer.py`
  - `src/web/templates/resort_hourly_page.html`
  - `assets/js/resort_hourly.js`
  - `src/web/weather_page_server.py`
  - `tests/frontend/test_renderers.py`
  - `tests/integration/test_web_server.py`
- Behavior impact:
  - Resort links now use relative `resort/<id>` instead of absolute `/resort/<id>`.
  - Hourly page assets use relative `../assets/...` and hourly API calls derive prefix from current pathname.
  - Web server now normalizes prefixed paths (e.g. `/CloseSnow/resort/...`, `/CloseSnow/api/resort-hourly`, `/CloseSnow/assets/...`).

### Validation
- Commands:
  - `pytest -q tests/frontend/test_renderers.py tests/integration/test_web_server.py`
  - `pytest -q`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "href='resort/|../assets/js/resort_hourly.js|../assets/css/resort_hourly.css" index.html src/web/templates/resort_hourly_page.html`
- Results:
  - Targeted tests passed (`16 passed`).
  - Full suite passed (`128 passed`).
  - Static render succeeded and now contains relative hourly links/resources.

### Risks / Notes
- Static GitHub Pages build still has no backend API route; this fix corrects path resolution and sub-path compatibility for dynamic serving and prefixed deployments.

### Next Slice
- If needed, add static-friendly hourly artifact generation for GitHub Pages-only hosting.

## 2026-03-04 05:40 (local)

### Scope
- Fix Weather section single-table header/left column usability by making the Resort column sticky in the Weather table.

### Changes
- Files:
  - `assets/css/weather_page.css`
  - `tests/frontend/test_assets.py`
- Behavior impact:
  - Weather table now keeps the Resort column fixed (`position: sticky; left: 0`) while horizontal scrolling.
  - Header/query intersection cell has elevated z-index for stable sticky layering.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_assets.py tests/frontend/test_renderers.py`
  - `pytest -q`
  - `python3 -m src.cli static --output-html index.html`
- Results:
  - Targeted tests passed (`10 passed`).
  - Full suite passed (`128 passed`).
  - Static render succeeded with updated weather table styles.

### Risks / Notes
- None.

### Next Slice
- Continue user-reported UI polish iterations on cross-table scrolling behavior.

## 2026-03-04 05:58 (local)

### Scope
- Add sorting controls in Filters so resorts can be ordered by state or resort name, while keeping all metric tables in sync.

### Changes
- Files:
  - `src/web/templates/weather_page.html`
  - `assets/js/weather_page.js`
  - `src/web/weather_report_transform.py`
  - `src/web/split_metric_renderer.py`
  - `src/web/desktop/temperature_renderer.py`
  - `src/web/desktop/sun_renderer.py`
  - `src/web/weather_table_renderer.py`
  - `tests/frontend/test_renderers.py`
  - `tests/frontend/test_styles_and_transform.py`
- Behavior impact:
  - Filter modal now has `Sort By` options: default, state (A-Z), resort name (A-Z).
  - Sorting is applied client-side to all paired tables (desktop/mobile where applicable) with row order kept consistent across sections.
  - `sort_by` is persisted in URL query params and restored on load.
  - Resort row metadata now includes `data-state` from `admin1` for stable state-based sorting.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_styles_and_transform.py tests/frontend/test_renderers.py tests/frontend/test_assets.py`
  - `pytest -q tests/integration/test_web_server.py tests/integration/test_gateway_render_integration.py tests/integration/test_cli.py tests/integration/test_entrypoints.py tests/frontend/test_static_site_pipeline.py`
  - `python3 -m src.cli static --skip-fetch --output-json .cache/static_payload.json --output-html index.html`
- Results:
  - Frontend targeted tests passed (`15 passed`).
  - Integration/entry/static-related suites passed (`32 passed`).
  - Static render succeeded and includes `filter-sort-select` plus `data-state` row attributes.

### Risks / Notes
- Sorting is client-side only; backend payload order remains unchanged.

### Next Slice
- If needed, add descending or multi-key sort options and explicit locale-aware collation controls.

## 2026-03-04 06:12 (local)

### Scope
- Fix static resort hourly pages showing `fetch failed` by making static builds emit local hourly data artifacts and making hourly page JS read local JSON first.

### Changes
- Files:
  - `src/web/pipelines/static_site.py`
  - `src/web/templates/resort_hourly_page.html`
  - `assets/js/resort_hourly.js`
  - `src/web/weather_page_server.py`
  - `src/cli.py`
  - `src/web/weather_page_static_render.py`
  - `tests/frontend/test_static_site_pipeline.py`
  - `tests/integration/test_cli.py`
  - `tests/integration/test_entrypoints.py`
- Behavior impact:
  - `static` and `weather_page_static_render` now generate `resort/<resort_id>/hourly.json` (120h) alongside `resort/<resort_id>/index.html`.
  - Hourly page context now supports `hourlyDataUrl`; static pages inject `./hourly.json`.
  - `resort_hourly.js` now prefers local `hourlyDataUrl` and slices rows for selected hour window (24/48/72/120), with API fallback kept for dynamic mode.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_static_site_pipeline.py tests/integration/test_cli.py tests/integration/test_entrypoints.py tests/integration/test_web_server.py`
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_assets.py tests/frontend/test_styles_and_transform.py`
  - `python3 -m src.cli static --skip-fetch --output-json .cache/static_payload.json --output-html index.html`
  - `find resort -maxdepth 3 -name hourly.json`
- Results:
  - Targeted static/cli/web tests passed (`31 passed`).
  - Frontend regression suites passed (`15 passed`).
  - Static compile succeeded and generated `hourly.json` for all rendered resorts.

### Risks / Notes
- `render` command (file->html only) still does not proactively fetch hourly data; it only renders pages. Full static hourly artifacts are produced by `static` and static-render entrypoint.

### Next Slice
- If desired, add optional `--with-hourly-data` for `render` to fetch and emit hourly artifacts from file mode too.

## 2026-03-04 06:20 (local)

### Scope
- Fix GitHub Pages workflow so Actions artifacts include newly added resort subpages and hourly static assets/data.

### Changes
- Files:
  - `.github/workflows/deploy-pages.yml`
- Behavior impact:
  - Build step now uses unified `python -m src.cli static --output-json site/data.json --output-html site/index.html --max-workers 8`.
  - Workflow now copies full `assets/css` and `assets/js` directories into `site/assets`, not only `weather_page.css/js`.
  - Pages artifact now includes static hourly subpages + required hourly JS/CSS and locally generated hourly JSON files.

### Validation
- Commands:
  - `sed -n '1,260p' .github/workflows/deploy-pages.yml`
- Results:
  - Workflow confirmed updated to static pipeline command and full asset copy strategy.

### Risks / Notes
- This change only affects future GitHub Actions runs (after push/merge to `main`).

### Next Slice
- Optionally add a lightweight workflow smoke check (assert `site/resort/*/index.html` and `site/resort/*/hourly.json` exist) before upload.

## 2026-03-04 06:28 (local)

### Scope
- Update filter sorting UX to default to state order and remove the redundant `Default` sort option.

### Changes
- Files:
  - `src/web/templates/weather_page.html`
  - `assets/js/weather_page.js`
  - `tests/frontend/test_renderers.py`
- Behavior impact:
  - Filter sort dropdown now has only `State (A-Z)` and `Resort Name (A-Z)`.
  - Default sort mode is now `state` (when no `sort_by` query parameter is provided).
  - URL query only includes `sort_by` when user chooses `name`; state sort remains implicit default.
  - Filter summary only shows `sort: ...` when non-default (`name`) is selected.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_assets.py tests/frontend/test_styles_and_transform.py tests/integration/test_gateway_render_integration.py`
  - `python3 -m src.cli static --skip-fetch --output-json .cache/static_payload.json --output-html index.html`
  - `rg -n "filter-sort-select|option value=\"state\"|option value=\"default\"" index.html`
- Results:
  - Targeted suites passed (`17 passed`).
  - Static compile succeeded and rendered only state/name options; `default` option no longer present.

### Risks / Notes
- Existing links containing `sort_by=default` will be normalized to state sort.

### Next Slice
- If desired, add secondary state-region grouping labels (e.g., by country + state) for international expansion.

## 2026-03-04 06:36 (local)

### Scope
- Add keyboard accessibility for filter modal close action via `Esc`.

### Changes
- Files:
  - `assets/js/weather_page.js`
- Behavior impact:
  - When filter modal is open, pressing `Escape` now closes it.
  - No effect when modal is already hidden.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_assets.py tests/frontend/test_styles_and_transform.py`
- Results:
  - Frontend targeted suites passed (`15 passed`).

### Risks / Notes
- None.

### Next Slice
- If needed, add focus trapping and focus-return behavior for fully keyboard-friendly modal navigation.

## 2026-03-04 06:44 (local)

### Scope
- Center-align sunrise/sunset time values in the Sun table for better readability.

### Changes
- Files:
  - `assets/css/weather_page.css`
- Behavior impact:
  - Time cells under sunrise/sunset now render centered (`.sun-right-table td { text-align: center; }`).

### Validation
- Commands:
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_assets.py tests/frontend/test_styles_and_transform.py`
- Results:
  - Frontend targeted suites passed (`15 passed`).

### Risks / Notes
- None.

### Next Slice
- Optional visual polish: apply explicit tabular-nums styling for time columns.

## 2026-03-04 06:53 (local)

### Scope
- Align `Search Resorts` behavior with placeholder text by adding pass-type keyword matching.

### Changes
- Files:
  - `assets/js/weather_page.js`
- Behavior impact:
  - Search now matches across resort name text, state text, and pass types (`ikon/epic/indy`) from row metadata.
  - Existing filter conditions (pass/region/country/sort/include_all) remain unchanged.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_assets.py tests/frontend/test_styles_and_transform.py`
- Results:
  - Frontend targeted suites passed (`15 passed`).

### Risks / Notes
- Search remains substring-based; short keywords (e.g., `i`) may match broadly as designed.

### Next Slice
- Optionally support multi-keyword AND search tokenization for stricter matching.

## 2026-03-04 07:00 (local)

### Scope
- Center-align snowfall table date header row text for better visual consistency.

### Changes
- Files:
  - `assets/css/weather_page.css`
- Behavior impact:
  - Snowfall second header row (`label_day_*` date row) now renders with centered text.
  - Weekly/group header behavior unchanged.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_assets.py tests/frontend/test_styles_and_transform.py`
- Results:
  - Frontend targeted suites passed (`15 passed`).

### Risks / Notes
- None.

### Next Slice
- Optional: apply same explicit date-row alignment rule to rain/weather/sun for full cross-table consistency.
