# CloseSnow Refactor Guide (v2)

This document is the source of truth for refactoring CloseSnow into a strict layered architecture:

`Frontend -> Communication -> Contract -> Backend`

This v2 edition focuses on the remaining boundary issues found in code audit, not the already-completed basics.

Status update (2026-03-04 local):

1. Phase 1-3 goals are implemented in code.
2. Phase 4 remains optional product evolution, not a blocking refactor item.

---

## 1) Goals

The refactor is successful only if:

1. Backend contains data fetching/computation/export logic only.
2. Web/frontend contains rendering and page assembly only.
3. Communication layer is the single runtime entry for payload loading (file or API).
4. Shared runtime configuration is not owned by backend.
5. Static and dynamic modes stay behavior-compatible.

---

## 2) Current Status Snapshot

## 2.1 Completed already

1. Contract module exists (`src/contract/*`) and is validated.
2. Static/dynamic render path is shared (`render_payload_html`).
3. Backend no longer imports web modules directly.
4. CLI supports split pipeline (`fetch`, `render`) and wrapper (`static`).
5. Pytest suite exists and is stable.

## 2.2 Remaining boundary debt (must fix)

### A) Shared config extraction

Status:

1. Completed in current code: `DEFAULT_RESORTS_FILE` moved to `src/shared/config.py`.
2. Web/CLI now import shared config, not backend constants.

Follow-up:

1. Keep new cross-layer defaults in `src/shared/config.py` by convention.

### B) Communication abstraction is not the default runtime path

Current:

1. `src/web/data_sources/gateway.py` defines the canonical `load_payload(...)` API.
2. `cli render/static` use `load_payload(...)` via gateway.
3. Server page/API path fetches backend payload and renders directly (intended for SSR mode).

Impact:

1. Runtime payload loading is centralized for file/API source paths.
2. Optional future client-side online bootstrap should also call gateway for consistency.

### C) Backend compute and export are still bundled in one orchestration function

Current:

1. `run_pipeline(...)` now delegates compute to `compute_pipeline_payload(...)`.
2. Artifact writing is delegated to `src/backend/export/payload_exporter.py`.
3. Compute helpers still live in `src/backend/pipeline.py` (not yet moved to dedicated `compute/` package).

Impact:

1. Main coupling is reduced, but module-level separation is still transitional.
2. A future `backend/compute/*` extraction can further reduce file-level complexity.

---

## 3) Target Architecture (v2)

## 3.1 Layer responsibilities

### Frontend/Web layer (`src/web`)

Responsibilities:

1. Transform contract payload into render rows.
2. Render HTML and serve page/assets.
3. Assemble static site artifacts from validated payload.

Must not:

1. Own weather provider logic.
2. Own backend default path config.

### Communication layer (`src/web/data_sources` + loader gateway)

Responsibilities:

1. Load payload from file/API through one interface.
2. Validate contract before returning payload.
3. Normalize source selection logic.

Must not:

1. Fetch provider data from Open-Meteo.
2. Render HTML.

### Contract layer (`src/contract`)

Responsibilities:

1. Schema version and payload shape.
2. Validation and contract invariants.

### Backend layer (`src/backend`)

Responsibilities:

1. Provider I/O, retry, cache, concurrency.
2. Compute canonical payload.
3. Export payload/report files through dedicated exporter boundary.

Must not:

1. Import web rendering modules.
2. Own cross-layer runtime config.

### Shared config layer (new)

Proposed path:

- `src/shared/config.py`

Responsibilities:

1. Project-wide defaults used by backend/web/cli.
2. No business logic.

---

## 4) Proposed Directory Shape (v2)

```text
src/
  shared/
    config.py

  contract/
    weather_payload_v1.py
    validators.py

  backend/
    pipeline.py                 # transitional wrapper
    compute/
      weather_compute.py        # pure compute payload
    export/
      payload_exporter.py       # JSON/CSV writes
    services/
      weather_service.py
    pipelines/
      live_pipeline.py
      static_pipeline.py        # fetch-only orchestration

  web/
    data_sources/
      api_source.py
      static_json_source.py
      gateway.py                # recommended unified load entry
    pipelines/
      static_site.py
    weather_page_server.py
    weather_page_static_render.py
```

Notes:

1. `backend/pipeline.py` can remain as compatibility wrapper during migration.
2. Do not remove existing entrypoints until parity validation passes.

---

## 5) Refactor Plan (Execution Order)

## Phase 1: Extract shared config

Tasks:

1. Create `src/shared/config.py`.
2. Move `DEFAULT_RESORTS_FILE` (and future cross-layer constants) to shared.
3. Update imports in:
   - `src/cli.py`
   - `src/web/weather_page_server.py`
   - `src/web/weather_page_static_render.py`
4. Keep backend constants for backend-only values (API URLs, model defaults, etc.).

Exit criteria:

1. No web/cli import of `src.backend.constants` for cross-layer defaults.
2. Runtime behavior unchanged.

## Phase 2: Make communication layer the default path

Tasks:

1. Add communication gateway (for example `src/web/data_sources/gateway.py`) with a single `load_payload(...)`.
2. Route `cli render` through gateway instead of calling file loader directly.
3. Route any future online bootstrap payload loading through same gateway.
4. Keep current server behavior, but avoid introducing parallel loaders outside gateway.

Exit criteria:

1. One canonical payload loading path for file/API.
2. Contract validation always occurs in communication layer.

## Phase 3: Split backend compute from export

Tasks:

1. Introduce compute function that only returns payload.
2. Move JSON/CSV output operations to exporter module.
3. Keep `run_pipeline(...)` as transitional orchestrator, internally delegating compute+export.
4. Ensure service layer uses compute-only path by default.

Exit criteria:

1. Compute path testable without filesystem writes.
2. Export path testable independently.

## Phase 4 (optional): Online shell + client fetch mode

Tasks:

1. Keep `/api/data` as contract endpoint.
2. Optionally serve shell page that loads payload client-side through communication gateway.
3. Preserve current SSR-style mode as fallback until parity confirmed.

Exit criteria:

1. Online mode and static mode use the same contract and frontend transform logic.

---

## 6) Validation Requirements

Run all before push:

1. `python3 -m compileall src`
2. `python3 -m pytest -q`
3. `python3 -m src.cli fetch --output-json site/data.json --max-workers 8`
4. `python3 -m src.cli render --input-json site/data.json --output-html site/index.html`
5. `python3 -m src.cli static --output-html index.html --max-workers 8`
6. `python3 -m src.cli serve --host 127.0.0.1 --port 8010 --max-workers 8` and smoke:
   - `GET /api/data`
   - `GET /`

Layer boundary checks:

1. `rg -n "from src\\.web|import src\\.web" src/backend -S` should return empty.
2. `rg -n "from src\\.backend\\.constants" src/web src/cli.py -S` should only include backend-owned concerns (or become empty after Phase 1).

---

## 7) Backward Compatibility Rules

During migration:

1. Keep CLI names: `fetch`, `render`, `static`, `serve`.
2. Keep endpoint paths: `/` and `/api/data`.
3. Keep contract schema version stable unless explicit migration is introduced.
4. Keep GitHub Pages workflow path compatible with `fetch + render`.

---

## 8) Definition of Done (v2)

Refactor is complete when all are true:

1. Web/CLI no longer depend on backend constants for shared config.
2. Communication gateway is the single runtime payload loading entry.
3. Backend compute and export are separated internally.
4. No backend module imports web modules.
5. Docs, tests, and workflow reflect the final architecture.

---

## 9) Recovery Checklist

If resuming after context loss:

1. Read this file first.
2. Run:
   - `git status --short`
   - `python3 -m pytest -q`
3. Identify unfinished phase from section 5.
4. Implement one phase at a time.
5. Re-run section 6 validations before commit.

---

## 10) Change Log (This Doc)

1. v1 documented contract-first refactor baseline.
2. v2 rewrites plan around remaining boundary debt:
   - shared config extraction
   - communication gateway unification
   - backend compute/export separation
