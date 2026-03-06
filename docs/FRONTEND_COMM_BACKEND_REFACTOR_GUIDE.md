# CloseSnow Refactor Guide (v4)

This guide defines the current refactor target and operating rules for simplifying the codebase while preserving runtime behavior.

Target theme:

`Frontend -> Communication -> Backend`

Status (local 2026-03-04): active and implemented for the current scope.

---

## 1) Scope of This Refactor

Primary goals:

1. Improve code classification by layer ownership.
2. Merge unnecessary files and duplicate wrapper functions.
3. Keep frontend/backend flow explicitly contract-driven.
4. Preserve both compatibility runtime and decoupled runtime.
5. Keep docs/runbook/skill synchronized so work can be resumed from zero context.

---

## 2) Ownership Model

## 2.1 Frontend (`src/web`, `assets`)

Own:

1. Payload-to-view transformation.
2. HTML/CSS/JS rendering and platform layout behavior.
3. Runtime payload acquisition through communication adapters.

Do not own:

1. Provider API orchestration.
2. Backend cache/retry policies.

## 2.2 Communication Layer (`src/web/data_sources`, `src/contract`)

Own:

1. Payload loading adapters (`local`, `api`, `file`).
2. Payload contract validation.
3. Runtime source selection and adapter construction.

## 2.3 Backend (`src/backend`)

Own:

1. Resort orchestration and compute.
2. Provider I/O + cache + model integration.
3. Data API service for decoupled runtime.
4. Artifact export.

---

## 3) Refactor Decisions Implemented

## 3.1 File merges and simplification

1. Merged duplicated precipitation renderer wrappers:
   - removed:
     - `src/web/desktop/snowfall_renderer.py`
     - `src/web/desktop/rainfall_renderer.py`
     - `src/web/mobile/snowfall_renderer.py`
     - `src/web/mobile/rainfall_renderer.py`
   - added:
     - `src/web/desktop/precipitation_renderer.py`
     - `src/web/mobile/precipitation_renderer.py`
2. Removed request-option wrapper file:
   - removed: `src/backend/services/request_options.py`
   - simplified: `src/backend/services/weather_service.py` now normalizes request input directly.
3. Kept compatibility wrapper minimal:
   - `src/backend/pipelines/static_pipeline.py` remains alias-only.
4. Consolidated HTTP serve loop in CLI:
   - `_serve_http_server(...)` shared by `serve`, `serve-data`, `serve-web`.

## 3.2 Function-level deduplication

1. Removed `build_weather_payload_for_options(...)` pass-through.
2. Centralized resort input normalization in `_normalize_resorts(...)` inside weather service.
3. Unified dynamic server data-loading branch through one `load_payload(...)` call.

## 3.3 Runtime flow cleanup

1. Added `src/web/data_sources/local_source.py` as communication bridge for local mode.
2. `weather_page_server.py` no longer contains direct backend-fetch branch logic; it delegates data resolution to communication layer for all modes:
   - `local`
   - `api`
   - `file`
3. Main forecast page now uses shell-first HTML plus browser-side payload rendering:
   - server returns controls + bootstrap config
   - browser fetches payload JSON from the configured data source
   - frontend filters rerender visible rows from in-memory data

---

## 4) Runtime Architecture

## 4.1 Static split pipeline

1. `python3 -m src.cli fetch --output-json site/data.json`
2. `python3 -m src.cli render --input-json site/data.json --output-html site/index.html`

Flow:

`backend compute -> contract JSON + shell HTML -> browser render`

## 4.2 Dynamic coupled mode (compatibility)

1. `python3 -m src.cli serve`

Flow:

`frontend web server -> communication local adapter -> backend compute -> shell + browser render`

## 4.3 Dynamic decoupled mode (recommended)

1. `python3 -m src.cli serve-data --port 8020`
2. `python3 -m src.cli serve-web --data-mode api --data-source http://127.0.0.1:8020/api/data`

Flow:

`backend data API -> communication http adapter -> frontend web server -> shell + browser render`

Supports independent startup and cross-host deployment.

---

## 5) Rules for Further Refactor

1. Merge files if differences are only constants or tiny wrappers.
2. Keep separate files for true layer boundaries (backend/web/contract).
3. Keep compatibility wrappers alias-only or tiny delegators.
4. Prefer moving cross-mode payload loading into communication adapters, not web handlers.
5. Any architectural move must update:
   - `docs/FRONTEND_BACKEND_FLOW_ARCHITECTURE.md`
   - `docs/CODEBASE_VALIDATION_PLAYBOOK.md`
   - `docs/REFACTOR_PROGRESS_LEDGER.md`

---

## 6) Validation Gate

Required before considering a slice done:

1. `python3 -m compileall src`
2. `python3 -m pytest tests/backend -q`
3. `python3 -m pytest tests/frontend -q`
4. `python3 -m pytest tests/integration -q`
5. `python3 -m pytest tests/smoke -q`
6. `python3 -m pytest -q`

Also run boundary checks from the validation playbook.

---

## 7) Done Criteria for This Theme

This refactor theme is complete only when:

1. Frontend/backend responsibilities are explicit and traceable by folder.
2. Duplicated wrappers are merged or reduced to aliases.
3. Dynamic runtime works in both coupled and decoupled modes.
4. Docs/runbook/skill/ledger are synchronized with current code.
