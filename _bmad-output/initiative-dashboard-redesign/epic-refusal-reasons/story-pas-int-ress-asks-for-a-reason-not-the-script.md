---
tracker_id: "248"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/248"
tracker_status: done
id: 2
type: story
title: "Pas intéressé asks for a reason, not the script"
parent: epic-refusal-reasons
covers: [CAP-1, CAP-2]
after: [1, 4.14]
risk: medium
---

# Pas intéressé asks for a reason, not the script

## Description

Relies on entry 1's REFUSAL_REASONS and the labels imported through copy/field. On Pas intéressé, step 2 shows the 7 native radios in place of the script's questions, whether or not a script is cached, and the notes stay. visit-draft.ts refuses no reason, and 'Autre' with empty notes, then sends refusalReason with answers {}. docs/domains/field-operations.md and the visit form section of docs/design.md are updated.

## Acceptance Criteria

Verify: DOM tests show the radios in refusal-reasons.md order with and without a script. Save is blocked with no reason and with 'Autre' and empty notes, each with its copy/field message. A saved visit carries refusalReason and answers {} even with answers left from another result, and other outcomes behave as before. The PR quotes the precache total against 1,000 KiB.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-refusal-reasons/epic-refusal-reasons.md
- _bmad-output/specs/spec-done-stop-leaves-the-round/when-step.md
- src/client/field/visit-draft.ts
- src/client/field/VisitScreen.tsx

## Notes

- Open question: None known.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
