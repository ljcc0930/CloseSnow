# Atomic Feature Request

## Request ID
- `web-adapter-boundary-01-backend-services`

## Title
- Publish backend request and hourly services

## Feature Branch
- `ljcc/feature/web-adapter-boundary-refactor`

## Dependencies
- None.

## Background
- `src/web/weather_page_server.py` currently imports `run_live_payload` plus underscore-prefixed helpers from `src.backend.weather_data_server`, and `src/web/pipelines/static_site.py` directly imports `_hourly_payload_for_resort`.
- That coupling means the web layer is depending on backend server internals rather than stable backend services, even though the validation playbook says web/backend communication should flow through adapter boundaries.

## Goal
- Extract stable public backend service APIs for:
- request/filter selection and related filter metadata
- default filter metadata synthesis for payload consumers
- per-resort hourly payload construction
- Update `src/backend/weather_data_server.py` to consume those public services so HTTP routing becomes a thin wrapper over reusable backend logic instead of the only place those behaviors live.

## Constraints / Forbidden Behaviors
- Do not change `/api/data`, `/api/resorts`, or `/api/resort-hourly` semantics while extracting the shared logic.
- Do not leave the adapter layer dependent on underscore-prefixed backend server helpers after this slice.
- Do not introduce any `src.web` imports into backend modules.
- Do not fork request-selection or hourly-payload logic into multiple backend call paths; this slice is the unification point.

## Acceptance Criteria
- [ ] Public backend service function(s) exist for request selection/filter metadata and per-resort hourly payload construction, with names and module locations suitable for adapter reuse.
- [ ] `src/backend/weather_data_server.py` delegates to those public services instead of owning the sole implementation of those behaviors.
- [ ] Existing backend endpoint tests continue to pass without response-shape regressions for `/api/data`, `/api/resorts`, and `/api/resort-hourly`.
- [ ] Any new service-level tests cover at least one no-match filter case and one successful per-resort hourly payload case.

## Test Plan
- Add targeted backend tests for the new public service modules or functions.
- Run `python3 -m pytest tests/backend/test_weather_data_server_filters.py tests/backend/test_weather_data_server_hourly.py tests/integration/test_backend_data_server.py -q`.
- Run `python3 -m compileall src`.
