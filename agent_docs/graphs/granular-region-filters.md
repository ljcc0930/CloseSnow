# Granular Region Filters

## Summary
- Refine the homepage `Region` filter from coarse `west|east|intl` buckets into the image-aligned subregions `Rockies`, `West Coast`, `Midwest`, `Mid-Atlantic`, `Northeast`, `Europe`, `Asia`, `Australia / New Zealand`, and `South America`, and replace select-based filter controls with multiselect UI. Keep the existing coarse `region` metadata for compatibility, but drive the new browsing experience from an explicit resort-level `subregion` taxonomy so ambiguous areas such as British Columbia can be curated safely.

## Feature Branch
- `ljcc/feature/granular-region-filters`

## Global Assumptions
- The catalog keeps legacy coarse `region` values (`west|east|intl`) for compatibility and adds a new explicit `subregion` field for the homepage filter contract.
- `subregion` is curated per resort rather than derived only from `state` or `country`.
- Region and country filters become checkbox-based multiselect controls.
- Sort remains single-choice and stays a dropdown.
- Dynamic API mode must continue to work when the homepage refetches `/api/data` after filter changes.

## Atomic Requests
- `granular-region-filters-01-subregion-contract`: Add the subregion catalog taxonomy and multi-value filter contract.
- `granular-region-filters-02-multiselect-filter-ui`: Replace homepage region and country dropdown filters with multiselect controls while keeping sort as a dropdown.

## Dependency Graph
- `granular-region-filters-01-subregion-contract` -> `granular-region-filters-02-multiselect-filter-ui`

## Notes
- British Columbia is the forcing case for explicit resort-level assignments. For example, `whistler-blackcomb-bc` can live in `west-coast` while interior BC resorts can live in `rockies`.
- Keep the user-facing label as `Region` even when the underlying data field is `subregion`.
