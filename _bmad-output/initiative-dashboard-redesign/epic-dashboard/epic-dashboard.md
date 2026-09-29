---
tracker_id: "104"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/104"
tracker_status: done
type: epic
title: "The admin opens on Tableau de bord"
parent: initiative-dashboard-redesign
covers: [CAP-2, CAP-5, CAP-10, CAP-11]
after: []
assignee: ""
risk: medium
status: done
---

# The admin opens on Tableau de bord

## Description

`/admin` lands on Tableau de bord: the period selector, 4 KPIs with deltas and sparklines, visits by outcome over time, pipeline by status, per-agent activity, À traiter and Dernières visites. The figures come from a new read-only aggregate endpoint (server-gaps G1, G2) and follow EXPERIENCE.md › Dashboard metrics.

## Outcome

An admin sees how canvassing is going, and what to do next, in one screen; CAP-2's success criterion is the signal.

## Done when

1. Against a seeded D1, every dashboard figure equals its Dashboard metrics definition for 7, 30 and 90 days, deltas included.
2. The aggregate query stays within the Workers Free CPU budget on the seeded data (invariant 13), with the `visits(visited_at)` index migrated.
3. Dernières visites shows a new visit within one 15 s poll.
4. Recharts and every admin-only module are only in the admin chunk, and the build fails otherwise (#95); the field precache changes only by #93's fix, quoted in its PR, and the Recharts PR states the dependency's size and maintenance.
5. `docs/design.md`'s dashboard section matches the screen.

## Boundaries

The dashboard screen, its endpoint (G1), the `visits(visited_at)` index (G2), the Prospects filters its links land on (G3, G10), and four folded-in issues: #90 (empty `/admin`), #100 (outcome tokens, from #91), #95 (admin-only modules out of the field precache) and #93 (the Tableau de bord tab offline; CAP-5 for that fix only, CAP-10 for #100 only). Not the Visites KPI strip (epic-admin-screens reuses G1), not the Prospects rebuild, not notifications.

## References

- parent — _bmad-output/initiative-dashboard-redesign/initiative-dashboard-redesign.md
- spec — _bmad-output/specs/spec-dashboard-redesign/SPEC.md, CAP-2; _bmad-output/specs/spec-dashboard-redesign/server-gaps.md, G1–G2
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, Dashboard metrics and Component Patterns; _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-a1-dashboard.html

## Notes

- Waits on epic-shared-shell because: the dashboard renders inside the new admin shell with the DESIGN.md tokens.
- Decision (2026-09-25): fold in #90, #91's chart colours (now #100) and #93; #95's guard lands before the first chart story (user).
- Decision (2026-09-25): the epic takes G3 from epic-admin-screens and adds G10, a multi-value `status` on `GET /api/admin/prospects`, so every KPI card and Voir opens its filtered list (user).
- Decision (2026-09-25): Done when 4 reworded, since #93's fix changes the field entry chunk (user).
- Decision (2026-09-25): one epic of 12 entries, not split; the admin lane is sequential because its entries share `admin.ts` and the dashboard screen (user).
- Decision (2026-09-26): #100 and #95 are one story, and it and the G2 migration go first; no other entry in this epic or epic-field-screens touches `app.css` or `drizzle/` while they run, so every entry that could touch `app.css` waits on 1 and only 2 touches `drizzle/` (user).
- Decision (2026-09-26): tracer bullet is 3, Tableau de bord at `/admin` with the endpoint's contract; it follows 1 at the user's order rather than opening the epic. The CPU-budget check moves from 2 to 9, where the query is complete.
- Decision (2026-09-26): 11 and epic-field-screens' Carte (4.4) both edit `tabs.ts`, so 4.4 waits on 11; 11 waits on 3 because the tab now opens `/admin`.
- Decision (2026-09-26): the user's approval of this breakdown is the go-ahead for G1, G2, G3 and G10 (server-gaps: each needs its own go-ahead).
- Assumption (2026-09-26): periods and "today" are Europe/Brussels calendar days; entry 3 defines the boundary and every later entry reuses it.
- High-risk check (entry 2): the migration-guard subagent reviews the migration, outside the entry's own tests.
