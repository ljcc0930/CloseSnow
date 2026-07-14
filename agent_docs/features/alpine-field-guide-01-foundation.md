# Atomic Feature Request

## Request ID
- `alpine-field-guide-01-foundation`

## Title
- Build the Alpine Field Guide frontend foundation.

## Feature Branch
- `ljcc/feature/alpine-field-guide`

## Dependencies
- None.

## Background
- The current homepage and resort detail each carry a legacy stylesheet plus a large theme override, repeat design tokens and brand-shell rules, and use operating-system emoji for important weather meaning. The comprehensive rebuild needs one stable visual and language foundation before either page is restructured.

## Goal
- Deliver shared repository-native primitives for the Alpine Field Guide visual system, semantic weather/metric icons, plain-language forecast descriptions, and a site-wide unit preference that both page rebuilds can consume.

## Constraints / Forbidden Behaviors
- Do not change daily or hourly API/payload contracts.
- Do not add an external UI framework, icon CDN, webfont CDN, or runtime image dependency.
- Do not implement the final homepage or resort-detail information architecture in this request.
- Colors must have stable semantics: glacier blue for snow/cold, pine/teal for rain, signal orange for Today or genuine attention states, and neutral ink/paper for structure.
- Primary forecast meaning must not depend on color alone.

## Acceptance Criteria
- [ ] Both page templates load one shared foundation asset that owns tokens, typography, brand header, focus states, buttons, cards, tabs/disclosures, numeric formatting, and responsive spacing primitives.
- [ ] Shared styles define a compact 56px desktop/mobile-capable header, minimum 14px body copy, tabular numerals, restrained radii, and shadows reserved for overlays or true elevation.
- [ ] A shared JavaScript weather-icon API renders consistent inline SVG for supported WMO conditions and has an accessible text label; primary forecast UI no longer needs native emoji.
- [ ] Shared copy helpers can produce user-readable condition names and concise snow/rain/temperature outlook language from existing daily values, including safe handling of missing data.
- [ ] A shared Metric/Imperial preference is persisted once and can format temperature, snow, rain, distance, and unit labels for both pages; existing stored preferences degrade safely.
- [ ] Asset discovery/static-site generation includes the new shared files for root and nested resort pages.
- [ ] Targeted frontend tests cover icon labels, copy fallbacks, unit conversions, template asset inclusion, and asset linting.

## Test Plan
- `python3 scripts/lint_assets.py`
- `pytest -q tests/frontend/test_renderers.py tests/frontend/test_styles_and_transform.py tests/frontend/test_static_site_pipeline.py tests/test_lint_assets.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-field-guide-foundation --max-workers 8 --include-all-resorts`
- Inspect generated root and one nested resort HTML file to confirm shared asset paths resolve.
