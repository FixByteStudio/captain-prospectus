---
tracker_id: "244"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/244"
tracker_status: backlog
id: 15
type: story
title: "Script questions only where someone can answer"
parent: epic-field-screens
covers: [CAP-8]
after: [14]
risk: low
---

# Script questions only where someone can answer

## Description

Per SPEC CAP-6 and the retro's F1: À relancer's step 2 becomes the when step and Notes like Personne sur place, so neither result shows, requires or sends script answers (toVisit validates and sends answers only for Intéressé, Pas intéressé and Converti; the step indicator names both « Quand ? »); field-operations.md's 'required unless no_contact' rule, when-step.md-driven docs, and the glossary and prospecting.md definitions of À relancer and Personne sur place (CAP-4) follow.

## Acceptance Criteria

Verify: visit-draft tests show follow_up and no_contact save with required questions unanswered and send answers {}, while interested still blocks on them; VisitScreen DOM tests show À relancer's step 2 has no questions, only the when radios and Notes, under « Étape 2 sur 2 · Quand ? »; the PR quotes the precache total against 1,000 KiB.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-field-screens/epic-field-screens.md
- _bmad-output/specs/spec-done-stop-leaves-the-round/SPEC.md, CAP-4 and CAP-6
- _bmad-output/specs/spec-done-stop-leaves-the-round/when-step.md, Placement
- _bmad-output/specs/spec-done-stop-leaves-the-round/RETROSPECTIVE.md, F1 to F3 and Owner answers

## Notes

- Decision (2026-09-30): the questions are hidden on À relancer, not shown as optional, and the À relancer hint stays « Un rendez-vous à reprendre. » (owner).

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
