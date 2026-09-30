---
tracker_id: "249"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/249"
tracker_status: backlog
id: 3
type: story
title: "Visites shows and filters refusal reasons"
parent: epic-refusal-reasons
covers: [CAP-4, CAP-5]
after: [1, 3.4]
risk: low
---

# Visites shows and filters refusal reasons

## Description

Relies on entry 1's column and labels. Admin visit rows carry refusalReason. VisitsLedger.tsx shows its label beside OUTCOME_LABELS for Pas intéressé, and nothing for older visits. A 'Raison du refus' filter (the 7 reasons plus 'Sans raison') is added that combines with from, to and since. GET /api/admin/visits and export.csv take the same reason= param, and export.csv gains a refusal_reason column. docs/api.md and the Visites section of docs/design.md are updated.

## Acceptance Criteria

Verify: Worker tests show reason= filters the list and the export identically, combined with from, to and since, and 'Sans raison' returns only not_interested visits with a null reason. The CSV has refusal_reason, empty when null. DOM tests show the label, nothing on an old visit, the filter narrowing the ledger, and the live poll and export link carrying reason=.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-refusal-reasons/epic-refusal-reasons.md
- src/client/admin/visits/VisitsLedger.tsx
- src/worker/routes/admin.ts

## Notes

- Open question: None known.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
