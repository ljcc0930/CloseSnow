# Atomic Feature Request

## Request ID
- `runtime-static-architecture-01-runtime-options`

## Title
- Introduce typed weather runtime request contracts

## Feature Branch
- `ljcc/feature/runtime-static-architecture`

## Dependencies
- None.

## Background
- Cache path, cache TTLs, worker count, and retry count are forwarded repeatedly through CLI, pipeline, service, server, and data-source layers. The static pipeline is also an alias over a live facade, producing several layers that add no domain behavior.

## Goal
- Add frozen, typed value objects for weather runtime settings and payload build requests, route the core payload use case through those objects, and retain existing function signatures as compatibility adapters.

## Constraints / Forbidden Behaviors
- Do not change CLI flags or defaults, payload JSON shape, cache keys, coordinate-cache seed order, resort-selection semantics, or output file behavior.
- Do not remove legacy public entry points or break tests that patch their module-level collaborators; adapters must remain thin and observable.
- Do not broaden this request into the Open-Meteo transport split, catalog model migration, or a cache persistence behavior change.

## Acceptance Criteria
- [ ] A frozen `WeatherRuntimeOptions` contract owns `cache_file`, `geocode_cache_hours`, `forecast_cache_hours`, `max_workers`, and `api_retries` with current defaults.
- [ ] A frozen payload build request contract owns resort selection inputs, output/seed context, and one runtime-options instance without mutable default values.
- [ ] The core payload computation accepts the request contract directly; existing `compute_pipeline_payload`, live/static pipeline facades, and service entry points construct or forward one request instead of re-forwarding the five runtime fields through every internal layer.
- [ ] Existing callers using keyword arguments continue to work, and focused contract tests prove equivalent arguments reach the core path through live, static, and local data-source facades.
- [ ] Payload, pipeline, CLI, data-source, and server tests remain behaviorally green.

## Test Plan
- `python3 -m pytest tests/backend/test_pipeline.py tests/integration/test_data_sources.py tests/integration/test_cli.py tests/integration/test_backend_data_server.py -q`
- `python3 -m pytest tests/smoke/test_static_pipeline_smoke.py tests/smoke/test_decoupled_pipeline_smoke.py -q`
- `python3 -m ruff check src tests`
