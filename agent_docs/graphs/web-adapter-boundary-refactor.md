# Web Adapter Boundary Refactor

## Summary
- Restore the web/backend boundary promised by the v2/v4 architecture docs by removing direct backend pipeline/server-helper imports from web-side handlers and pipelines, then routing request-payload and hourly-payload resolution through explicit gateway/adapter surfaces.
- Preserve the current `local|api|file` runtime behavior, `/api/data` and `/api/resort-hourly` semantics, static hourly page generation, and existing filter behavior while making `src/backend/weather_data_server.py` and `src/web/weather_page_server.py` thinner and easier to maintain.

## Feature Branch
- `ljcc/feature/web-adapter-boundary-refactor`

## Global Assumptions
- The validation target in `docs/CODEBASE_VALIDATION_PLAYBOOK.md` remains authoritative: direct backend coupling in `src/web` should flow through communication adapters, not render handlers.
- `src/web/weather_page_server.py` and `src/web/pipelines/static_site.py` are both in scope because each currently bypasses the adapter boundary for runtime/hourly behavior.
- Web-facing code may depend on public backend services behind adapter modules when running in `local` mode, but it must not import underscore-prefixed backend server helpers or live pipeline functions outside `src/web/data_sources/local_source.py`.
- The refactor should keep current response shapes and page output compatible so follow-on UI work does not need contract changes.

## Atomic Requests
- `web-adapter-boundary-01-backend-services`: Publish public backend services for request selection/filter metadata and per-resort hourly payload construction.
- `web-adapter-boundary-02-request-adapters`: Extend the web data-source gateway so request payload loading and filter metadata resolution live behind adapter/client interfaces.
- `web-adapter-boundary-03-hourly-adapters`: Add hourly payload adapters and migrate static hourly generation off direct backend server imports.
- `web-adapter-boundary-04-web-server-migration`: Move the dynamic web server to adapter-only dependencies and refresh boundary-focused tests.

## Dependency Graph
- `web-adapter-boundary-01-backend-services` -> `web-adapter-boundary-02-request-adapters`
- `web-adapter-boundary-01-backend-services` -> `web-adapter-boundary-03-hourly-adapters`
- `web-adapter-boundary-02-request-adapters` -> `web-adapter-boundary-04-web-server-migration`
- `web-adapter-boundary-03-hourly-adapters` -> `web-adapter-boundary-04-web-server-migration`

## Notes
- The split keeps backend contract extraction as the only prerequisite node, then allows request-adapter and hourly-adapter work to proceed in parallel with disjoint primary write scopes.
- The final migration node should explicitly prove the boundary outcome with grep-based checks so the repo state matches the intent already documented in `docs/CODEBASE_VALIDATION_PLAYBOOK.md`.
