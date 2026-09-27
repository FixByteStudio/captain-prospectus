---
tracker_id: "183"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/183"
tracker_status: backlog
id: 9
type: story
title: "À rattacher rebuilt"
parent: epic-admin-screens
covers: [CAP-3, CAP-11]
after: [8]
risk: medium
---

# À rattacher rebuilt

## Description

Rebuild the repair queue on the new design as a forecast rather than a record: the header count and the lede saying the effect has not happened yet, the outcome edge previewing what repairing would do, both reasons sharing one dense row shape with no per-row dialog, server-proposed candidates nearest first with the distance inside each button and an explicit message when a visit has no position, Supprimer far right opening the destructive confirmation, and the healthy empty state; fix the sidebar badge that counts only the queue's first page (#159) and rewrite the docs/design.md repair-queue section.

## Acceptance Criteria

Verify: DOM tests cover both reason shapes, a candidate button carrying its distance, the no-position message and the discard confirmation, and a test pins the badge against a queue larger than one page; pnpm test is green.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-screens/epic-admin-screens.md
- _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/stitch/admin/a9_visites_rattacher
- https://github.com/FixbyteStudio/captain-prospectus/issues/159

## Notes

- Open question: OrphansScreen calls useRepairOrphan once per row today; whether the rebuilt row keeps that shape is decided here.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
