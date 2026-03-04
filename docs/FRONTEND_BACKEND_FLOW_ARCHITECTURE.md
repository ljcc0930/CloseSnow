# CloseSnow Frontend/Backend Flow Architecture

This document is the operational architecture guide for keeping frontend/backend responsibilities clear while reducing file sprawl and duplicated logic.

---

## 1) Layer Ownership

## 1.1 Backend (`src/backend`)

Own:

1. Provider I/O, retries, cache, geocoding, forecasting.
2. Async resort orchestration and contract payload construction.
3. Data API service (`/api/data`, `/api/health`).
4. Optional artifact export (JSON/CSV).

Do not own:

1. HTML assembly.
2. UI styling, table layout, browser interaction logic.

## 1.2 Web/Frontend (`src/web` + `assets`)

Own:

1. Payload-to-row transform and HTML rendering.
2. Static page shell template.
3. Assets (CSS/JS) and page-serving modes.
4. Communication clients for `file`/`api` payload loading and compatibility `local` adapter.

Do not own:

1. Open-Meteo provider logic.
2. Backend cache/retry behavior.

## 1.3 Communication Contract (`src/contract`)

Own:

1. Contract schema version and validators.
2. Cross-layer payload shape invariants.

---

## 2) Runtime Flows

## 2.1 Static Build (split pipeline)

1. `python3 -m src.cli fetch --output-json site/data.json`
2. `python3 -m src.cli render --input-json site/data.json --output-html site/index.html`

Flow:

`Backend compute -> contract JSON -> frontend render`

## 2.2 Dynamic Coupled Mode (compatibility)

1. `python3 -m src.cli serve`

Flow:

`Web server -> communication local adapter -> backend compute -> render`

## 2.3 Dynamic Decoupled Mode (recommended)

1. `python3 -m src.cli serve-data --port 8020`
2. `python3 -m src.cli serve-web --data-mode api --data-source http://127.0.0.1:8020/api/data`

Flow:

`Backend data service -> communication adapter -> frontend web service`

This allows independent startup, scaling, and cross-host deployment.

---

## 3) File Separation Strategy

## 3.1 Keep file boundaries where they encode platform intent

Keep:

1. `src/web/desktop/*` and `src/web/mobile/*` as platform-facing entry modules.

Reason:

1. It preserves explicit mobile/desktop ownership and fallback behavior.

## 3.2 Merge code where behavior is truly duplicated

Implemented merges:

1. Shared split-table rendering moved into `src/web/split_metric_renderer.py`.
2. Shared data-source client selection moved into `src/web/data_sources/gateway.py` + `clients.py`.
3. Shared `local` data-loading bridge moved into `src/web/data_sources/local_source.py`.
4. Snowfall/rainfall platform wrappers merged into:
   - `src/web/desktop/precipitation_renderer.py`
   - `src/web/mobile/precipitation_renderer.py`
5. Shared backend async coordinator moved into `src/backend/compute/coordinator.py`.
6. Shared coordinate seeding moved into `src/backend/io/cache_seed.py`.
7. Request-option wrapper layer removed; normalization now lives in `src/backend/services/weather_service.py`.

## 3.3 Keep compatibility wrappers minimal

Examples:

1. `fetch_static_payload` is now an alias of `run_live_payload` in `src/backend/pipelines/static_pipeline.py`.
2. `serve` remains as one-process compatibility while `serve-data` + `serve-web` is the preferred decoupled path.

---

## 4) Merge Rules (for future refactor)

When deciding whether to merge files:

1. Merge if modules differ only by constant values/configuration.
2. Keep separate if modules represent distinct runtime boundaries (backend/web/contract).
3. Keep wrappers only when preserving stable import paths or CLI compatibility.
4. If a wrapper exists, keep it as an alias or tiny delegator (no duplicated logic body).

---

## 5) Design Checklist Before New Code

1. Does this belong to backend, web, or contract?
2. Does an existing shared utility already solve this?
3. Is this another wrapper that can be an alias instead?
4. Will this change preserve decoupled mode (`serve-data` + `serve-web`)?
5. Are docs and runbook updated with the new flow or ownership?
