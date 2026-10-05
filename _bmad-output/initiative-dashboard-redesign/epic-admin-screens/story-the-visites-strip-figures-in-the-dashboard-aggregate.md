---
tracker_id: "177"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/177"
tracker_status: done
id: 3
type: story
title: "The Visites strip figures in the dashboard aggregate"
parent: epic-admin-screens
covers: [CAP-3]
after: [2, 2.3]
hitl: true
risk: high
---

# The Visites strip figures in the dashboard aggregate

## Description

Extend GET /api/admin/dashboard additively with the flyers-given count, the distinct-agents-with-a-visit-received-today count (G6) and a seven-day follow-up window, since the existing followUpsDue is due-today-or-earlier and the strip asks for 'Relances dues sous 7 jours'; write the new row into server-gaps.md for the owner to sign, and prove the endpoint still fits its CPU budget.

## Acceptance Criteria

Verify: Worker tests cover all three figures; scripts/measure-dashboard-cpu.mjs still reports under 10 ms and the number is quoted in the PR; docs/api.md and server-gaps.md carry the new row.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-screens/epic-admin-screens.md
- _bmad-output/specs/spec-dashboard-redesign/server-gaps.md
- scripts/measure-dashboard-cpu.mjs

## Notes

- Open question: G1 measured 7.9-8.2 ms of the 10 ms budget (invariant 13). Three more aggregates may not fit; if they do not, these figures need their own endpoint and this entry splits.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
