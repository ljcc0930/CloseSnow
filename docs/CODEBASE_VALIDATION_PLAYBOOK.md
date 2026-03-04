# CloseSnow Codebase Validation Playbook

This document is a practical runbook for validating that the repository is still runnable after changes.

Use this checklist every time before pushing.

---

## 1) Validation goals

A change is considered "runnable" only if all of these are true:

1. Python modules compile.
2. Static pipeline succeeds in both split mode (`fetch` + `render`) and wrapper mode (`static`).
3. Dynamic server boots and serves both HTML and JSON endpoints.
4. Core frontend assets are reachable.
5. No obvious runtime errors appear in the smoke flow.

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
2. `python3 -m src.cli fetch --output-json site/data.json --max-workers 8` passes.
3. `python3 -m src.cli render --input-json site/data.json --output-html site/index.html` passes.
4. `python3 -m src.cli static --output-html index.html --max-workers 8` passes.
5. Dynamic server probes (`/` and `/api/data`) pass.
6. `git status --short` contains only intended files.
7. README/workflow updated if command or behavior changed.

---

## 11) Known limitations of this playbook

1. No automated pytest suite is defined here.
2. External API availability/rate limits can affect runtime behavior.
3. Validation is smoke-level, not full correctness proof.

If stronger guarantees are needed, add dedicated contract tests and integration tests.
