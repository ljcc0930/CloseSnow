# Alpine Field Guide Frontend Rebuild

## Summary
- Rebuild the CloseSnow homepage and resort-detail experience as an Alpine Field Guide: a compact, data-first mountain morning report that explains forecast implications in plain language, replaces the table-first information architecture with progressive-disclosure cards and focused data views, and remains comprehensive across every weather metric already available in the payloads.

## Feature Branch
- `ljcc/feature/alpine-field-guide`

## Global Assumptions
- Existing daily and hourly payload contracts, static-site URLs, filter semantics, favorites, and Netlify preview workflow remain compatible.
- The new interface may replace the current visual style, hero composition, tables, and chart presentation. It must not discard available forecast information.
- Primary content must be understandable without weather-domain expertise: pair important measurements with condition names, time windows, comparisons, and short decision-oriented explanations.
- Use repository-native HTML, CSS, and JavaScript without adding a runtime frontend framework or external UI/image dependency.
- Warm paper, deep ink, glacier blue, pine, and restrained signal orange form the shared visual language. Color communicates stable meaning rather than decoration.

## Atomic Requests
- `alpine-field-guide-01-foundation`: Build the shared design, icon, copy, and unit foundation.
- `alpine-field-guide-02-homepage`: Rebuild the homepage as a readable resort forecast decision board.
- `alpine-field-guide-03-resort-detail`: Rebuild resort detail as a focused daily and hourly field guide.
- `alpine-field-guide-04-integration-qa`: Reconcile both surfaces and complete responsive, accessible integration QA.

## Dependency Graph
- `alpine-field-guide-01-foundation` -> `alpine-field-guide-02-homepage`
- `alpine-field-guide-01-foundation` -> `alpine-field-guide-03-resort-detail`
- `alpine-field-guide-02-homepage` -> `alpine-field-guide-04-integration-qa`
- `alpine-field-guide-03-resort-detail` -> `alpine-field-guide-04-integration-qa`

## Notes
- Homepage and resort-detail implementation can proceed in parallel once the shared foundation is merged.
- The final integration request owns legacy-style removal and cross-page browser verification so the page workers can stay focused on their respective information architecture.
