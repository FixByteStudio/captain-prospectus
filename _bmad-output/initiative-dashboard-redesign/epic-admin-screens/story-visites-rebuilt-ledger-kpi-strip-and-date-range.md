---
tracker_id: "178"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/178"
tracker_status: backlog
id: 4
type: story
title: "Visites rebuilt: ledger, KPI strip and date range"
parent: epic-admin-screens
covers: [CAP-3, CAP-11]
after: [1, 3]
risk: medium
---

# Visites rebuilt: ledger, KPI strip and date range

## Description

Rebuild Visites on the new design as a ledger ordered by received_at with the quoted note line, the ambient arrival wash and no toast, add the four-card KPI strip and the 7/30/90 selector that sends the matching from/to to the feed and the same period to the aggregate, add 25-row pagination and a CSV export button, make each strip card open the list behind it, and rewrite the docs/design.md live-feed section including the sentence that says the feed has no date range.

## Acceptance Criteria

Verify: DOM tests pin the selector driving both the feed request and the strip, pagination, the four strip figures, each card's link target and the empty feed copy; pnpm test is green.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-screens/epic-admin-screens.md
- _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/stitch/admin/a10_visites
- https://github.com/FixbyteStudio/captain-prospectus/issues/162
- https://github.com/FixbyteStudio/captain-prospectus/issues/160

## Notes

- Open question: Both CSV export endpoints cap at 500 rows and set x-truncated; this entry decides what the button does with a truncated answer and entry 5 follows it.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
