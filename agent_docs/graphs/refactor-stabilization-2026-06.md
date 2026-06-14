# Refactor Stabilization 2026-06

## Summary
- Execute seven focused refactor slices from the codebase review without changing product behavior.
- Before starting each slice, read this document and use the first unchecked item as the current target.
- After completing each slice, update this document with the validation result, commit hash, and push status before moving to the next slice.

## Branch
- Primary branch: `main`
- Note: this repository does not currently have a local or remote `master` branch; `main` is the default branch.

## Working Rules
- Do not touch untracked `reports/`.
- Keep each slice behavior-preserving unless the slice explicitly removes dead compatibility surface.
- Run the smallest useful validation first; run broader validation when shared boundaries are touched.
- Make one commit per completed slice and push it to `origin/main`.

## Refactor Slices

### 1. Fix Asset Lint Path Rendering
- Status: done
- Goal: make `./scripts/lint.sh` report missing Node or tinycss2 dependency errors cleanly instead of crashing when `LintResult.path` is relative.
- Primary files: `scripts/lint_assets.py`, relevant tests.
- Validation: `python3 scripts/lint_assets.py --js`; `./scripts/lint.sh`.
- Commit: `f7961fa` (`Fix asset lint path rendering`)
- Push: done (`origin/main`)

### 2. Move Retry Helpers Out Of Backend Open-Meteo
- Status: done
- Goal: move generic retry helpers used by web adapters out of `src/backend/open_meteo.py` into a shared module.
- Primary files: `src/shared/*`, `src/backend/open_meteo.py`, `src/web/data_sources/api_source.py`, `src/web/data_sources/hourly_source.py`.
- Validation: web/backend boundary grep from the playbook; targeted data-source/open-meteo tests.
- Commit: `4619789` (`Move retry helpers to shared module`)
- Push: done (`origin/main`)

### 3. Split Homepage JavaScript Responsibilities
- Status: done
- Goal: reduce `assets/js/weather_page.js` by extracting cohesive homepage helpers while preserving browser behavior and asset load order.
- Primary files: `assets/js/weather_page.js`, new `assets/js/*` helper modules, `src/web/templates/weather_page.html`, asset tests.
- Validation: JS syntax lint; frontend/integration tests touching homepage render/assets.
- Commit: `f4403ad` (`Extract weather page formatter helpers`)
- Push: done (`origin/main`)

### 4. Centralize Hourly Metric Schema And Trimming
- Status: pending
- Goal: remove duplicate hourly metric key and trim logic from backend service, web data source, and resort hourly frontend code where practical.
- Primary files: `src/contract/*`, `src/backend/services/hourly_payload_service.py`, `src/web/data_sources/hourly_source.py`, `assets/js/resort_hourly.js`.
- Validation: hourly backend/data-source/frontend tests; JS syntax lint.
- Commit: pending
- Push: pending

### 5. Strengthen Payload And Report Contract Types
- Status: pending
- Goal: replace the broad `reports: List[Dict[str, Any]]` contract surface with explicit typed dicts for daily rows, reports, and hourly payloads without changing JSON output.
- Primary files: `src/contract/weather_payload_v1.py`, `src/contract/validators.py`, builder/service annotations.
- Validation: contract validator tests and pipeline/report builder tests.
- Commit: pending
- Push: pending

### 6. Deduplicate CLI And Server Option Wiring
- Status: pending
- Goal: reduce repeated argparse option declarations and server startup wiring while keeping CLI behavior stable.
- Primary files: `src/cli.py`, server entrypoints if needed, integration CLI tests.
- Validation: CLI/entrypoint/static-server tests.
- Commit: pending
- Push: pending

### 7. Clean Stale Docs And Legacy Renderer Decision
- Status: pending
- Goal: remove or clearly mark stale documentation references and decide whether old Python table renderers are compatibility surface or dead code.
- Primary files: `README.md`, docs, legacy renderer modules/tests if changed.
- Validation: documentation grep for stale paths; targeted renderer/docs-adjacent tests.
- Commit: pending
- Push: pending

## Completion Ledger
- Slice 1 completed and pushed: `f7961fa`; `python3 -m pytest tests/test_lint_assets.py -q` passed; `./scripts/lint.sh` now reports `assets/js: node is required for JavaScript syntax checks` cleanly on this machine instead of raising `ValueError`.
- Slice 2 completed and pushed: `4619789`; `python3 -m pytest tests/backend/test_open_meteo.py tests/integration/test_data_sources.py -q` passed; web-side boundary grep for direct `src.backend.open_meteo`, `src.backend.pipeline`, and `src.backend.cache` imports returned no matches; targeted ruff check passed.
- Slice 3 completed and pushed: `f4403ad`; extracted homepage formatter helpers to `assets/js/weather_page_formatters.js`; `python3 -m pytest tests/frontend/test_renderers.py tests/integration/test_web_server.py -q`, `python3 -m pytest tests/integration/test_cli.py::test_copy_static_assets_copies_css_and_js -q`, `python3 scripts/lint_assets.py --html`, and targeted ruff passed; `python3 scripts/lint_assets.py --js` is blocked locally by missing Node; browser preview loaded formatter and main scripts with no console errors.
