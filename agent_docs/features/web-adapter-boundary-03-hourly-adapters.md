# Atomic Feature Request

## Request ID
- `web-adapter-boundary-03-hourly-adapters`

## Title
- Add hourly payload adapters

## Feature Branch
- `ljcc/feature/web-adapter-boundary-refactor`

## Dependencies
- `web-adapter-boundary-01-backend-services`: Hourly adapter work needs a public backend hourly-payload service before web-side consumers can stop importing backend server internals.

## Background
- Hourly payload loading currently leaks across the boundary in two places:
- `src/web/weather_page_server.py` imports `_hourly_payload_for_resort` for `/api/resort-hourly`
- `src/web/pipelines/static_site.py` imports the same helper to write `site/resort/<resort_id>/hourly.json`
- That keeps hourly behavior coupled to a backend server module instead of an adapter/client abstraction parallel to the request-payload flow.

## Goal
- Add an hourly-payload adapter entrypoint under `src/web/data_sources/` that supports `local|api|file` mode semantics, then migrate static hourly generation to use that adapter surface.
- The local adapter should call the new public backend hourly service, api mode should fetch `/api/resort-hourly`, and file mode should keep the current unsupported semantics explicit rather than silently inventing a fallback.

## Constraints / Forbidden Behaviors
- Do not leave any direct `src.backend.weather_data_server` imports in `src/web/pipelines/static_site.py` after this slice.
- Do not change the shape of generated `hourly.json` artifacts or successful `/api/resort-hourly` responses.
- Do not invent file-mode hourly support if the current product semantics are still “unavailable in file mode.”
- Do not bypass adapter modules when wiring dynamic and static hourly consumers.

## Acceptance Criteria
- [ ] `src/web/data_sources/` exposes an hourly-payload entrypoint or client abstraction covering `local`, `api`, and `file` modes with the same behavior expected today.
- [ ] `src/web/pipelines/static_site.py` uses the new hourly adapter surface instead of importing `_hourly_payload_for_resort` directly.
- [ ] Dynamic and static hourly flows now share adapter-owned local/api/file behavior rather than hand-coded logic in multiple consumers.
- [ ] Automated coverage verifies local and api hourly paths plus the explicit unsupported file-mode case.

## Test Plan
- Add targeted adapter tests for hourly payload loading.
- Run `python3 -m pytest tests/integration/test_data_sources.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py tests/backend/test_weather_data_server_hourly.py -q`.
- Run `python3 -m compileall src`.
