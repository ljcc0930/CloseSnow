# Resort Map Link

## Summary
- Add a clear Google Maps entry point to each resort hourly page so users can open the resort's location without having to interpret the coordinate-verification links in the meta row.
- This is a productization pass on top of the existing coordinate-link behavior: keep the current verification/reporting flow, but add a more obvious resort-location CTA near the page header.

## Feature Branch
- `ljcc/feature/resort-map-link`

## Global Assumptions
- The CTA should use the resort's own coordinates (`input_latitude` / `input_longitude`), not the forecast-grid coordinates, because the user intent is "open the resort location."
- Reuse the existing Google Maps search URL pattern already present in the resort hourly page code; do not introduce a second map provider or a second URL shape for the same action.
- Version 1 should stay frontend-only and build from the current hourly payload contract. If a future pass wants the CTA before hourly fetch completion, that can be a separate bootstrap-data enhancement.
- Keep the existing `Resort coords`, `Forecast grid`, and `(Wrong coordinates?)` meta-row links intact.

## Atomic Requests
- `resort-map-link-01-page-cta`: Add a dedicated resort-location Google Maps CTA near the top of static and dynamic resort pages.

## Dependency Graph
- None.

## Notes
- The CTA should degrade safely: if resort coordinates are unavailable, do not render a broken anchor.
- Prefer a short, user-facing label such as `View resort on Google Maps` or `Resort location`.
