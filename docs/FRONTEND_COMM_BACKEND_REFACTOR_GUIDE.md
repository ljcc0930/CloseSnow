# CloseSnow Refactor Guide: Frontend-Communication-Backend

This document is a full implementation guide for refactoring CloseSnow into a clean
`Frontend -> Communication Contract -> Backend` architecture.

The goal is to make this guide self-sufficient so a new engineer (or a reset model)
can continue the work without prior chat context.

Implementation status update (2026-03-03 local): core refactor in this guide is implemented.
The project now uses contract validation, split static pipeline commands, and backend/communication/frontend layering.

---

## 1) Why This Refactor Exists

Current project works and ships, but data flow is still partly "backend drives page HTML".
To scale safely, we want:

1. One stable data contract (`WeatherPayload`) used everywhere.
2. Frontend renderer reusable for both static and online modes.
3. Backend focused on fetch/compute/cache, not page assembly.
4. Two pipelines (static and online) reusing same contract.

Target mental model:

1. Backend produces contract data.
2. Communication layer transports/validates data.
3. Frontend consumes contract and renders.

---

## 2) Current State Snapshot (As Of This Doc)

### 2.1 Key backend files

- `src/backend/open_meteo.py`
- `src/backend/pipeline.py`
- `src/backend/cache.py`
- `src/backend/report_builder.py`
- `src/backend/writers.py`
- `src/backend/ecmwf_unified_backend.py`

### 2.2 Key web files

- `src/web/weather_page_server.py`
- `src/web/weather_page_static_render.py`
- `src/web/weather_page_render_core.py`
- `src/web/weather_html_renderer.py`
- `src/web/weather_table_renderer.py`
- `src/web/desktop/*.py`
- `src/web/mobile/*.py`
- `assets/js/weather_page.js`
- `assets/css/weather_page.css`

### 2.3 Existing features already in place

1. Per-table unit toggle (`cm/in`, `mm/in`, `C/F`) with localStorage persistence.
2. Desktop/mobile separated renderers for snowfall and rainfall.
3. Mobile-missing fallback to desktop in renderer composition.
4. Concurrent backend fetching with configurable `--max-workers`.
5. Cache locking for thread-safe local cache read/write.

### 2.4 Existing CLI / entrypoints

1. Unified CLI: `python -m src.cli fetch|render|static|serve`
2. Backend entrypoint: `python -m src.backend.ecmwf_unified_backend`
3. Direct web static: `python -m src.web.weather_page_static_render`
4. Direct web server: `python -m src.web.weather_page_server`

---

## 3) Target Architecture

## 3.1 Layer boundaries

### Frontend layer

Responsibilities:

1. Render tables/cards/charts from contract payload.
2. UI state only (layout mode, unit mode, sorting/filtering).
3. No Open-Meteo knowledge, no backend business logic.

Must not do:

1. Reach into provider-specific fields not in contract.
2. Depend on whether data comes from file or API.

### Communication contract layer

Responsibilities:

1. Define payload schema and versioning.
2. Validate payload shape and defaults.
3. Provide adapters from "transport shape" to "render shape" if needed.

Must not do:

1. Call Open-Meteo.
2. Contain UI behavior.

### Backend layer

Responsibilities:

1. Fetch geocode/forecast/history.
2. Retry/cache/concurrency control.
3. Produce contract payload only.

Must not do:

1. Render HTML tables.
2. Encode frontend-only view concerns.

---

## 4) Implemented Directory Design

```text
src/
  contract/
    __init__.py
    weather_payload_v1.py
    validators.py

  backend/
    services/
      weather_service.py
    pipelines/
      static_pipeline.py
      live_pipeline.py

  web/
    data_sources/
      __init__.py
      static_json_source.py
      api_source.py
      source_selector.py
```

Notes:

1. Existing compatibility entrypoints still work.
2. New modules are now source of truth for contract-oriented flow.
3. Migration preserved behavior while switching internal boundaries.

---

## 5) Contract Definition (Implemented)

Create `WeatherPayloadV1` contract with explicit `schema_version`.

Minimum top-level fields:

1. `schema_version` (example: `"weather_payload_v1"`)
2. `generated_at_utc`
3. `source`
4. `model`
5. `forecast_days`
6. `units` (metric canonical units)
7. `cache` (cache file + hit/miss + TTL info)
8. `resorts_count`
9. `failed_count`
10. `failed[]`
11. `reports[]`

Each `report` should include:

1. Resort identity fields (`query`, `matched_name`, geo info).
2. Weekly totals in metric base.
3. Daily arrays in metric base.
4. Optional history section.

Rule:

1. Contract stays metric canonical.
2. Unit conversion remains frontend concern.

---

## 6) Pipelines Design (Static + Online)

## 6.1 Static pipeline

Intent:

1. Generate data artifact.
2. Generate shell html/assets.

Flow:

1. `fetch` command calls backend service and writes `site/data.json`.
2. `render` command writes `site/index.html` and copies assets.
3. `static` command orchestrates `fetch + render` by default.

Optional switches:

1. `--skip-fetch`
2. `--skip-render`
3. `--max-workers`

## 6.2 Online pipeline

Intent:

1. Serve JSON contract from API.
2. Keep frontend rendering path shared with static mode.

Flow:

1. `/api/data` returns contract payload.
2. `/` renders HTML from the same contract-to-render pipeline used by static.
3. Optional future: browser-side bootstrap can consume `/api/data` via `web/data_sources`.

Cadence:

1. If data updates every 60 min, frontend can fetch once per load.
2. Optional hourly client refresh or manual refresh button.

---

## 7) Frontend Data Source Abstraction

Introduce a narrow interface:

```python
class WeatherDataSource:
    def load(self) -> dict: ...
```

Implementations:

1. `StaticJsonSource(path_or_url)`
2. `ApiSource(endpoint="/api/data")`

Selector:

1. Decide source by environment flag/query/config.
2. Return same payload shape to renderer.

Outcome:

1. UI rendering code is shared for static and online.
2. Only source selection changes.

---

## 8) Migration Steps (Recommended Order)

### Phase A: Contract-first, no behavior changes

1. Add `src/contract/weather_payload_v1.py` type hints/dataclass model.
2. Add validator functions (`validate_payload_v1`).
3. Wrap existing `run_pipeline` output into explicit contract object.
4. Keep old keys during transitional compatibility.

Exit criteria:

1. Existing static and server commands still run.
2. Contract validation passes for both flows.

### Phase B: Split commands (`fetch`, `render`, `static`)

1. Add `fetch` subcommand in `src/cli.py`.
2. Add `render` subcommand in `src/cli.py`.
3. Keep `src.cli static` as orchestration command.
4. Update GitHub action to call orchestration or explicit sequence.

Exit criteria:

1. `fetch` alone produces valid `data.json`.
2. `render` alone can build page from existing `data.json`.
3. Combined command remains one-step for convenience.

### Phase C: Frontend source abstraction

1. Add `web/data_sources/static_json_source`.
2. Add `web/data_sources/api_source`.
3. Migrate frontend bootstrap to consume source interface.

Exit criteria:

1. Static mode and online mode render identically with same payload.

### Phase D: Remove coupling leftovers

1. Remove backend-driven table HTML composition from main path.
2. Keep only contract + frontend renderer relation.

Exit criteria:

1. Backend modules contain no HTML rendering logic.

---

## 9) Testing and Validation Plan

## 9.1 Fast checks per change

1. `python3 -m compileall src`
2. `python3 -m src.cli fetch --output-json site/data.json --max-workers 8`
3. `python3 -m src.cli render --input-json site/data.json --output-html site/index.html`
4. `python3 -m src.cli static --output-html index.html --max-workers 8`
5. `python3 -m src.cli serve --max-workers 8` manual smoke test

## 9.2 Contract checks

1. Validate every generated payload with validator.
2. Add test fixtures for:
   - normal success
   - partial failures
   - missing optional history

## 9.3 UI checks

1. Desktop/mobile table layout unaffected.
2. Unit toggles still work per-table.
3. No first-paint unit flicker regression.

---

## 10) Backward Compatibility Rules

During migration, preserve:

1. Existing CLI command names.
2. Existing output files (`index.html`, CSV paths) unless explicitly changed.
3. Existing `/api/data` endpoint path.

Allow:

1. Additional fields in payload.
2. New commands as additive features.

---

## 11) Risks and Mitigations

Risk: contract drift between static and online.
Mitigation:

1. Shared contract module and validator used by both.

Risk: async concurrency cache race.
Mitigation:

1. Keep cache lock (already done).
2. Keep write to disk at pipeline end.

Risk: migration breaks current deploy.
Mitigation:

1. Keep old command behavior and introduce new commands additively.
2. Update workflow only after local parity checks pass.

---

## 12) Minimal Recovery Checklist (Actionable)

If starting fresh, verify these implemented pieces before making further changes:

1. `src/contract/weather_payload_v1.py` and `src/contract/validators.py` exist and are imported by backend/static data-source paths.
2. `src/backend/pipeline.py` emits `schema_version` and `generated_at_utc` and calls validator.
3. `src/cli.py` exposes `fetch`, `render`, `static`, `serve`.
4. `src/web/data_sources/` is used for loading payload artifacts with validation.
5. `.github/workflows/deploy-pages.yml` uses static split build (`fetch + render`).
6. README command docs match current runtime behavior.

---

## 13) Definition Of Done (Refactor Complete)

Refactor is considered complete when:

1. Frontend rendering path uses only contract payload + source abstraction.
2. Static and online modes share same frontend rendering code.
3. Backend outputs contract data, not HTML fragments.
4. CLI provides clear split commands and one-shot convenience command.
5. Workflow deploys via the new pipeline and docs match behavior.

---

## 14) Operational Notes

Recommended runtime defaults:

1. `--max-workers 8` for normal usage.
2. Lower to `4` if provider rate limits become noisy.

Recommended user-facing behavior (online mode with hourly data):

1. Fetch once at page load.
2. Show "last updated".
3. Optional manual refresh button instead of aggressive polling.

---

## 15) Change Log For This Planning Doc

1. Initial full refactor blueprint added.
2. Captures current project features including:
   - per-table unit toggle
   - desktop/mobile split renderers
   - concurrent backend fetch and worker controls
