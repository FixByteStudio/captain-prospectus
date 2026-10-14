---
tracker_id: "496"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/496"
tracker_status: backlog
type: epic
title: "Each agent's day runs on a numbered tournée"
parent: initiative-daily-tournee
covers: [R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R15, R16]
after: []
assignee: ""
risk: high
---

# Each agent's day runs on a numbered tournée

## Description

ADR-0036, built end to end. Each morning a location dialog and a swipe « Commencer la tournée » freeze the agent's open work into a numbered tournée. The phone sends it through the outbox, and the server keeps it as inserts only. The numbers never change. Joiners take the next numbers and leavers leave a gap. The counter reads « {n} sur {total} » in arrêts, from the server's visits and the outbox, and the phone-only `sentVisits` log goes. Every saved stop leaves Tournée for a new Carnet tab, where reopening a stop saves a new visit. On the admin side, every figure, the Visites ledger and the recap card count door-days. « Agents en tournée » counts agents who swiped. The round view shows the phone's numbers.

## Outcome

An agent who has made 15 of 20 stops reads « 15 sur 20 » and « Arrêt 16 », and the admin sees the same numbers and one unit everywhere. The signal is that the owner's « 0 sur 23 » and « 17 sur 16 » reports stop.

## Requirements

Source: ADR-0036 (as amended 2026-10-14 with the recap card and the CSV export), section Decision.

- R1: A tournée is one agent's stops for one Brussels calendar day, at most one per agent per day. At the swipe it holds the agent's assigned prospects with an open status, follow-ups due today or earlier, and field prospects still in the outbox. Follow-ups due on a later day are not in it.
- R2: After sign-in, with no tournée, one message says nothing is assigned. A different message says the phone has never loaded a round and needs a connection. When an assignment arrives, the next sync shows the start screen.
- R3: The location gate is an alert dialog over the start screen, which shows the date and the stops. It has one action, « Activer », the same one-off reading as « Réessayer » (`refresh()`), which brings up the browser prompt on first use. A short line names Réglages › Localisation for a refusal. While the dialog is open, the phone repeats one-off readings until the accuracy passes a threshold. The threshold is set after a pavement test, target 100–200 m. The dialog appears only when a tournée exists, and T1 has no way past it without a position.
- R4: The swipe « Commencer la tournée » works offline and is a real button for the keyboard and screen readers. It reuses `swipe.ts`. After it come Tournée, Carte, Carnet and Ajouter. The location gate ends at the swipe, and losing GPS later locks nothing. The sync is never gated: the outbox drains and the unsent-visits strip shows before and after the swipe.
- R5: At Brussels midnight the gates come back. A visit form that is open at midnight saves first.
- R6: The phone numbers the stops once, at the swipe, nearest-next from the swipe position, and never renumbers them. Joiners take the next numbers at the end, marked « Nouveau ». An unvisited stop that leaves the agent's open work (reassigned, closed by the admin or merged) leaves a gap and leaves the total. The next-stop card shows the lowest-numbered stop with no visit today. The card, the list, the Carte pins and the admin round view show the same number. The tournée and stop rows hold no position. The swipe reading is an ordinary ADR-0028 reading, which may be sent as the marker.
- R7: The counter reads « {n} sur {total} », and the UI calls a stop an arrêt, never a « visite ». `n` is the tournée's stops with at least one visit today, any outcome, each counted once. `total` is the snapshot plus joiners minus stops that left unvisited. `n` comes from the server's visits for today joined with the outbox by visit id, and `sentVisits` goes away.
- R8: Every saved stop leaves Tournée, whatever its outcome, and « Plus tard » leaves Tournée too. This replaces the end-of-round rows of `round-placement.md`. A follow-up due on a later day comes back as a stop in that day's tournée.
- R9: A Carnet tab lists today's visited stops, each with its number and latest outcome, from the server and the outbox, closed prospects included. Reopening a stop opens the visit form and saves a new visit. Carnet shows today only.
- R10: A tournée row holds the agent (from the session), the Brussels day and the start time clamped to `received_at`. It is unique per agent and day and inserted with `onConflictDoNothing`. Stop rows hold the tournée, the prospect, the number and the time added, unique per tournée and prospect. They arrive through the outbox, the snapshot at the swipe and each joiner, and are never updated. A stop that left is derived from the prospect's assignment and status, never written.
- R11: The sync response returns today's tournée and its stops, so a second phone or a reinstall gets the same numbers and no gate. It also returns today's visited stops for Carnet and the counter. Visits carry no tournée id, and the visit contract does not change. `CLIENT_VERSION` and `MIN_CLIENT_VERSION` rise together.
- R12: A door-day is one agent, one prospect and one Brussels day, and its outcome is that day's latest visit. These count door-days: « Visites », the visits-by-day chart, « Activité par agent », flyers (a door-day counts if any of its visits gave one), refusal reasons (latest visit only), conversions, and the sidebar recap card's visit count.
- R13: The Visites ledger shows one row per door-day, and opening a row shows the details and the full visit history. The Visites CSV export stays one row per visit.
- R14: « Agents en tournée » and the recap card's « actifs aujourd'hui » count agents who started today's tournée.
- R15: The admin round view shows the tournée's stops in their numbers. The reading stored at sync (ADR-0028) places the agent's marker only and no longer orders the stops.
- R16: Each part updates its own docs, as ADR-0036 › Consequences lists: `docs/domains/field-operations.md`, the `round-placement.md` spec, `docs/design.md` (line 1723 included), EXPERIENCE.md, `docs/api.md`, `docs/data-model.md`, the comment at `useAgentPosition.ts:10`, and the glossary (Tournée, Arrêt, Carnet, door-day). The field precache stays under 1,000 KiB.

## Done when

1. On a local build, an agent with assigned prospects gets the start screen and the location dialog until a reading passes the threshold. They swipe « Commencer la tournée », by touch and by keyboard, and land on Tournée. Tournée, the Carte pins and the admin round view show the same numbers. After 15 of 20 stops the counter reads « 15 sur 20 » and the card « Arrêt 16 ».
2. Every saved stop, whatever its outcome, moves to Carnet with its number and latest outcome. Reopening a stop from Carnet saves a new visit, and the counter does not move.
3. A second browser profile, or the same one after a cache wipe, gets the same tournée, numbers, counter and Carnet from the next sync without the gate. A prospect assigned after the swipe takes the next number and shows « Nouveau ». A reassigned unvisited stop lowers the total and leaves a gap.
4. Personne sur place at 10:00 and Converti at 16:00 on one door count 1 in « Visites », the chart, « Activité par agent », conversions and the recap card. They are one ledger row whose history lists both visits, and two rows in the CSV export. An agent who swiped but sent no visit counts in « Agents en tournée » and « actifs aujourd'hui ».
5. At Brussels midnight the gates come back, and a visit form open at midnight saves first.
6. The epic is on production through CI. `pnpm lint`, `typecheck`, `test`, `build` and `check:precache` are green, and the docs in R16 match what shipped.

## Boundaries

Capability boundary: one agent's day, from the swipe to Carnet, and the admin figures that read it. It covers the field app (`src/client/field/`), the sync route and contract, two new D1 tables, and the admin dashboard, recap, Visites ledger and round view. It is not admin-built tournées (T2), not agent edits to a visit, not the CSV export's shape, and not continuous tracking: readings stay one-off, never `watchPosition`.

## References

- adr — docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md, section Decision
- constraint — docs/adr/0007-offline-first-insert-only-sync.md
- constraint — docs/adr/0022-quarantine-visits-the-server-cannot-take.md
- constraint — docs/adr/0028-agent-position-at-sync.md (amended by ADR-0036)
- constraint — docs/adr/0031-the-precache-ceiling-counts-every-precached-entry.md
- constraint — docs/adr/0033-rollout-rules-wait-for-protected-data.md
- domain — docs/domains/field-operations.md
- spec — _bmad-output/specs/spec-done-stop-leaves-the-round/round-placement.md (replaced by R8)
- design — docs/design.md
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md
- skill — .claude/skills/sync-contract-change/SKILL.md
- skill — .claude/skills/d1-migration/SKILL.md
- history — _bmad-output/party-mode/2026-10-14-quinze-sur-vingt.html

## Notes

- Decision (2026-10-14): one epic of 13 entries, past the usual 8–12. The owner's call: it is the T1 epic from the party session, with one owner.
- Decision (2026-10-14): the sidebar recap card counts door-days, and its « actifs aujourd'hui » counts agents who started today's tournée. The owner amended ADR-0036 in place to say so.
- Decision (2026-10-14): `/api/admin/visits/export.csv` stays one row per visit (ADR-0036, amended).
- Decision (2026-10-14): a stop insert for a prospect reassigned while the phone was offline is accepted and listed in `accepted` (invariant 5), and the server derives it as left. It is not quarantined.
- Decision (2026-10-14): the server derives `left` in one function. The sync response and the admin round response carry it on each stop, so the phone and the admin view cannot disagree (entries 2, 6, 7 and 12).
- Decision (2026-10-14): entry 2, the sync contract, opens the server lane first so the field and admin lanes can build against it. Entry 3 is the tracer bullet: a swipe on the start screen, through the outbox into D1, pulled back by a second phone.
- Decision (2026-10-14): the field lane runs in order (3 → 4 → 5 → 6 → 7 → 8 → 9) because those entries share `useAgentPosition`, `useRound`, `round-map.ts` and the visit form. The admin lane (10 → 11 → 12, with 12 also after 5) runs beside it from entry 2, which owns the door-day reader and the shared docs/api.md and schemas.ts edits the admin entries build on (set check, 2026-10-14).
- Decision (2026-10-14): ADR-0036 says "the first story sets the threshold after a pavement test". That is entry 4, the location dialog, the first story that needs it.
- Decision (2026-10-14): each entry updates its own docs (R16), so there is no docs story. Entry 1 owns `docs/design.md`, EXPERIENCE.md and the glossary terms.
- Decision (2026-10-14): a closing refactor sweep (13).
- Source conflict: R6 — ADR-0036 said the swipe position is "never sent or stored", but every reading `useAgentPosition` takes is remembered and sent at the next sync as the ADR-0028 marker (`useAgentPosition.ts:6`, `sync.ts:141`). Decision (2026-10-14): the swipe reading is an ordinary ADR-0028 reading, and the tournée rows hold no position. ADR-0036 is reworded to say so.
- Decision (2026-10-14): when two phones of one agent swipe offline on the same day, the first swipe wins. The server lists the losing phone's tournée and stop ids in `accepted`, so its outbox clears, but keeps none of them. That phone adopts the winning tournée and its numbers on its next pull. One numbering per agent and day.
