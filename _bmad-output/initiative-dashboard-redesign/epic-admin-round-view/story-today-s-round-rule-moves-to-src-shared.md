---
tracker_id: "267"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/267"
tracker_status: backlog
id: 4
type: story
title: "Today's round rule moves to src/shared"
parent: epic-admin-round-view
covers: [CAP-4]
after: [4.14]
risk: medium
---

# Today's round rule moves to src/shared

## Description

Moves the pure stop-selection part of buildTodayList (due, kept for today, Plus tard, as left by 4.14) from src/client/field/today.ts into src/shared with no DOM or Dexie input, so the admin view (entry 5) shows exactly the stops the agent's Tournée shows; the field keeps its behaviour.

## Acceptance Criteria

Verify: Existing field tests pass unchanged, and a new shared unit test gives the same stops for the same prospects and date as the field list.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-round-view/epic-admin-round-view.md
- src/client/field/today.ts, buildTodayList
- _bmad-output/specs/spec-done-stop-leaves-the-round/round-placement.md

## Notes

- Open question: Assumption: buildTodayList(prospects, outbox, from, now, queued) takes the outbox and queued visits as plain arguments, so the admin passes [] for both.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
