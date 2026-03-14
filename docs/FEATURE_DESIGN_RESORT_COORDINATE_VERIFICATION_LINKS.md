# Resort Coordinate Verification Links

Date: 2026-03-14
Status: implemented
Scope: add verification/reporting links next to resort-page coordinates and provide a dedicated GitHub issue form for coordinate corrections.

## 1. Goal

When a resort page shows resolved coordinates, make those coordinates actionable:

1. the coordinate text should open Google Maps for manual verification
2. the page should expose a direct `(Wrong coordinates?)` link to a GitHub issue form
3. the issue form should collect enough structured data to submit a correction quickly

This applies to both:

1. dynamic resort hourly pages
2. static `site/resort/<resort_id>/index.html` pages

## 2. Current State

Before this slice:

1. resort-page coordinates rendered as plain text in the `hourly-meta` line
2. no direct path existed to report a bad coordinate from the page itself
3. GitHub issue forms only exposed a generic feature request template

## 3. Product Decision

Keep the current coordinate placement in the resort-page meta row, but upgrade the coordinate segment into two links:

1. the displayed coordinates link to Google Maps
2. a red `(Wrong coordinates?)` link opens a dedicated coordinate-correction issue form

The issue form should prefill the fields the page already knows:

1. resort name
2. current resort page URL
3. currently displayed coordinates
4. Google Maps link for those coordinates

The reporter then adds:

1. corrected coordinates
2. corrected Google Maps link
3. any supporting notes or evidence

## 4. Implementation Notes

Frontend:

1. keep data sourcing unchanged and build links from the existing hourly payload fields `resolved_latitude` and `resolved_longitude`
2. generate the GitHub issue URL with query parameters that target the dedicated form ids
3. keep the rest of the meta row as text, only upgrading the coordinate segment to DOM nodes with anchors

GitHub forms:

1. add a new issue form under `.github/ISSUE_TEMPLATE/01-coordinate-correction.yml`
2. align form field ids with the prefill query parameters emitted by the resort-page JS

## 5. Files

Primary files:

1. `assets/js/resort_hourly.js`
2. `assets/css/resort_hourly.css`
3. `.github/ISSUE_TEMPLATE/01-coordinate-correction.yml`
4. `tests/frontend/test_assets.py`

## 6. Validation

Automated:

1. assert the resort hourly asset contains the GitHub template link and Google Maps link builder
2. assert the CSS includes the coordinate-issue-link styling hook
3. assert the coordinate-correction issue form includes the required field ids

Static render:

1. rebuild the static site with `python3 -m src.cli static --output-dir ... --max-workers 8`
2. verify the copied resort-page JS/CSS assets include the new coordinate verification strings
