# Atomic Feature Request

## Request ID
- `runtime-static-architecture-02-static-builder`

## Title
- Unify split and one-shot static site builds

## Feature Branch
- `ljcc/feature/runtime-static-architecture`

## Dependencies
- `runtime-static-architecture-01-runtime-options`: static build requests must reuse the shared runtime contract.
- `runtime-static-architecture-03-asset-manifest`: static rendering and validation must consume the canonical asset inventory.

## Background
- Static orchestration is duplicated across the unified CLI, the legacy static renderer, and low-level rendering functions. A clean `fetch` followed by `render` currently does not produce the sibling hourly JSON files promised by the README because fetch writes only `data.json` and render merely looks for hourly files that do not exist.

## Goal
- Introduce one static build service with explicit request/result artifacts so split `fetch`/`render`, one-shot `static`, `serve-static`, and the legacy renderer share the same fetch and render stages and produce a deployable, validated artifact tree.

## Constraints / Forbidden Behaviors
- Preserve CLI command names, flags, defaults, exit conventions, payload schema, generated URLs, and the existing `site/resort/<resort_id>/` layout.
- Render-only execution must consume an existing artifact bundle without network or backend fetch calls.
- Do not silently reuse stale hourly JSON for a resort when the matching fetched bundle does not contain it; cleanup must be restricted to builder-owned artifacts beneath the selected output roots.
- Do not change live or API server behavior.

## Acceptance Criteria
- [ ] Typed static build request/result (or equivalently explicit immutable contracts) make fetched daily JSON, per-resort hourly JSON, rendered HTML, and copied assets observable as one build result.
- [ ] The fetch stage writes `data.json` plus per-resort sibling `hourly.json` artifacts using the shared runtime options and the routine worker count.
- [ ] The render stage is offline: it reads the fetched bundle, writes the homepage and resort pages, preserves/copies hourly JSON into the selected output tree, copies canonical assets, and validates required artifacts.
- [ ] Clean split `fetch` + `render` and one-shot `static` builds produce equivalent required artifact trees, including hourly page context pointing to `./hourly.json`.
- [ ] `static --skip-fetch`, `static --skip-render`, an external `--output-json`, and `serve-static` preserve their documented meanings through the shared service.
- [ ] The legacy `weather_page_static_render` entry point delegates to the same service rather than maintaining a separate orchestration path.
- [ ] Smoke and integration tests assert actual hourly artifacts and offline render behavior, not only homepage HTML.

## Test Plan
- `python3 -m pytest tests/frontend/test_static_site_pipeline.py tests/integration/test_cli.py tests/integration/test_entrypoints.py tests/smoke/test_static_pipeline_smoke.py -q`
- `python3 -m src.cli static --output-dir /tmp/closesnow-runtime-static --max-workers 8`
- `python3 -m pytest -q`
