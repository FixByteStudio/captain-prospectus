---
tracker_id: "308"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/308"
tracker_status: backlog
id: 11
type: story
title: "Tableau de bord lists prospects with no active agent"
parent: epic-own-login
covers: [CAP-1]
after: [7]
risk: low
refined: true
---

# Tableau de bord lists prospects with no active agent

## Description

Shows the admin the open prospects still assigned to an agent who can no longer visit them, and takes them to Prospects to reassign them. A prospect counts when it is not merged, its status is new, assigned or follow_up, and its assignee has no active users row (deactivated, or no row at all). It adds:
- **`inactiveAgentProspects` on GET /api/admin/dashboard**, as an additive field. It is that count, and it does not depend on the period.
- **`inactiveAgent=true` in the shared prospect filters**, so the list and the CSV export get it together. Only "true" is accepted, as for outOfTarget, and anything else is 400. It keeps prospects whose assignee has no active users row. It does not filter status by itself.
- **The fourth À traiter row** on Tableau de bord, per design.md: the UserX tile, "Prospects sans agent actif", "Assignés à un agent désactivé", the count, and Réassigner. Réassigner opens Prospects at status=new,assigned,follow_up&inactiveAgent=true, so the list totals the count. At 0, while loading, or on failure, the row behaves like the other three.
- **The filter on Prospects**, per design.md: the chip "Agent : désactivé" with a ×, and the Agent select reading "Agent désactivé" while it is on. The ×, choosing another agent, or Effacer les filtres clears it. Reassigning through the existing selection bar takes a prospect out of the list.

docs/api.md (the dashboard field and the filter) changes in the same PR. The French strings go in the admin copy module.

Not here: deactivation itself and its dialog's count (entry 7).

## Acceptance Criteria

Verify: On pnpm dev:
- After an admin deactivates a seeded agent with open prospects, the row shows their count.
- Réassigner opens Prospects listing exactly those prospects, with the chip and "Agent désactivé" in the Agent select.
- Assigning them to another agent from the selection bar empties the list, and the dashboard row reads 0 with its button disabled.
- The chip's × clears the filter.

Worker tests show:
- The count and the filter agree. Both include an assignee who is deactivated or has no users row, and both leave out an active assignee, an unassigned prospect, a merged prospect, and, for the count, a won or lost one.
- The export with inactiveAgent=true returns the same rows as the list.
- inactiveAgent with any value other than "true" gets 400.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, section CAP-1
- design — docs/design.md, sections Tableau de bord (À traiter) and Prospects (one toolbar slot)
- api — docs/api.md, the dashboard and GET /api/admin/prospects

## Notes

- Decision (2026-10-09): the count is open prospects only (new, assigned, follow_up, not merged), as in the deactivation dialog's openProspects. Won and lost prospects keep their agent as history.
- Decision (2026-10-09): "no active agent" also covers an assignee with no users row, left over from the ADMIN_EMAILS and AGENT_EMAILS era.
- Decision (2026-10-09): the filter is a separate key, `inactiveAgent=true`, rather than a keyword on assignedTo, so assignedTo stays an email.
- Decision (2026-10-09): the dashboard field is named `inactiveAgentProspects`.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
