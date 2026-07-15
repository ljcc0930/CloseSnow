# Atomic Feature Request

## Request ID
- `alpine-field-guide-05-visual-hierarchy`

## Title
- Strengthen the Alpine Field Guide visual hierarchy.

## Feature Branch
- `ljcc/feature/alpine-field-guide`

## Dependencies
- `alpine-field-guide-04-integration-qa`: the complete homepage and resort-detail experience must be integrated before applying one coherent hierarchy system across both surfaces.

## Background
- The rebuilt experience is comprehensive and readable, but its white surfaces, thin borders, similarly weighted cards, and small key values make the page feel visually flat. Weather conclusions and important accumulation numbers do not separate strongly enough from supporting metadata at a glance.

## Goal
- Create a clear four-level visual hierarchy—canvas, section, card, and raised signal—so the most decision-relevant weather conclusion and measurement become immediately visible while all supporting daily and hourly information remains calm, legible, and reachable.

## Constraints / Forbidden Behaviors
- Do not change daily or hourly payload contracts, URLs, filter semantics, favorites, unit persistence, or Netlify behavior.
- Do not add an external design library, runtime framework, image dependency, ornamental photography, or emoji-based primary iconography.
- Do not create depth only by applying heavy shadows everywhere; elevation, spacing, typography, contrast, borders, and restrained color must work as one system.
- Do not make color the only carrier of ranking, weather type, risk, or state.
- Do not hide, truncate, or remove existing forecast information to make the design appear simpler.
- Preserve keyboard navigation, focus visibility, reduced-motion behavior, and mobile readability.

## Acceptance Criteria
- [ ] The homepage masthead, filters, Morning Picks, and resort directory have visibly distinct surface levels and section rhythm instead of reading as one continuous white plane.
- [ ] Morning Pick number one has a stronger but accessible treatment, and every pick presents its ranked snow or rain amount as a prominent measurement with a plain-language label.
- [ ] Each resort card gives its current condition, high/low temperature, and most relevant seven-day precipitation signal clear typographic priority over location metadata and secondary forecast days.
- [ ] Resort cards use consistent elevation, edge accents, and hover/focus behavior without reducing scan density or creating layout shift; reduced-motion users receive no transform animation.
- [ ] The resort-detail masthead and snapshot metrics read as a deliberate focal cluster, Today is unmistakable in the daily timeline, and hourly chart groups have stronger containment and metric hierarchy.
- [ ] Snow, rain, neutral, history, today, and forecast treatments remain distinguishable without relying on color alone.
- [ ] All existing disclosures, tabs, filters, favorites, unit switching, external links, raw data, and daily/hourly fields remain functional and accessible.
- [ ] Browser checks pass at desktop, tablet, and 390px mobile widths with no page-level horizontal overflow, clipped controls, or console warnings/errors.
- [ ] Repository lint, full tests, and include-all-resorts static generation pass.

## Test Plan
- `python3 scripts/lint_assets.py`
- `python3 -m ruff check .`
- `python3 -m pytest -q`
- `python3 -m src.cli static --output-dir /tmp/closesnow-field-guide-depth --max-workers 8 --include-all-resorts`
- Browser-test the homepage and representative rain-heavy and snow-heavy resort pages at desktop, tablet, and 390px mobile widths, including keyboard focus, reduced motion, unit switching, disclosures/tabs, and console inspection.
