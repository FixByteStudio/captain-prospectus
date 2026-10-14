---
tracker_id: "4"
remote: "https://github.com/FixByteStudio/captain-prospectus/milestone/4"
tracker_status: backlog
type: initiative
title: "Each agent's day runs on a numbered tournée"
parent: none
covers: [R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R15, R16]
after: []
assignee: ""
risk: high
---

# Each agent's day runs on a numbered tournée

## Description

ADR-0036 replaces the live round with a tournée frozen at a morning swipe. A location gate and the swipe start the day, and stop numbers never change after the swipe. The counter counts arrêts once, every saved stop moves to a new Carnet tab, and the server keeps the tournée as inserts only. The admin and the stats count door-days. The work fits one epic, `epic-numbered-tournee`, whose Requirements hold the ADR's lines. This initiative's `covers` lists the same ids.

## Outcome

An agent reads « 15 sur 20 » after 15 stops, the phone, the map and the admin agree on every stop number, and every admin figure counts one unit, the door-day.

## Requirements

Held by the one epic: `epic-numbered-tournee/epic-numbered-tournee.md`, section Requirements (R1–R16).

## Done when

1. For one agent's day, the phone's Tournée, its Carte pins and the admin round view show the same stop numbers. The counter never exceeds the total and never resets.
2. A cleared cache or a second phone gets back the same tournée, numbers, counter and Carnet from the next sync.
3. Every admin figure, the recap card included, counts door-days. A corrected visit replaces the earlier outcome in the stats, and the history keeps both.
4. The epic is on production through CI, with `pnpm lint`, `typecheck`, `test` and `build` green and the docs ADR-0036 lists matching what shipped.

## Boundaries

The field app's day (gates, swipe, Tournée, Carte, Carnet), the sync contract and two new D1 tables, and the admin figures, Visites ledger and round view. Not admin-built tournées for a date (T2), not agent edits to a visit (ADR-0007 holds), and not the Visites CSV export, which stays one row per visit. Tracer path: an agent swipes on the start screen, the snapshot drains through the outbox into D1, and a second phone pulls the same numbered tournée.

- Touch point: `src/client/admin/round/round-list.ts`, which imports the field's `round-map.ts`; owner: epic-numbered-tournee (entries 5 and 12)
- Touch point: the field precache ceiling (ADR-0031), which the start screen and Carnet count against; owner: epic-numbered-tournee

## References

- adr — docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md
- constraint — docs/adr/0007-offline-first-insert-only-sync.md
- constraint — docs/adr/0033-rollout-rules-wait-for-protected-data.md
- constraint — docs/adr/0031-the-precache-ceiling-counts-every-precached-entry.md
- history — _bmad-output/party-mode/2026-10-14-quinze-sur-vingt.html

## Notes

- Decision (2026-10-14): one initiative with one epic. The owner called this the T1 epic in the ADR-0036 party session.
- Parked: admin-built tournées for a date (T2). ADR-0036 leaves them to a later decision, on the same tables.
