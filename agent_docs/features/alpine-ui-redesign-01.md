# Atomic Feature Request

## Request ID
- `alpine-ui-redesign-01`

## Title
- Redesign homepage and resort detail presentation

## Feature Branch
- `ljcc/feature/alpine-ui-redesign`

## Dependencies
- None.

## Background
- The current site exposes useful forecast data but presents the homepage primarily as a stack of dense tables. The resort page has some card treatment but lacks the same product identity and clear task hierarchy. On narrow screens, the detailed tables consume most of the first viewport and the loading shell repeats plain text for every section.

## Goal
- Deliver a cohesive alpine weather dashboard across the homepage and resort detail pages. Add a branded page shell and a concise, data-derived homepage overview, improve search/filter and section hierarchy, replace repetitive loading text with a polished skeleton, and make the detail page easier to scan without removing its timeline, airport, charts, or hourly table.

## Constraints / Forbidden Behaviors
- Do not change backend weather fetching, payload schemas, resort identifiers, routing, filter semantics, favorites behavior, or unit conversions.
- Do not remove any existing detailed forecast section, hourly metric, airport information, external link, or accessibility label.
- Do not add a frontend framework, build step, third-party font request, or raster artwork dependency.
- Preserve static-site generation and dynamic-server rendering from the same templates and assets.

## Acceptance Criteria
- [ ] The homepage has a recognizable CloseSnow brand shell, prominent forecast-oriented hero copy, and a compact control surface that works at desktop and mobile widths.
- [ ] After payload load, the homepage renders an at-a-glance overview of the strongest visible weekly snowfall candidates using existing report data and links to their resort pages.
- [ ] The homepage loading state uses structured skeleton surfaces while retaining accessible section headings.
- [ ] All six detailed homepage forecast sections remain present and functional, with visually separated section cards, readable tables, and unit/favorite/filter interactions intact.
- [ ] The resort page uses the same visual system and groups its identity, daily timeline, travel information, hourly controls, charts, and raw table into a clearer responsive hierarchy.
- [ ] At a 390px viewport, content does not create page-level horizontal overflow; horizontally scrollable forecast tables remain contained and communicate their scroll behavior visually.
- [ ] Existing renderer, frontend, integration, smoke, lint, and static-site validation checks pass.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_renderers.py tests/frontend/test_static_site_pipeline.py tests/frontend/test_resort_hourly_context.py`
- `./scripts/lint.sh`
- `python3 -m pytest -q`
- `python3 -m src.cli static --output-dir /tmp/closesnow-alpine-ui --max-workers 8`
- Inspect the generated homepage and a generated resort detail page at desktop and 390px mobile widths.
