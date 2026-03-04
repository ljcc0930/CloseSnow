# CloseSnow Refactor Progress Ledger

This file is the recovery anchor for long-running refactor work.

Always read in this order before continuing:

1. `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`
2. `docs/CODEBASE_VALIDATION_PLAYBOOK.md`
3. `docs/REFACTOR_PROGRESS_LEDGER.md` (this file)

---

## Current Objective

Implement the `Frontend -> Communication Contract -> Backend` architecture incrementally,
while keeping existing CLI/server/static behavior runnable at every step.

Status: completed in code and validation on 2026-03-03 (local run).
Status update: v2 boundary refactor completed on 2026-03-03/04 local session.

---

## Current Baseline (Confirmed)

1. Backend fetch pipeline supports concurrent resort processing with `--max-workers`.
2. Cache read/write paths are lock-protected for concurrent access.
3. Frontend has per-table unit toggles (`cm/in`, `mm/in`, `C/F`) with persisted browser preference.
4. Desktop/mobile renderer split exists for snowfall and rainfall.
5. Two planning docs already exist:
   - `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`
   - `docs/CODEBASE_VALIDATION_PLAYBOOK.md`
6. Automated pytest suite exists under `tests/` and is runnable via `python3 -m pytest -q`.

---

## Completed Milestones

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
