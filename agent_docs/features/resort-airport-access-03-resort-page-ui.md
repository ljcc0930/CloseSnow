# Atomic Feature Request

## Request ID
- `resort-airport-access-03-resort-page-ui`

## Title
- Render nearby airports on resort pages

## Feature Branch
- `ljcc/feature/resort-airport-access`

## Dependencies
- `resort-airport-access-02-resort-payload`: UI work depends on a stable nearby-airport contract in resort bootstrap data and hourly payloads.

## Background
- The resort hourly page currently shows the title, local time, official website, merged daily timeline, and hourly charts/table, but it does not expose any trip-access context.
- Users deciding whether a mountain is convenient to reach should not have to leave the resort page to guess the nearest fly-in options.

## Goal
- Add a dedicated nearby-airports section near the top of the resort page that renders the curated nearby-airport list, shows each airport's distance in miles, and works the same way for static and dynamic resort pages.

## Constraints / Forbidden Behaviors
- Do not claim the displayed mileage is an exact 3-hour drive time; copy should frame the section as nearby airports within roughly 250 miles.
- Do not add a heavy map embed, a separate fetch path, or a large table that crowds the existing resort-page layout.
- Do not hide the section while hourly data loads if bootstrap already provides airport data.
- Do not break the existing timeline, hourly charts, or hourly table layout on desktop or mobile.

## Acceptance Criteria
- [ ] The resort hourly page template includes a dedicated nearby-airports section and container in the upper page layout, positioned before the hourly controls and after the primary heading/meta area.
- [ ] Resort-page JS renders a compact list or card row for each nearby airport using `payload.nearby_airports` first and `dailySummary.nearbyAirports` as fallback, showing airport code, airport name/location, and rounded miles.
- [ ] The section renders an explicit empty state when no airport qualifies within the 250-mile radius or when airport catalog coverage is missing.
- [ ] Static and dynamic resort pages render the same nearby-airports module and preserve current hourly/timeline behavior across desktop and mobile breakpoints.

## Test Plan
- Add targeted frontend/integration coverage for the new HTML container, rendered airport labels, fallback copy, and asset changes.
- Run `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`.
- Run `python3 -m src.cli static --output-dir /tmp/closesnow-airport-access-ui --max-workers 8 --resort "Snowbird, UT"` and manually open the generated resort page to confirm section placement and responsive behavior.
