# Atomic Feature Request

## Request ID
- `resort-map-link-01-page-cta`

## Title
- Add top-level resort Google Maps CTA

## Feature Branch
- `ljcc/feature/resort-map-link`

## Dependencies
- None.

## Background
- Resort hourly pages already expose coordinate-verification links in the `hourly-meta` row, and those coordinates already open Google Maps.
- That behavior is useful for validation, but it is not an obvious user-facing "open the resort location" action because it is embedded inside a dense meta line with timezone/model text.
- The top of the resort page currently has the title, local time, and official website, which is the right place for a simpler location CTA.

## Goal
- Add a clearly labeled Google Maps link near the resort page header so users can open the resort's location directly from the page.

## Constraints / Forbidden Behaviors
- Do not remove, rename, or regress the existing coordinate-verification flow in the `hourly-meta` row.
- Do not use `resolved_latitude` / `resolved_longitude` for the new CTA; those describe the forecast grid, not the resort location.
- Do not introduce backend or payload-contract changes in this slice unless absolutely required to preserve current resort-page behavior.
- Do not render a broken or empty anchor when resort coordinates are unavailable; omit the CTA or render a non-link fallback.
- Do not add a bulky map embed, iframe, or additional fetch path for this feature.

## Acceptance Criteria
- [ ] The resort hourly page template includes a dedicated container near the page title / website area for a resort-location CTA.
- [ ] Resort-page JS renders a clearly labeled Google Maps link in that container using the existing Google Maps URL builder and `payload.input_latitude` / `payload.input_longitude`.
- [ ] The CTA appears on both static and dynamic resort pages after hourly payload load, while the existing website link, timeline, hourly content, and coordinate-reporting links continue to work.
- [ ] If resort coordinates are missing, the page does not render a broken link and the rest of the resort page still behaves normally.
- [ ] Automated coverage verifies the new container/label path in assets and rendered resort-page HTML.

## Test Plan
- Update targeted frontend and integration coverage for the new resort-location CTA.
- Run `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`.
- Run `python3 -m src.cli static --output-dir /tmp/closesnow-resort-map-link --max-workers 8 --resort "Snowbird, UT"` and manually confirm the generated resort page shows the Google Maps CTA near the header.
