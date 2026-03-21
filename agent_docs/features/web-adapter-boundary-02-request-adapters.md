# Atomic Feature Request

## Request ID
- `web-adapter-boundary-02-request-adapters`

## Title
- Extend request payload adapters

## Feature Branch
- `ljcc/feature/web-adapter-boundary-refactor`

## Dependencies
- `web-adapter-boundary-01-backend-services`: Local-mode request adapters need stable public backend services for filter selection and metadata rather than importing server-private helpers.

## Background
- The existing gateway in `src/web/data_sources/gateway.py` only exposes a generic `load_payload(...)` path.
- `src/web/weather_page_server.py` therefore still owns important request logic itself: local-mode filter selection, query forwarding rules, and fallback `available_filters` / `applied_filters` synthesis when payloads come from `api` or `file` modes.

## Goal
- Add an adapter-level request-payload entrypoint so `local|api|file` request semantics live in `src/web/data_sources/` instead of inside `src/web/weather_page_server.py`.
- The adapter surface should own:
- local-mode filter query handling and attached filter metadata
- api-mode query forwarding for `/api/data`
- fallback synthesis of `available_filters` and `applied_filters` when non-local payloads omit them
- testable client construction that workers can monkeypatch without reaching through the web server into backend symbols

## Constraints / Forbidden Behaviors
- Do not break existing `load_payload(...)` callers used by CLI render/static flows unless they are intentionally upgraded in a backwards-compatible way.
- Do not duplicate filter-selection behavior between the web server and the adapter layer.
- Do not push request-URL rewriting into backend services; api/file source shaping still belongs on the web adapter side.
- Do not change the HTML-root rule that strips server-side filter params before loading page payloads.

## Acceptance Criteria
- [ ] `src/web/data_sources/` exposes a request-payload loading entrypoint whose behavior covers the current `/api/data` needs for `local`, `api`, and `file` modes.
- [ ] Local-mode request loading uses public backend services behind adapter/client modules and does not require `src/web/weather_page_server.py` to import backend selection helpers.
- [ ] Api-mode request loading still forwards query parameters to the configured `/api/data` source, while HTML-root page loading still avoids forwarding server-only filter params.
- [ ] Tests for request-payload behavior patch adapter/gateway surfaces or client classes rather than backend symbols imported through `src.web.weather_page_server`.

## Test Plan
- Add or update adapter-focused tests in `tests/integration/test_data_sources.py`.
- Run `python3 -m pytest tests/integration/test_data_sources.py tests/integration/test_web_server.py -q`.
- Run `python3 -m compileall src`.
