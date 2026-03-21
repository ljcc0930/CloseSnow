# Atomic Feature Request

## Request ID
- `web-adapter-boundary-04-web-server-migration`

## Title
- Migrate web server to adapters only

## Feature Branch
- `ljcc/feature/web-adapter-boundary-refactor`

## Dependencies
- `web-adapter-boundary-02-request-adapters`: The dynamic web server needs adapter-owned request-payload behavior before it can stop importing backend selection/filter helpers directly.
- `web-adapter-boundary-03-hourly-adapters`: The dynamic web server and resort-page flow need adapter-owned hourly loading before they can drop direct backend hourly imports.

## Background
- `src/web/weather_page_server.py` still imports backend live-pipeline and backend server helpers directly even though the repo’s validation playbook says direct backend coupling in web should be contained behind adapters.
- The current tests also reinforce that coupling by monkeypatching backend symbols through `src.web.weather_page_server` instead of patching gateway/client interfaces.

## Goal
- Rewrite `src/web/weather_page_server.py` so it depends only on web-layer adapters/gateway surfaces plus rendering/assets/context helpers, while preserving current route behavior for `/`, `/api/data`, `/api/resort-hourly`, `/resort/<id>`, and `/api/health`.
- Update integration and smoke coverage so adapter seams are the primary test hooks and the intended boundary is explicitly verified.

## Constraints / Forbidden Behaviors
- Do not change route paths, query semantics, or rendered HTML structure as part of the dependency cleanup.
- Do not reintroduce direct imports from `src.backend.pipelines.live_pipeline` or `src.backend.weather_data_server` into `src/web/weather_page_server.py`.
- Do not bypass adapters for “just one mode”; `local`, `api`, and `file` should all route through the same web-facing abstraction layer.
- Do not forget `src/web/pipelines/static_site.py` when validating the final boundary result; this larger request is not complete if static hourly generation still leaks backend server imports.

## Acceptance Criteria
- [ ] `src/web/weather_page_server.py` contains no direct imports from `src.backend.pipelines.live_pipeline` or `src.backend.weather_data_server`.
- [ ] Request payload and hourly route behavior remains compatible across `local`, `api`, and `file` modes, including the existing distinction between `/api/data` query forwarding and HTML-root filter stripping.
- [ ] Integration tests for the dynamic web server now patch adapter/gateway entrypoints or client classes instead of backend helpers imported through the web server module.
- [ ] Boundary checks confirm that `rg -n "from src\\.backend\\.pipelines\\.live_pipeline" src/web -S` reports only `src/web/data_sources/local_source.py`, and `rg -n "from src\\.backend\\.weather_data_server" src/web -S` reports no matches.

## Test Plan
- Run `python3 -m pytest tests/integration/test_web_server.py tests/integration/test_cli.py tests/integration/test_entrypoints.py tests/smoke/test_dynamic_server_smoke.py -q`.
- Run `rg -n "from src\\.backend\\.pipelines\\.live_pipeline" src/web -S`.
- Run `rg -n "from src\\.backend\\.weather_data_server" src/web -S`.
- Run `python3 -m compileall src`.
