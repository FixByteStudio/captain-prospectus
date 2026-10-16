---
tracker_id: "507"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/507"
tracker_status: done
id: 11
type: story
title: "The Visites ledger shows one row per door-day"
parent: epic-numbered-tournee
covers: [R13, R16]
after: [1, 10]
risk: medium
---

# The Visites ledger shows one row per door-day

## Description

/api/admin/visits and VisitsLedger show one row per door-day with its latest outcome, built on entry 2's door-day reader and entry 1's design. Opening a row shows the details and every visit of that door-day. The CSV export stays one row per visit, and docs/api.md follows.

## Acceptance Criteria

Verify: On a seeded local build, the two-visit door is one ledger row whose history lists both visits, and the CSV export still has two rows.

## References

- parent — _bmad-output/initiative-daily-tournee/epic-numbered-tournee/epic-numbered-tournee.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
