---
type: initiative
title: "The numbered tournée holds under failed, late and racing syncs"
parent: none
covers: [R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R15, R16]
after: []
assignee: ""
risk: high
---

# The numbered tournée holds under failed, late and racing syncs

## Description

The follow-up to epic #496, the numbered tournée (ADR-0036). Its retro accepted it with open items and proposed action items. This initiative takes five of them: items 2, 3, 4, 6 and 8. A sync no longer fails when the tournée write fails. The earliest swipe wins. The database keeps stop numbers unique. The Visites feed and the duplicates screen count door-days without gaps. The tests pin the rules the epic left unpinned. Before merge, the release checklist waits for the review bot. The work fits one epic, `epic-tournee-holds`, whose Requirements hold the retro's lines. This initiative's `covers` lists the same ids.

## Outcome

Two phones of one agent end every day with the same numbers, no sync is refused because of its tournée, and the retro's fix-now findings are closed. The signal is that the next epic's retro finds none of F1–F15 open again.

## Requirements

Held by the one epic: `epic-tournee-holds/epic-tournee-holds.md`, section Requirements (R1–R16).

## Done when

1. A failed tournée write, an earlier swipe that syncs late, or two phones racing for one number never costs a visit its acknowledgement. Both phones end with the same tournée and numbers.
2. Every admin figure counts door-days, the duplicates screen included, and the Visites live feed misses no door-day after a truncated poll.
3. The tests pin the tournée's rules. The three door-day readers agree, Worker responses parse with their zod schemas, and `pnpm test` passes at any hour of the Brussels day.
4. The epic is on production through CI, and each of its PRs merged after CodeRabbit finished, with every actionable comment answered or filed.

## Boundaries

The sync route and contract, the tournée tables, the Visites feed, the duplicates screen, the Worker and client tests, and the release checklist. Not the location-gate threshold (retro action 1, the owner's pavement test). Not the precache headroom, which #536 restored (action 5). Not the process lines of action 10. Not admin-built tournées (T2).

## References

- retro — _bmad-output/implementation-artifacts/epic-496-retro-2026-10-16.md, sections Findings and Action items (2, 3, 4, 6, 8)
- adr — docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md
- constraint — docs/adr/0007-offline-first-insert-only-sync.md
- constraint — docs/adr/0033-rollout-rules-wait-for-protected-data.md

## Notes

- Decision (2026-10-17): a new initiative with one epic. The owner chose not to reopen `initiative-daily-tournee`, which was archived as closed on 2026-10-16 (milestone #4 is still open on GitHub).
- Decision (2026-10-17): no platform-baseline epic. The platform is in production; this initiative fixes a shipped feature.
- Parked: retro actions 1 (the owner's pavement test), 5 (done by #536), 7 (done by the owner's decision), 9 (tracker hygiene) and 10 (process). The owner did not select them for this initiative.
