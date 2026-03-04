# CloseSnow Codebase Validation Playbook

This document is a practical runbook for validating that the repository is still runnable after changes.

Use this checklist every time before pushing.

---

## 1) Validation goals

A change is considered "runnable" only if all of these are true:

1. Python modules compile.
2. Automated regression tests pass (`pytest`).
3. Static pipeline succeeds in both split mode (`fetch` + `render`) and wrapper mode (`static`).
4. Dynamic server boots and serves both HTML and JSON endpoints.
5. Core frontend assets are reachable.
6. No obvious runtime errors appear in the smoke flow.
7. Layer boundaries are not regressing (backend/web/communication responsibilities stay clear).

---

## 2) Preconditions

Run from repo root:

```bash
cd /Users/ljcc/workspace/CloseSnow
```

Check Python:

```bash
python3 --version
```

Expected:

1. Python 3.9+.

---

## 3) Fast preflight checks

### 3.1 Git working tree awareness

```bash
git status --short
```

Purpose:

1. Know exactly what is being validated.
2. Avoid mixing unrelated local changes accidentally.

### 3.2 Syntax compile check

```bash
python3 -m compileall src
```

Pass criteria:

1. Command exits with code 0.
2. No syntax/indent/import errors.

### 3.3 Automated regression tests

```bash
python3 -m pytest -q
```

Pass criteria:

1. All tests pass.
2. No flaky network dependency (suite should be deterministic).

Layered checks (recommended after refactor changes):

```bash
python3 -m pytest tests/backend -q
python3 -m pytest tests/frontend -q
python3 -m pytest tests/integration -q
python3 -m pytest tests/smoke -q
python3 -m pytest -m smoke -q
python3 -m pytest -m integration -q
```

Pass criteria:

1. Backend and frontend suites pass independently.
2. Smoke and integration marker suites pass.

### 3.4 Layer boundary checks (v4 refactor)

Hard boundary (must always pass):

```bash
rg -n "from src\\.web|import src\\.web" src/backend -S
```

Pass criteria:

1. No matches.

Web-side boundary sanity:

```bash
rg -n "from src\\.backend\\.open_meteo|from src\\.backend\\.pipeline\\b|from src\\.backend\\.cache" src/web -S
```

Pass criteria:

1. No matches.
2. Allowed backend coupling in web should flow through communication adapters, not render handlers.

Local adapter containment check:

```bash
rg -n "from src\\.backend\\.pipelines\\.live_pipeline" src/web -S
```

Pass criteria:

1. Exactly one match in `src/web/data_sources/local_source.py`.
2. No direct backend pipeline imports in `weather_page_server.py`.

---

## 4) Static pipeline validation

### 4.1 Fetch payload artifact

```bash
python3 -m src.cli fetch --output-json site/data.json --max-workers 8
```

Pass criteria:

1. Command prints `Done: site/data.json`.
2. Exit code is 0.

### 4.2 Render HTML from fetched payload

```bash
python3 -m src.cli render --input-json site/data.json --output-html site/index.html
```

Pass criteria:

1. Command prints `Done: site/index.html`.
2. Exit code is 0.

### 4.3 Validate one-shot wrapper still works

```bash
python3 -m src.cli static --output-html index.html --max-workers 8
```

Pass criteria:

1. Command prints `Done: .cache/static_payload.json` and `Done: index.html`.
2. Exit code is 0.

### 4.4 Verify output files exist and are not empty

```bash
ls -lh site/data.json site/index.html index.html
```

Pass criteria:

1. Files exist.
2. File sizes are non-trivial (not 0 bytes).

### 4.5 Quick content sanity checks

```bash
rg -n "schema_version|reports|failed" site/data.json
rg -n "Snowfall|Rainfall|Temperature|unit-toggle|api/data" site/index.html
```

Pass criteria:

1. Contract keys exist in JSON.
2. Main sections and unit toggle markup are present in HTML.

---

## 5) Dynamic pipeline validation

### 5.1 Boot dynamic server

Start server in one terminal:

```bash
python3 -m src.cli serve --host 127.0.0.1 --port 8010 --max-workers 8
```

Pass criteria:

1. Startup log prints serving URL.
2. Process keeps running.

### 5.2 Probe JSON endpoint

In another terminal:

```bash
curl -sS http://127.0.0.1:8010/api/data | head -n 20
```

Pass criteria:

1. Returns JSON.
2. Contains expected keys like `reports`, `failed`, `cache`.

### 5.3 Probe page endpoint

```bash
curl -sS http://127.0.0.1:8010/ | head -n 40
```

Pass criteria:

1. Returns HTML.
2. Contains page title and references to `assets/css/weather_page.css` and `assets/js/weather_page.js`.

### 5.4 Probe static assets from server

```bash
curl -sS -I http://127.0.0.1:8010/assets/css/weather_page.css
curl -sS -I http://127.0.0.1:8010/assets/js/weather_page.js
```

Pass criteria:

1. HTTP 200 for both.
2. Correct content type is present.

### 5.5 Decoupled dynamic validation (`serve-data` + `serve-web`)

Start backend data API in terminal A:

```bash
python3 -m src.cli serve-data --host 127.0.0.1 --port 8020 --max-workers 8
```

Start frontend web server in terminal B:

```bash
python3 -m src.cli serve-web --host 127.0.0.1 --port 8010 --data-mode api --data-source http://127.0.0.1:8020/api/data
```

Probe endpoints:

```bash
curl -sS http://127.0.0.1:8020/api/health | head -n 20
curl -sS http://127.0.0.1:8010/api/health | head -n 20
curl -sS http://127.0.0.1:8010/api/data | head -n 20
curl -sS http://127.0.0.1:8010/ | head -n 40
```

Pass criteria:

1. Both health endpoints return `ok: true`.
2. Frontend `/api/data` returns valid contract JSON.
3. Frontend `/` renders HTML successfully while backend runs as a separate service.

---

## 6) Concurrency-specific checks

Because backend now uses async orchestration with worker limits, validate at least two worker settings:

```bash
python3 -m src.cli fetch --output-json /tmp/worker1.json --max-workers 1
python3 -m src.cli fetch --output-json /tmp/worker8.json --max-workers 8
```

Pass criteria:

1. Both commands succeed.
2. No crashes around cache or race conditions.

---

## 7) Workflow compatibility check

The GitHub Pages workflow currently builds with split static pipeline commands.

Local equivalent:

```bash
mkdir -p site/assets/css site/assets/js
python3 -m src.cli fetch --output-json site/data.json --max-workers 8
python3 -m src.cli render --input-json site/data.json --output-html site/index.html
cp assets/css/weather_page.css site/assets/css/weather_page.css
cp assets/js/weather_page.js site/assets/js/weather_page.js
ls -la site site/assets/css site/assets/js
```

Pass criteria:

1. `site/data.json` and `site/index.html` exist.
2. CSS and JS files are present in `site/assets/...`.

---

## 8) Optional deeper checks (when touching frontend)

1. Open local page in browser and verify:
   - Desktop/mobile layout switch behavior.
   - Per-table unit toggle state persistence.
   - No initial flicker on load.
2. Confirm no console errors in browser devtools.

---

## 9) Optional deeper checks (when touching backend request logic)

1. Run static render twice; second run should show more cache hits.
2. Confirm no unhandled exceptions in logs.
3. If changing retry/caching behavior, test with temporary network interruption.

---

## 10) Release-ready checklist

Before push:

1. `python3 -m compileall src` passes.
2. `python3 -m pytest -q` passes.
3. `python3 -m pytest -m smoke -q` and `python3 -m pytest -m integration -q` pass.
4. `python3 -m src.cli fetch --output-json site/data.json --max-workers 8` passes.
5. `python3 -m src.cli render --input-json site/data.json --output-html site/index.html` passes.
6. `python3 -m src.cli static --output-html index.html --max-workers 8` passes.
7. Dynamic server probes (`/` and `/api/data`) pass.
8. Decoupled probes (`serve-data` + `serve-web`) pass when dynamic layer is touched.
9. `rg -n "from src\\.web|import src\\.web" src/backend -S` returns no matches.
10. `git status --short` contains only intended files.
11. README/workflow updated if command or behavior changed.

---

## 11) Known limitations of this playbook

1. `pytest-cov`/coverage percentage gates are not yet configured.
2. External API availability/rate limits can still affect live smoke checks.
3. Validation remains mostly unit/smoke-level, not a full correctness proof.
4. Layer-boundary checks are static-text heuristics; they do not replace design review.

---

## 12) Refactor Hygiene Checks

When doing structure-level refactor, run these extra checks:

1. Wrapper minimization check:

```bash
rg -n "return run_live_payload\\(|return build_weather_payload\\(" src/backend -S
```

Goal:

1. Keep wrappers as aliases/tiny delegators only.
2. Avoid copying orchestration logic across multiple files.

2. Duplicate split-render logic check:

```bash
rg -n "weekly\\'>|daily\\'>|col-week-right|snowfall-left-wrap-mobile|rain-left-wrap-mobile" src/web/desktop src/web/mobile -S
```

Goal:

1. Confirm shared split-render primitives remain centralized in `src/web/split_metric_renderer.py`.
2. Desktop/mobile modules should stay thin and configuration-focused.

3. Decoupled runtime smoke:

```bash
python3 -m pytest tests/smoke/test_decoupled_pipeline_smoke.py -q
```

Goal:

1. Ensure frontend/backend can still run independently via communication layer.
