# Alpine UI Redesign

## Summary
- Reframe the homepage and resort forecast pages as a cohesive alpine weather dashboard with a branded shell, a useful at-a-glance forecast layer, polished loading states, clearer section hierarchy, and responsive layouts that preserve the existing detailed forecast tables.

## Feature Branch
- `ljcc/feature/alpine-ui-redesign`

## Global Assumptions
- Existing weather payloads, filter semantics, favorites, unit switching, static deployment, and resort-page URLs remain unchanged.
- The redesign must be implemented with repository-native HTML, CSS, and JavaScript assets; it must not depend on a runtime image service or external UI framework.
- Detailed tables remain available for power users, but the first viewport should prioritize orientation and decision-making over raw table density.

## Atomic Requests
- `alpine-ui-redesign-01`: Redesign the homepage and resort detail presentation.

## Dependency Graph
- `alpine-ui-redesign-01` has no dependencies.

## Notes
- Homepage and resort-detail styling belong in one request because both surfaces share the same brand shell, design tokens, responsive breakpoints, and visual language.
