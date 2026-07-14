# Atomic Feature Request

## Request ID
- `alpine-field-guide-04-integration-qa`

## Title
- Integrate and harden the Alpine Field Guide experience.

## Feature Branch
- `ljcc/feature/alpine-field-guide`

## Dependencies
- `alpine-field-guide-02-homepage`: the rebuilt homepage must be merged before cross-page integration.
- `alpine-field-guide-03-resort-detail`: the rebuilt resort detail must be merged before cross-page integration.

## Background
- The two page rebuilds share assets, preferences, responsive breakpoints, and navigation. A final integration pass is required to remove superseded CSS/JavaScript paths, reconcile independently implemented details, and verify the complete static product rather than treating passing unit tests as sufficient visual evidence.

## Goal
- Deliver one coherent, production-ready Alpine Field Guide frontend across homepage and resort pages, with legacy presentation removed, accessibility and responsive behavior verified, and comprehensive information preserved.

## Constraints / Forbidden Behaviors
- Do not add net-new product scope or change weather payload contracts.
- Do not restore the old table-first layout as a shortcut for missing information.
- Do not leave duplicate legacy/theme override layers, unused primary emoji renderers, conflicting unit state, or inconsistent tokens between pages.
- Do not mark the request complete without browser evidence at desktop, tablet, and mobile widths.

## Acceptance Criteria
- [ ] Shared assets load once and both pages use the same header, tokens, typography, icons, unit preference, focus treatment, and plain-language conventions.
- [ ] Superseded presentation rules and dead page-specific UI code are removed or clearly isolated; asset manifests and static output contain no broken paths.
- [ ] Homepage-to-resort navigation, back navigation, filters, favorites, disclosures/tabs, hourly range refresh, website/map links, and raw-data access work end to end.
- [ ] All existing daily and hourly information remains reachable and understandable; missing values and zero-snow periods are described honestly without misleading recommendations.
- [ ] Keyboard-only navigation, focus order/return, semantic headings, labels, tab/disclosure states, reduced motion, contrast, and 200% zoom are checked on both page types.
- [ ] Browser validation passes at 1440x1000, 1280x720, 768x1024, and 390x844 with no page-level horizontal overflow, clipped interactive controls, or console errors.
- [ ] Repository lint, full test suite, and include-all-resorts static build pass.
- [ ] The final feature branch is ready for a single PR to `main` with Netlify Deploy Preview enabled.

## Test Plan
- `./scripts/lint.sh`
- `pytest -q`
- `python3 -m src.cli static --output-dir /tmp/closesnow-field-guide-final --max-workers 8 --include-all-resorts`
- Serve the static output and browser-test both page types at 1440x1000, 1280x720, 768x1024, and 390x844, including key interactions and console inspection.
