# Resort Airport Access

## Summary
- Add a nearby-airport access section to each resort hourly page so users can quickly see which commercial airports are practical entry points for that mountain without leaving CloseSnow.
- Version 1 should stay static-friendly: use a curated airport catalog plus resort/airport coordinates to compute approximate mileage, show airports within 250 miles, and be explicit that this is a rough access radius rather than exact drive-time routing.

## Feature Branch
- `ljcc/feature/resort-airport-access`

## Global Assumptions
- The airport list should prioritize commercial/public passenger airports and exclude private strips, heliports, and seaplane bases even if they are geographically closer to the resort.
- The 250-mile cutoff is a static approximation for "roughly within a 3-hour access window"; UI copy must not claim an exact drive ETA unless a real routing provider is added later.
- Version 1 distance values should be great-circle miles computed from stored resort and airport coordinates, then rounded for display; route-aware road mileage is a future enhancement.
- Every resort page should handle no-match and no-catalog cases gracefully with explicit copy instead of hiding the module or failing bootstrap.
- Additive airport fields may extend `weather_payload_v1` report objects without a schema-version bump as long as existing required fields remain intact.

## Atomic Requests
- `resort-airport-access-01-airport-catalog`: Add a curated airport catalog and a shared backend selector for nearby commercial airports.
- `resort-airport-access-02-resort-payload`: Thread nearby-airport data into resort reports, resort bootstrap context, and hourly API/static payloads.
- `resort-airport-access-03-resort-page-ui`: Render the nearby-airport section on static and dynamic resort pages.

## Dependency Graph
- `resort-airport-access-01-airport-catalog` -> `resort-airport-access-02-resort-payload`
- `resort-airport-access-02-resort-payload` -> `resort-airport-access-03-resort-page-ui`

## Notes
- The nearby-airport selector should be shared between full payload generation and `/api/resort-hourly` so static and dynamic resort pages produce the same airport list.
- If a future routing provider is added, it should enrich the same airport contract with route-aware data rather than replacing the curated catalog path.
