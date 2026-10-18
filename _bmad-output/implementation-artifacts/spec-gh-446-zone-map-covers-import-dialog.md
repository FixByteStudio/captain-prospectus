---
title: 'Zone: the map covers the « Import terminé » dialog (#446)'
type: 'bugfix'
created: '2026-10-18'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: 'a605114f34e3b94754fca2ec253bfe81d80dd94e'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On the map import (Zone), the « Import terminé » dialog (`z-50`, portalled to `body`) opens behind the Leaflet map: the map's container has no stacking context of its own, so Leaflet's panes (`z-index` 200–700) compete in the root stacking context and paint over the dialog, and a click on « Terminer » lands on the drawn zone instead of the button (#446).

**Approach:** Give `MapCanvas`'s container its own stacking context with Tailwind's `isolate`, as `RoundMap` already does, and add a real-Leaflet test asserting the class so the fix cannot silently regress.

</frozen-after-approval>

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/admin/import/MapCanvas.tsx` -- add `isolate` to the container's `className`, with a one-line *why* comment -- contains Leaflet's pane z-indexes so any `z-50` layer (dialog, select list, sheet) paints above the map.
- [ ] `src/client/admin/import/MapCanvas.test.tsx` (new) -- render the real `MapCanvas` in happy-dom (as `RoundMap.test.tsx` does) and assert the `role="application"` element's class contains `isolate`.

**Acceptance Criteria:**
- Given the Zone step with a drawn zone, when the « Import terminé » dialog opens over the map, then the dialog paints above the map and « Terminer » receives the click.
- Given `pnpm test`, when `MapCanvas.test.tsx` runs, then it fails if `isolate` is removed from the container.

## Implementation Notes

Oneshot: a one-class CSS fix plus one test, matching the precedent in `src/client/field/RoundMap.tsx:367-372` and its test at `RoundMap.test.tsx:210`.

## Spec Change Log

## Review Triage Log

Pass 1 (quick): 0 findings. The reviewer confirmed that `ResultDialog` renders through the `z-50` `DialogContent`, and that the class matches `RoundMap.tsx:372`. It noted that happy-dom computes no stacking, so the class assertion is the only automated guard; the dev-server check has not been run.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm test -- src/client/admin/import` -- expected: all pass, including the new test
- `pnpm lint` -- expected: clean

**Manual checks (if no CLI):**
- In the dev server, draw a zone, import, and confirm « Import terminé » is fully visible and « Terminer » closes it with a mouse click.
