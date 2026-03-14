# Atomic Feature Request

## Request ID
- `us-snowfall-map-polish-02-visual-redesign`

## Title
- Redesign map hierarchy and mobile layout

## Feature Branch
- `ljcc/feature/us-snowfall-map`

## Dependencies
- `us-snowfall-map-polish-01-real-basemap`: requires the real map surface and control model before final hierarchy and responsive layout can be stabilized.

## Background
- In the live build, the map section still reads like a preview: subtitle copy says “Preview,” the legend/meta column feels heavier than the map itself, and popup styling competes with the rest of the page.
- The section needs product-level hierarchy, not just more ornament.

## Goal
- Redesign the map section so it communicates trust and utility immediately on desktop and mobile.
- This includes:
- replacing preview/prototype copy with production-facing wording
- simplifying the legend and status treatment
- tightening popup information hierarchy
- making the mobile layout feel intentional instead of squeezed

## Constraints / Forbidden Behaviors
- Do not rely on decorative gradients and chrome to carry the section.
- Do not let the legend/sidebar dominate the actual map on common laptop widths.
- Do not hide essential state only inside popups.
- Do not introduce a redesign that breaks existing homepage typography or control language.

## Acceptance Criteria
- [ ] The map section no longer reads like a preview or placeholder in copy, layout, or status text.
- [ ] The desktop layout gives the geographic map primary visual weight over supporting legend/status content.
- [ ] The mobile layout remains readable and touch-friendly without obscuring core controls or popup content.
- [ ] Popups, legend, and status elements feel like one coherent product surface instead of separate demo widgets.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-us-map-redesign --max-workers 8`
