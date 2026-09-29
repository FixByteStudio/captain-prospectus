---
tracker_id: "117"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/117"
tracker_status: in-progress
type: epic
title: "Agents work their round on the new field app"
parent: initiative-dashboard-redesign
covers: [CAP-5, CAP-6, CAP-7, CAP-8, CAP-9, CAP-11]
after: []
assignee: ""
risk: high
status: in-progress
---

# Agents work their round on the new field app

## Description

Tournée du jour, Carte, Visite (with its save confirmation) and Ajouter un prospect are rebuilt in the new design, one screen per story. Carte is a new lazy Leaflet screen with its own tab. Daily progress uses server-gaps G8, settled as a local Dexie log with no sync change.

## Outcome

An agent walks the round, records visits and adds places offline on the new app; EXPERIENCE.md Flows 1 and 4 are the signal.

## Done when

1. Flows 1 and 4 run end to end in airplane mode on a phone and a tablet, in light and dark.
2. No outcome card shows or implies a status, and every swipe or tap starts only Visiter or Y aller (invariants 2 and 3).
3. Carte shows the OSM attribution online and its offline notice without any tile request offline; Leaflet stays out of the entry chunk.
4. The build's precache line reads at or under 1,000 KiB, and the PR quotes it and the entry chunk (ADR-0026).
5. `docs/design.md`'s field sections match the screens.

## Boundaries

The four field screens, the Carte tab (CAP-5 for that tab only) and G8. Entry 13 is the exception: the `interested` status reaches the admin screens and the Worker. Not the rest of the field shell (epic-shared-shell), not the admin round view (epic-admin-round-view), which reuses this epic's StopRow, StopNumber and map component.

## References

- parent — _bmad-output/initiative-dashboard-redesign/initiative-dashboard-redesign.md
- spec — _bmad-output/specs/spec-dashboard-redesign/SPEC.md, CAP-6 to CAP-9; _bmad-output/specs/spec-dashboard-redesign/server-gaps.md, G8; _bmad-output/specs/spec-dashboard-redesign/screen-map.md, Field
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-f1-tournee.html, key-f2-carte.html, key-f3-f5-visit.html; _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, Flows 1 and 4
- constraint — docs/adr/0026-budget-the-field-precache-not-the-entry-chunk.md
- spec — _bmad-output/specs/spec-done-stop-leaves-the-round/SPEC.md, CAP-1 to CAP-5, for entries 13 and 14

## Notes

- Waits on epic-shared-shell because: the screens render inside the field shell and tabs, and ADR-0026 must be accepted first.
- Decision (2026-09-26): G8 is settled in the spec as a local Dexie log of today's sent visit ids, with no sync-contract change; entry 2 owns it (spec memlog).
- Decision (2026-09-26): tracer bullet is 1, Tournée du jour, which also makes StopRow and StopNumber the shared components Carte (4, 5) and epic-admin-round-view reuse.
- Decision (2026-09-26): 1 and 6 wait on epic-dashboard's 2.1 so nothing here touches `app.css` while 2.1 and 2.2 run (user); Carte (4) waits on 2.11, which also edits `tabs.ts`.
- Decision (2026-09-26): the save sheet (8) queues visits through entry 2's function, so the progress count and the outbox stay one write path.
- Decision (2026-09-26): a closing hitl entry (12) has a person run Flows 1 and 4 on real devices, because epic-shared-shell closed with its browser checks unrun (user).
- Assumption (2026-09-26): Carte's walking path is straight lines between stops, since a routing service would bill (ADR-0002); the map's dark look is open (#27).
- High-risk check (entry 2): the sync-contract-change skill's outbox step and a test upgrading a version 2 database that holds outbox rows, outside the entry's own criteria.
- Decision (2026-09-30): entries 13 and 14 remediate the epic-117 retro (rejected, F1 to F3) from spec-done-stop-leaves-the-round, split into server status and phone work at the owner's request; 14 needs 13 because the after-sync rule holds only once `interested` stops mapping to follow_up.
- Decision (2026-09-30): 13 crosses this epic's Boundaries into admin and Worker code; it stays here because it exists to make Done when 1 pass (owner).
- Decision (2026-09-30): no second refactor sweep after 13 and 14; the sweep (11) already ran, and each is a scoped remediation that runs lint, typecheck, test and build itself.
- Decision (2026-09-30): 13 waits on 3.1 (app.css) and 3.2 (export in admin.ts), and 3.5 waits on 13 so the Prospects rebuild starts with six statuses (owner).
- Decision (2026-09-30): #129 (12) runs after 14; Flow 1's climax is its concrete check (retro action item 5).
