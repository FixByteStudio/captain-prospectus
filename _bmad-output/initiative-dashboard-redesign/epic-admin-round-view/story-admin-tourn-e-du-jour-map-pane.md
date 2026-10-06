---
tracker_id: "269"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/269"
tracker_status: done
id: 6
type: story
title: "Admin Tournée du jour: map pane"
parent: epic-admin-round-view
covers: [CAP-4, CAP-11]
after: [5]
risk: low
refined: true
---

# Admin Tournée du jour: map pane

## Description

Puts the map right of the list on `/admin/tournee`, reusing `RoundMap`, `mapPins` and `walkingPath` from the field. `RoundScreen` imports `RoundMap` statically.

Shared code: the only change is `RoundMap`'s `recentre` becoming optional. Without it, no re-centre button renders. Its pins stay decorative (no `onSelect`). `mapPins` and round-map.ts are untouched.

Pins: pins are numbered in the list's order, so a stop without coordinates has no pin but keeps its number. Gold pin 1, the dashed path and the position marker appear only when the order comes from a stored position. The "gold only with a position" rule lives in the admin: it sets `next: false` on every pin and passes an empty path when there is no position. With no position, the map shows numbered card-coloured pins only. Leaflet's OSM attribution shows.

Layout: the header and the agent Select stay on top at every width. Below `md`, the map follows at a fixed ~280 px, then the list. From `md` up, the list is on the left and the map on the right, and the map stays in view as the list scrolls. The map mounts for any loaded round, keyed by the agent's email, so choosing another agent remounts and refits it. With no pins it shows the default Brussels view, centred on the position when there is one. It keeps fitting to the pins and the position together.

The field Carte and the visit side pane behave as before. docs/design.md's admin round view section replaces "The map pane is story 5.6" with the pane's behaviour.

## Acceptance Criteria

Verify: `RoundMap` tests (real Leaflet in happy-dom, as today) show that without `recentre` no re-centre button renders and with it the button works as before, that the attribution renders, and that a `null` position draws no marker. Admin DOM tests (a mocked `RoundMap` capturing props) show that pin numbers follow the list order and a stop without coordinates has no pin but keeps its number; that with a position pin 1 is gold, the path is set and the position reaches the map; that with no position there is no gold pin, no path and no marker; that a different agent remounts the map; and that the map is absent until an agent is chosen and present for a loaded round with zero pins. Carte's and the visit pane's existing tests pass with no assertion changed. Typecheck, lint, tests and build are green, `check:precache` passes, and the PR quotes the precache total on `main` and on the branch against 1,000 KiB, because the build after this change is what confirms `RoundMap` stays its own precached chunk.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-round-view/epic-admin-round-view.md
- src/client/field/RoundMap.tsx
- src/client/field/round-map.ts
- src/client/admin/round/RoundScreen.tsx
- src/shared/today.ts
- src/client/admin/import/MapCanvas.tsx
- docs/adr/0019-admin-chunk-out-of-the-precache.md
- docs/adr/0028-agent-position-at-sync.md
- docs/design.md, The admin round view
- _bmad-output/forge/story-5-6-map-pane-decisions/forged-idea.md

## Notes

- Decision (2026-10-06, refinement): the five map-pane decisions and what was rejected are in the forge's forged-idea.md.
- Accepted weak points, to watch: a gold pin 1 can be hours old; on a phone the list starts below the fold; a remount re-requests OSM tiles on each agent change; an empty-looking map sits beside "Aucun arrêt…"; a far-off stale reading shrinks the stops until the admin zooms. The last one is for the story 7 seeded Flow 3 run to confirm or dismiss.
- Open question: None known.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
