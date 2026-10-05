---
tracker_id: "269"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/269"
tracker_status: backlog
id: 6
type: story
title: "Admin Tournée du jour: map pane"
parent: epic-admin-round-view
covers: [CAP-4, CAP-11]
after: [5]
risk: low
---

# Admin Tournée du jour: map pane

## Description

Puts the map right of entry 5's list by reusing RoundMap, mapPins and walkingPath with no selection and recentre made optional, numbered pins in the list's order, the position marker per ADR-0028, and Leaflet's OSM attribution; the field Carte keeps its behaviour.

## Acceptance Criteria

Verify: DOM tests show pin numbers follow the list order, the attribution renders, no position marker shows without a position, and Carte's tests pass unchanged; the PR quotes the precache total against 1,000 KiB.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-round-view/epic-admin-round-view.md
- src/client/field/RoundMap.tsx
- src/client/field/round-map.ts
- docs/adr/0019-admin-chunk-out-of-the-precache.md

## Notes

- Open question: None known.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
