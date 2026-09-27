---
tracker_id: "181"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/181"
tracker_status: backlog
id: 7
type: story
title: "Import rebuilt: the map path"
parent: epic-admin-screens
covers: [CAP-3, CAP-11]
after: [6]
risk: medium
---

# Import rebuilt: the map path

## Description

Rebuild the Zone step on the new design preserving every map-import rule docs/design.md and ADR-0020 already record: map and results side by side, the provider select above the map with a change clearing the drawing, the single toolbar slot under the map carrying the vertex count, Annuler le dernier point, Effacer and Rechercher dans la zone, unnamed places struck and excluded from the count, the already-listed rows out by default behind one checkbox that resets each search, the cached answer with its age, attribution passed to the tile layer's own option, and the Google circle gesture with its standing cost wording; fix the hand-spelled status edges (#167), the toolbar overflow below 480px (#28) and the near-invisible dark-mode shapes (#27).

## Acceptance Criteria

Verify: DOM tests cover the provider switch clearing the drawing, the unnamed-place exclusion and the already-listed opt-in resetting on a new search; pnpm test is green.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-screens/epic-admin-screens.md
- _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/stitch/admin/a7_import_carte_zone_et_r_sultats
- docs/adr/0020-google-places-as-a-second-map-provider.md
- https://github.com/FixbyteStudio/captain-prospectus/issues/167
- https://github.com/FixbyteStudio/captain-prospectus/issues/28
- https://github.com/FixbyteStudio/captain-prospectus/issues/27

## Notes

- Open question: MapCanvas drives Leaflet imperatively, so the new design must not take ownership of the canvas away from it; how much of the step can be DOM-tested at all is unproven.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
