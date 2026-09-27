---
tracker_id: "121"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/121"
tracker_status: done
id: 4
type: story
title: "Carte: lazy map and tab"
parent: epic-field-screens
covers: [CAP-7, CAP-5, CAP-11]
after: [1, 2.11]
risk: medium
---

# Carte: lazy map and tab

## Description

Adds /tournee/carte as a lazy Leaflet chunk with the Carte tab, numbered pins in walking order, a straight-line walking path, the OSM attribution and the re-centre button, and the offline notice 'Carte indisponible hors ligne…' with Voir la liste and no tile requests.

## Acceptance Criteria

Verify: Online the map matches key-f2-carte.html with the attribution; in airplane mode the notice shows and the network panel lists no tile request; the PR shows Leaflet outside the entry chunk and quotes the precache total and the entry chunk.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-field-screens/epic-field-screens.md
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-f2-carte.html

## Notes

- Open question: The tile layer's look in dark mode is unsettled (#27), and the path is assumed straight lines because a routing service would cost money (ADR-0002).

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
