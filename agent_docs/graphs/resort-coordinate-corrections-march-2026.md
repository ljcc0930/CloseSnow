# March 2026 Resort Coordinate Corrections

## Summary
- Turn the current open GitHub coordinate-correction backlog into worker-ready data-fix requests that add explicit resort coordinate overrides where CloseSnow is still rendering the wrong map point.
- The coordinate override mechanism already exists in `resorts.yml` and is already consumed by the hourly/static payload path, so this design focuses on verified catalog corrections rather than new backend or frontend plumbing.

## Feature Branch
- `ljcc/feature/resort-coordinate-corrections-march-2026`

## Global Assumptions
- Workers should prefer adding verified `latitude` / `longitude` values to the matching `resorts.yml` entry and should not introduce a second coordinate storage path for this batch.
- Each issue currently reports a wrong displayed point but does not supply the corrected coordinate, so the worker must verify the replacement coordinates from authoritative resort or mapping evidence before editing the catalog.
- All requests touch `resorts.yml`; keep diffs scoped to one resort entry per request and rebase frequently against the feature branch to limit merge conflicts.
- Existing automated coverage for catalog coordinate overrides is sufficient for the shared mechanism; per-request validation should emphasize targeted catalog inspection plus static/hourly spot checks.

## Atomic Requests
- `coordinate-fixes-19-crystal-mountain-wa`: Correct Crystal Mountain catalog coordinates (GitHub issue #19)
- `coordinate-fixes-20-heavenly-ca`: Correct Heavenly catalog coordinates (GitHub issue #20)
- `coordinate-fixes-21-june-mountain-ca`: Correct June Mountain catalog coordinates (GitHub issue #21)
- `coordinate-fixes-22-mammoth-mountain-ca`: Correct Mammoth Mountain catalog coordinates (GitHub issue #22)
- `coordinate-fixes-23-northstar-ca`: Correct Northstar catalog coordinates (GitHub issue #23)
- `coordinate-fixes-24-palisades-tahoe-ca`: Correct Palisades Tahoe catalog coordinates (GitHub issue #24)
- `coordinate-fixes-25-sierra-at-tahoe-ca`: Correct Sierra-at-Tahoe catalog coordinates (GitHub issue #25)
- `coordinate-fixes-26-snow-valley-ca`: Correct Snow Valley catalog coordinates (GitHub issue #26)
- `coordinate-fixes-27-arapahoe-basin-co`: Correct Arapahoe Basin catalog coordinates (GitHub issue #27)
- `coordinate-fixes-28-aspen-snowmass-co`: Correct Aspen Snowmass catalog coordinates (GitHub issue #28)
- `coordinate-fixes-29-copper-mountain-co`: Correct Copper Mountain catalog coordinates (GitHub issue #29)
- `coordinate-fixes-30-steamboat-co`: Correct Steamboat catalog coordinates (GitHub issue #30)
- `coordinate-fixes-31-winter-park-co`: Correct Winter Park catalog coordinates (GitHub issue #31)
- `coordinate-fixes-32-boyne-mountain-mi`: Correct Boyne Mountain catalog coordinates (GitHub issue #32)
- `coordinate-fixes-33-mt-brighton-mi`: Correct Mt Brighton catalog coordinates (GitHub issue #33)

## Dependency Graph
- None. All requests are independent and may run in parallel once claimed, subject to ordinary merge/rebase coordination on `resorts.yml`.

## Notes
- Do not resolve these issues with guessed nearby-city coordinates; use the official resort base area or another reviewer-auditable point that best matches the page intent.
- If a worker cannot establish a confident replacement coordinate from available evidence, the correct outcome is a `.fail` sidecar that explains the missing evidence rather than a speculative catalog edit.
