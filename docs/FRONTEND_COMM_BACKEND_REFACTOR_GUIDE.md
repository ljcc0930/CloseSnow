# CloseSnow Refactor Guide (v3)

This document records the v3 refactor target and implementation status after v2 boundary hardening.

Target theme:

`Frontend -> Communication -> Backend`

Core intent:

1. Simplify the current frontend/backend implementation.
2. Increase code reuse through modularization.
3. Make dynamic runtime fully decoupled so frontend/backend can run in parallel, including on different servers.

Status (local 2026-03-04):

1. Codebase audit completed.
2. Test layout groundwork completed (`tests/backend`, `tests/frontend`, `tests/integration`, `tests/smoke`).
3. v3 implementation landed in code:
   - frontend section rendering is config-driven (`weather_table_renderer.py`)
   - snowfall/rainfall desktop+mobile layouts share split primitives (`split_metric_renderer.py`)
   - page shell moved to template (`src/web/templates/weather_page.html`)
   - backend compute + io split landed (`src/backend/compute/*`, `src/backend/io/*`)
   - backend request options normalized (`src/backend/services/request_options.py`)
   - dynamic decoupling implemented (`serve-data` + `serve-web`)

---

## 1) Current Audit Summary (Codebase-Wide)

## 1.1 Frontend (Python render path) hotspots

### A) Repeated section shell + toggle markup

Files:

1. `src/web/weather_table_renderer.py`

Findings:

1. Snow/rain/temp sections each hand-build similar section header + toggle HTML.
2. Empty-state rendering is repeated and not centralized.
3. Desktop/mobile fallback logic is reusable but wrapped in per-table duplication.

### B) Desktop/mobile renderer duplication

Files:

1. `src/web/desktop/snowfall_renderer.py`
2. `src/web/desktop/rainfall_renderer.py`
3. `src/web/mobile/snowfall_renderer.py`
4. `src/web/mobile/rainfall_renderer.py`

Findings:

1. Snow/rain desktop renderer structure is almost identical.
2. Snow/rain mobile renderer structure is almost identical.
3. Header label generation (`week/day/today`) is duplicated.

### C) Transform layer repetition

Files:

1. `src/web/weather_report_transform.py`

Findings:

1. `reports_to_snow_rows` and `reports_to_rain_rows` follow the same shape with different field mappings.
2. Formatting logic is mixed with field extraction; hard to reuse across metrics.

### D) Static shell content embedded in Python f-string

Files:

1. `src/web/weather_html_renderer.py`

Findings:

1. Page shell, head tags, powered-by, footer text are static but rebuilt by Python each render.
2. This mixes content/template concerns with dynamic table insertion.

## 1.2 Frontend (JS runtime) hotspots

Files:

1. `assets/js/weather_page.js`

Findings:

1. Snow/rain/temp sizing logic is repeated with similar algorithms.
2. Mobile/desktop sizing and sticky sync logic can be generic controllers.
3. Unit-toggle state logic is good but tied to page-specific DOM globals.

## 1.3 Backend hotspots

Files:

1. `src/backend/pipeline.py`
2. `src/backend/pipelines/live_pipeline.py`
3. `src/backend/pipelines/static_pipeline.py`
4. `src/backend/services/weather_service.py`

Findings:

1. `pipeline.py` is still a large mixed-orchestration module.
2. `compute_pipeline_payload` carries legacy output-path argument for cache seeding side effects.
3. live/static service wrappers are thin pass-through layers with overlapping responsibility.

## 1.4 Dynamic runtime coupling

Files:

1. `src/web/weather_page_server.py`

Findings:

1. A single server both fetches backend payload and renders frontend HTML in request path.
2. Frontend cannot start independently from backend availability.
3. Different-server deployment is not first-class yet.

---

## 2) v3 Refactor Goals

Refactor is done only if all are true:

1. Frontend rendering code is modularized by reusable table/section primitives (no snow/rain duplication blocks).
2. Static page shell is moved out of Python string concatenation into template/static HTML assets.
3. Backend orchestration is split into smaller modules with clear input/output boundaries.
4. Dynamic mode uses a communication layer contract so frontend/backend can be started independently.
5. Cross-server mode is supported through configurable API endpoint (no direct backend import required in frontend runtime).
6. Test suite is separated by responsibility and includes explicit smoke + integration coverage.

---

## 3) Frontend Modularization Plan

## 3.1 What should be modularized

### A) Section composer

Proposed:

1. Add a reusable `render_metric_section(...)` helper for:
   - title
   - unit toggle labels
   - target kind (`snow`/`rain`/`temp`)
   - empty state
   - layout body HTML

Expected impact:

1. Remove repeated section shell code in `weather_table_renderer.py`.

### B) Metric registry

Proposed:

1. Define a metric config map (snow/rain/temp):
   - field suffix patterns
   - weekly/daily header rules
   - desktop renderer
   - mobile renderer (optional fallback)
   - unit labels

Expected impact:

1. `render_rain_table`, `render_snowfall_table`, `render_temperature_table` can become one generic table render entry.

### C) Shared desktop/mobile table primitives

Proposed:

1. Extract common split-table generation helpers:
   - left/right colgroup creation
   - head group rows (`weekly`, `daily`, `today/dayN`)
   - row-to-cell mapping callback

Expected impact:

1. Snow/rain renderer pair becomes thin config wrappers instead of duplicated HTML builders.

### D) Transform normalization

Proposed:

1. Introduce a generic row-builder utility for metric-based extraction.
2. Keep temperature special-case logic but reuse common day loop and formatting.

Expected impact:

1. Less duplicated loops and fewer field-name hardcodes.

## 3.2 What can move directly into HTML/static assets

These are static page concerns and should not live in Python:

1. `<head>` shell structure and static script/style references.
2. `<h1>`, powered-by line, footer wording, and static external links.
3. Optional fixed section containers with placeholders where JS or Python injects table body.

Resulting Python simplification:

1. Python only fills dynamic slots (generated time + table HTML fragments), not full document scaffolding.

---

## 4) Backend Simplification Plan

## 4.1 Internal module split

Implemented structure:

```text
src/backend/
  pipeline.py                  # compatibility wrapper only
  compute/
    resort_selection.py
    payload_metadata.py
  io/
    cache_seed.py
  export/
    payload_exporter.py
  services/
    request_options.py
```

Rules:

1. `compute/*` returns contract payload only, no file writes.
2. Export remains in `export/*`.
3. Compatibility API (`run_pipeline`) can delegate to new modules until cleanup is complete.

## 4.2 Request config normalization

Proposed:

1. Introduce one request object/dataclass for runtime options:
   - resorts/resorts_file
   - cache config
   - worker count
2. Use one object across CLI/service/pipeline instead of repeated kwargs fan-out.

Expected impact:

1. Fewer parameter mismatches and easier test setup.

---

## 5) Communication Layer for Fully Decoupled Dynamic Pipeline

## 5.1 Target runtime topology

### Backend data service

Responsibilities:

1. Produce contract payload.
2. Expose data endpoints (`/api/data`, `/api/health`).
3. Optionally refresh payload every 60 minutes (or on demand).

### Frontend web service

Responsibilities:

1. Serve HTML/CSS/JS only.
2. Load payload from communication layer (`file` or remote `http`) at runtime.
3. Render data client-side or through a frontend-only render adapter.

### Communication adapters

Responsibilities:

1. `FilePayloadClient`: reads local JSON artifact.
2. `HttpPayloadClient`: fetches remote JSON API.
3. Both must validate `weather_payload_v1` before use.

## 5.2 Startup model

Required capabilities:

1. Frontend and backend can boot independently and in parallel.
2. Frontend can point to backend via config:
   - CLI arg override (`--data-source`)
   - env var default (`CLOSESNOW_DATA_URL`)
3. Backend can run on another host with CORS enabled.

## 5.3 Compatibility constraints

1. Keep existing `/api/data` contract shape unchanged.
2. Keep static flow (`fetch` + `render`) working while decoupled mode is introduced.
3. Keep current SSR path temporarily as fallback until parity is proven.

---

## 6) Test Strategy (Implemented Base + Next Steps)

## 6.1 Current folder split (implemented)

```text
tests/
  backend/
  frontend/
  integration/
  smoke/
  conftest.py
```

## 6.2 Current coverage intent

1. `tests/backend`: cache/open-meteo/pipeline/services/writers unit focus.
2. `tests/frontend`: renderer/styles/assets/static-site rendering focus.
3. `tests/integration`: CLI entrypoints, data-source gateway, server integration.
4. `tests/smoke`: fast end-to-end sanity checks for split static and dynamic server flows.

## 6.3 Required commands

1. `python3 -m pytest tests/backend -q`
2. `python3 -m pytest tests/frontend -q`
3. `python3 -m pytest tests/integration -q`
4. `python3 -m pytest tests/smoke -q`
5. `python3 -m pytest -m smoke -q`
6. `python3 -m pytest -m integration -q`

---

## 7) Implementation Status (Completed in v3)

## Phase A: Frontend section/table deduplication

Result:

1. Added metric view config and reusable section composition in `src/web/weather_table_renderer.py`.
2. Removed repeated snow/rain/temp section shell assembly logic.
3. Extracted shared snowfall/rainfall split table primitives into `src/web/split_metric_renderer.py`.

## Phase B: Template shell extraction

Result:

1. Static page shell moved to `src/web/templates/weather_page.html`.
2. `src/web/weather_html_renderer.py` now injects only dynamic fragments.

## Phase C: Dynamic communication decoupling

Result:

1. Added backend API-only service:
   - `src/backend/weather_data_server.py`
2. Enhanced frontend page server with source modes:
   - `local`, `api`, `file`
3. Added communication adapters:
   - `FilePayloadClient`
   - `HttpPayloadClient`
4. Added CLI commands for independent startup:
   - `serve-data`
   - `serve-web`

## Phase D: Cleanup + compatibility hardening

Result:

1. `serve` remains as compatibility one-process mode.
2. Decoupled mode covered by integration/smoke tests.
3. `serve-web` supports env-based remote API default (`CLOSESNOW_DATA_URL`) for cross-server deployment.

---

## 8) Definition of Done (v3)

1. Frontend rendering duplication reduced to config-driven modules.
2. Static shell content moved out of Python full-document f-strings.
3. Backend orchestration split into compute/io/export boundaries.
4. Dynamic runtime supports parallel FE/BE startup and cross-server deployment.
5. Tests are responsibility-split and include smoke/integration gates.
6. README and validation docs match the new architecture and commands.
