---
tracker_id: "250"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/250"
tracker_status: done
id: 4
type: story
title: "Prospects flags places reported Hors cible"
parent: epic-refusal-reasons
covers: [CAP-7]
after: [3, 3.5]
risk: medium
---

# Prospects flags places reported Hors cible

## Description

Relies on entry 1's refusal_reason and out_of_target_reviewed_at, and follows entry 3 in admin.ts. It adds a 'Hors cible signalé' Prospects filter with a count, listing prospects whose latest visit carries out_of_target and whose out_of_target_reviewed_at is not after that visit. A direct admin PATCH of the prospect's fields or status stamps it; assign, merge and CSV import do not. A newer visit with another outcome also clears the flag. docs/api.md and docs/domains/prospecting.md are updated.

## Acceptance Criteria

Verify: Worker tests show the flag appears after an out_of_target visit, clears on a later PATCH and on a newer visit with another outcome, and survives assign, merge and batch import. A DOM test shows the filter and its count in Prospects.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-refusal-reasons/epic-refusal-reasons.md
- src/worker/routes/admin.ts, lines 709, 758, 978 and 1158 (updated_at writers)

## Notes

- Open question: None known.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
