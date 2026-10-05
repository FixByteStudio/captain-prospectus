---
tracker_id: "268"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/268"
tracker_status: backlog
id: 5
type: story
title: "Admin Tournée du jour: agent picker and ordered list"
parent: epic-admin-round-view
covers: [CAP-4, CAP-11]
after: [2, 4, 3.1]
risk: medium
---

# Admin Tournée du jour: agent picker and ordered list

## Description

Adds /admin/tournee under Terrain in nav.ts and AdminApp.tsx (with nav.test.ts), an agent Select from GET /agents, and a read-only list of today's stops only (no Plus tard group) from entry 2's endpoint in the order entry 4's shared rule gives from the stored position (no second sort), with '{n} arrêts', 'Position du {date heure}' and distances; with no position it sorts the rule's stops by name and shows the 'Aucune position reçue aujourd'hui…' notice; strings in copy.ts; the admin round view section of docs/design.md.

## Acceptance Criteria

Verify: DOM tests show the shared rule's order, the stop count and the position age for an agent with a position, name order with the notice and no distances without one, and no Visiter or Y aller on any row.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-round-view/epic-admin-round-view.md
- _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md, Admin round view
- _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, Flow 3 and No agent position
- src/client/admin/nav.ts

## Notes

- Open question: None known.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
