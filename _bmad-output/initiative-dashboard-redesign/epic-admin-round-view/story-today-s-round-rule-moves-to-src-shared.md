---
tracker_id: "267"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/267"
tracker_status: done
id: 4
type: story
title: "Today's round rule moves to src/shared"
parent: epic-admin-round-view
covers: [CAP-4]
after: [4.14]
risk: medium
refined: true
---

# Today's round rule moves to src/shared

## Description

Moves the rule that decides which stops are on a round and in what order, from src/client/field/today.ts to src/shared/today.ts, so the admin round view builds the same list the agent's Tournée does. Moves: `buildTodayList` and its helpers (due, kept for today, queued-visit placement, Plus tard, nearest-next with uncoordinated stops last, distances) and the types `TodayItem`, `TodayList` and `QueuedVisit`. `hasWhenStep` moves to src/shared/constants.ts beside `Outcome`; visit-draft.ts and VisitScreen.tsx import it from there, so it keeps one home. The signature and behaviour do not change, and the shared module stays pure (no DOM, Dexie or Worker API). The field importers (useRound, CarteList, StopRow, their tests) import from the shared module, with no re-export left behind. `navigationUrl` and `visitPath` stay in today.ts because only the field uses them. The admin calls the rule with `outbox` `[]`, `queued` `[]`, the stored position as `from` and `Date.now()` as `now`. docs/domains/field-operations.md names the new home of the rule.

## Acceptance Criteria

Verify: The `buildTodayList` cases in today.test.ts run from src/shared/today.test.ts with their assertions unchanged (only imports differ), and no other field test changes an assertion. A new shared test calls the rule as the admin will (no outbox, no queued visits, a position) and shows due stops in nearest-next order, a kept-for-today stop last, Plus tard stops in `later`, and with no position the due stops in input order. Typecheck, lint, tests and build are green. The PR quotes the precache total against 1,000 KiB.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-round-view/epic-admin-round-view.md
- src/client/field/today.ts, buildTodayList
- src/client/field/visit-draft.ts, hasWhenStep
- _bmad-output/specs/spec-done-stop-leaves-the-round/round-placement.md
- docs/domains/field-operations.md, Today list

## Notes

- Decision (2026-10-06, refinement): the whole of `buildTodayList` moves, including ordering and distances, because entry 5 takes its order from the rule with no second sort.
- Decision (2026-10-06, refinement): `hasWhenStep` moves to src/shared/constants.ts so the rule keeps a single home.
- Decision (2026-10-06, refinement): the old verify's "same stops as the field list" test is replaced by the admin-shaped call above; with one implementation it would compare the function with itself.
- Hand-off to entry 5: with no position the rule returns due stops in input order, so entry 5 does the name sort. It ignores `later`.
- Open question: None known. The plain-arguments assumption is confirmed against the code.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
