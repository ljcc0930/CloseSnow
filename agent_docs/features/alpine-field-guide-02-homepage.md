# Atomic Feature Request

## Request ID
- `alpine-field-guide-02-homepage`

## Title
- Rebuild the homepage forecast decision board.

## Feature Branch
- `ljcc/feature/alpine-field-guide`

## Dependencies
- `alpine-field-guide-01-foundation`: shared theme, icon, copy, and unit APIs must be available before page composition begins.

## Background
- The homepage currently combines a large marketing hero with six dense tables. Real forecast information falls below the first viewport, metric meaning is scattered across separate sections, and mobile users must infer horizontal scrolling. The rebuild may replace tables as long as the complete daily information remains available.

## Goal
- Turn the homepage into a compact, user-readable mountain morning report where people can identify promising resorts, understand why they rank well, search/filter the catalog, and inspect every resort's 14-day weather details without interpreting spreadsheet-like tables.

## Constraints / Forbidden Behaviors
- Preserve resort search, region/pass/default/favorites filters, sorting semantics, favorites persistence, resort links, generated/model metadata, and all available daily fields.
- Do not remove snow, rain, high/low temperature, weather condition, sunrise, sunset, week-one, or week-two information; reorganize it through summaries and progressive disclosure.
- Do not rely on native emoji, unexplained heat-map cell colors, hidden-only hover content, or desktop-only interactions.
- Do not modify the resort-detail page beyond shared-foundation compatibility.
- Avoid rendering a separate full-width table for each metric.

## Acceptance Criteria
- [ ] At 1280x720 the first viewport contains real forecast guidance, not only branding and controls; at 390x844 a user reaches forecast results without scrolling through a large decorative hero.
- [ ] A compact masthead communicates page purpose, data freshness, model, visible resort count, and global unit setting without decorative mountain artwork consuming the viewport.
- [ ] The top insight area ranks useful candidates and explains each choice in plain language with a stable condition icon, relevant seven-day snow/rain signal, best-day context, and temperature context.
- [ ] Search and filters remain fully functional, show the resulting count/active state, and use a keyboard-accessible desktop panel plus a touch-friendly mobile sheet or equivalent compact treatment.
- [ ] The primary result is a responsive list/grid of resort forecast cards. Each collapsed card communicates location, favorite state, user-readable outlook, today, week-one/week-two totals, and a short near-term preview.
- [ ] Expanding or opening a resort card exposes all forecast days and, for every available day, date, condition name/icon, high/low, snow, rain, sunrise, and sunset in a readable layout.
- [ ] Metric/Imperial switching updates all visible and disclosed measurements consistently through the shared preference.
- [ ] Resort cards and daily details remain usable with keyboard navigation, visible focus, reduced motion, 200% text zoom, and 390px width without page-level horizontal overflow.
- [ ] Empty, loading, missing-value, no-snow, and filter-no-results states use honest plain-language copy.
- [ ] Existing homepage behavior tests are updated and focused tests cover ranking explanations, complete day disclosure, filters/favorites, unit rendering, and safe HTML escaping.

## Test Plan
- `python3 scripts/lint_assets.py`
- `pytest -q tests/frontend/test_renderers.py tests/frontend/test_styles_and_transform.py tests/frontend/test_static_site_pipeline.py tests/frontend/test_day_label_html.py tests/test_lint_assets.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-field-guide-homepage --max-workers 8 --include-all-resorts`
- Browser-check the generated homepage at 1440x1000, 1280x720, 768x1024, and 390x844; exercise search, filters, favorite, disclosure, resort navigation, and unit switching.
