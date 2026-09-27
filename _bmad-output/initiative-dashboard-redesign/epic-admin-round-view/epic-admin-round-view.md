---
type: epic
title: "An admin sees any agent's round"
parent: initiative-dashboard-redesign
covers: [CAP-4, CAP-11]
after: []
assignee: ""
risk: high
---

# An admin sees any agent's round

## Description

Terrain › Tournée du jour in the admin shows a chosen agent's round as a read-only list and map, ordered from the position the phone last synced. That position is new personal data (server-gaps G7).

## Outcome

The admin can see where a round stands without calling the agent; CAP-4's success criterion and EXPERIENCE.md Flow 3 are the signal.

## Done when

1. An ADR records the position-at-sync decision, including retention, and a security review approves it.
2. The sync change is additive, and a phone on the previous `clientVersion` still syncs (invariant 9).
3. For an agent who synced today, the order matches nearest-next from the stored position, and the position's age is shown; with no position, the list is ordered by name and says so.
4. `docs/design.md`, `docs/api.md`, `docs/data-model.md` and field-operations.md describe the change.

## Boundaries

The admin round view, the position field in sync, and its storage and retention. Not continuous tracking: vision.md's non-goal on GPS tracking still holds.

## References

- parent — _bmad-output/initiative-dashboard-redesign/initiative-dashboard-redesign.md
- spec — _bmad-output/specs/spec-dashboard-redesign/SPEC.md, CAP-4; _bmad-output/specs/spec-dashboard-redesign/server-gaps.md, G7
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-admin-round.html; _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, Flow 3
- constraint — docs/vision.md, Non-goals (no continuous GPS tracking); docs/domains/field-operations.md, agent-position retention

## Notes

- Waits on epic-field-screens because: it reuses the Carte map, pin and stop-row components.
- Decision (2026-09-24): kept as its own last epic, gated on the ADR and the security review (user's choice).
