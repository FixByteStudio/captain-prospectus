---
tracker_id: "109"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/109"
tracker_status: done
id: 5
type: story
title: "Convertis and Taux de conversion"
parent: epic-dashboard
covers: [CAP-2]
after: [4]
risk: medium
---

# Convertis and Taux de conversion

## Description

Adds the Convertis and Taux de conversion KPIs to the endpoint and their cards, counting a prospect as converted in the period from a visit with outcome converted or a manual change to Converti (status_set_at), over the distinct prospects visited in the period.

## Acceptance Criteria

Verify: Worker tests cover a prospect converted by a visit, one converted manually, one converted twice in the period (counted once), a merged prospect and a previous period of 0, for 7, 30 and 90 days.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-dashboard/epic-dashboard.md

## Notes

- Open question: Whether a prospect converted and then reopened inside the period still counts; 'became Converti' suggests it does.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
