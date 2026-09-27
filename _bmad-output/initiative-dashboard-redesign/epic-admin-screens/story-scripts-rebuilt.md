---
tracker_id: "184"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/184"
tracker_status: backlog
id: 10
type: story
title: "Scripts rebuilt"
parent: epic-admin-screens
covers: [CAP-3, CAP-11]
after: [9]
risk: medium
---

# Scripts rebuilt

## Description

Rebuild the script editor on the new design with question cards whose GripVertical is the only reorder affordance and which reorder from the keyboard through the dnd-kit KeyboardSensor, a saved key locked and unlocked only by Modifier la clé with a standing warning rather than a toast, the read-only versions rail, one primary action opening the confirmation that names the version it will create, and the spinner and disabled button until the server answers; fix the 509px width at 390px (#72) and rewrite the docs/design.md script-editor section per the cards decision.

## Acceptance Criteria

Verify: DOM tests cover keyboard reorder, the key lock and its standing warning, and the confirmation naming the version; pnpm test is green.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-screens/epic-admin-screens.md
- _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/stitch/admin/a11_scripts
- _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/stitch/admin/a12_scripts_dialogue_de_confirmation
- https://github.com/FixbyteStudio/captain-prospectus/issues/72

## Notes

- Open question: Neither ScriptsScreen nor QuestionRow has a DOM test today, and the seeded-once effect that stops a background refetch clobbering an edit must survive the rebuild.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
