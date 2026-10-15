# Epic 496 Context: Each agent's day runs on a numbered tournée

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Replace the live, ever-reshuffling round with a numbered tournée: each morning the agent swipes « Commencer la tournée » to freeze their open work into a day's stops that keep their numbers all day. The phone sends it through the outbox and the server keeps it as inserts only, so a second phone or a reinstall sees the same numbers. The counter becomes « {n} sur {total} » in arrêts, computed from server visits plus the outbox, which ends « 0 sur 23 » and « 17 sur 16 ». Admin figures switch to one unit (door-days), so phone, map and admin round view agree.

## Stories

- Story 1.1: docs/design.md decides the tournée screens
- Story 1.2: The sync carries today's tournée
- Story 1.3: A swipe freezes the day on the phone and the server
- Story 1.4: A location dialog holds the start screen until a fix is precise
- Story 1.5: Tournée and Carte show the stops by their swipe numbers
- Story 1.6: Joiners take the next numbers and leavers leave a gap
- Story 1.7: The counter counts arrêts from the server and the outbox
- Story 1.8: Carnet lists today's visited stops and reopens them
- Story 1.9: Midnight brings the gates back
- Story 1.10: Admin figures count door-days
- Story 1.11: The Visites ledger shows one row per door-day
- Story 1.12: The admin sees who started and the phone's numbers
- Story 1.13: Refactor sweep

## Requirements & Constraints

- A tournée is one agent's stops for one Brussels day, at most one per agent per day. At the swipe it holds assigned open prospects, follow-ups due today or earlier, and field prospects still in the outbox. Later follow-ups are excluded.
- Gate order after sign-in: a no-tournée message (two distinct ones: nothing assigned, and never loaded/needs connection), then the start screen under an alert location dialog, then the swipe, then the app (Tournée, Carte, Carnet, Ajouter). The location gate ends at the swipe; losing GPS later locks nothing. The sync and the unsent-visits strip are never gated. At Brussels midnight the gates return; an open visit form saves first.
- Location dialog has one action, « Activer » (same one-off `refresh()` as « Réessayer »), repeats one-off readings until accuracy passes a threshold (named constant, target 100–200 m, set after an owner pavement test). Never `watchPosition`.
- Numbers are assigned once at the swipe, nearest-next from the swipe position, never renumbered. Joiners take the next number after the highest ever given, marked « Nouveau ». An unvisited stop that leaves (reassigned, closed, merged) leaves a gap and leaves the total. The card, list, Carte pins and admin round view show the same number.
- Counter: `n` is stops with at least one visit today (any outcome, each once); `total` is snapshot plus joiners minus stops that left unvisited. UI says « arrêt », never « visite ». The phone-only `sentVisits` log is removed.
- Every saved stop leaves Tournée whatever its outcome, « Plus tard » included; this replaces the end-of-round rows of the round-placement spec. Carnet lists today's visited stops (number, latest outcome, closed prospects included); reopening saves a new visit and does not move the counter.
- Admin: a door-day is one agent, prospect and Brussels day, with the day's latest visit as its outcome. « Visites », visits-by-day chart, « Activité par agent », flyers (any visit gave one), refusal reasons (latest visit only), conversions and the recap card's visit count all count door-days. The Visites ledger shows one row per door-day with full history; the CSV export stays one row per visit. « Agents en tournée » and « actifs aujourd'hui » count agents who started today's tournée.
- Each story updates its own docs (field-operations.md, round-placement spec, design.md incl. the line promising position-refused still works, EXPERIENCE.md, api.md, data-model.md, the comment in `useAgentPosition.ts`, glossary). Field precache must stay under 1,000 KiB (PR quotes the total). Worker CPU budget of 10 ms per request applies to the grouped door-day reads.

## Technical Decisions

- Two new D1 tables, one migration: `tournees` (agent from session, Brussels day, start time clamped to `received_at`, unique per agent and day) and `tournee_stops` (tournée, prospect, number, time added, unique per tournée and prospect). Inserted with `onConflictDoNothing`; never updated. Neither holds a position.
- Visits carry no tournée id; the visit contract is unchanged. "Which stop, which day" derives from agent, prospect and the Brussels day of `visited_at`.
- Sync contract: request gains tournée and stop inserts (ids go in `accepted`; the outbox rewrites a stop's prospect id through `idMap` like a visit's). Response gains today's tournée, its stops each with a server-derived `left` flag (one function, shared with the admin round response), and today's visited stops (door-days, latest outcome, closed prospects included) from one Worker door-day reader. `CLIENT_VERSION` and `MIN_CLIENT_VERSION` rise together, no window (disposable data stage). Use the `sync-contract-change` and `d1-migration` skills; zod/mini schemas in `src/shared/schemas.ts`; ≤100 bound params, `chunk()` for multi-row inserts.
- Offline stop insert for a prospect reassigned meanwhile is accepted and listed in `accepted` (never quarantined); the server derives it as left. If two phones of one agent swipe offline the same day, the first swipe wins: the loser's tournée and stop ids are listed in `accepted` but not kept, and that phone adopts the winner's numbering on its next pull.
- Swipe reading is an ordinary ADR-0028 reading (may be sent as the marker); it no longer orders the admin round, only places the marker. Placement is read from the outbox, never a status (invariants 2, 3).
- One pure numbering function (entry 3) is reused for joiners. One shared counter helper (entry 7) is reused by Carnet. `buildTodayList` is dropped from the phone at entry 5; the admin round view keeps it until entry 12 removes the last caller. `round-map.ts` helpers are shared by phone and admin.
- Dexie owns the tournée, stops and visited-stops tables (entry 3). Dexie remains cache plus outbox; agents only insert.

## UX & Interaction Patterns

- Start screen: date overline, « Tournée du jour », stop count, a name-sorted preview of up to 7 stops (no numbers, nothing tappable) then « et {n} autres arrêts », the unsent strip, no tab bar. Admins get a « Tableau de bord » escape on gate screens.
- Swipe: a 64px track, 56px gold thumb, commits past three quarters of the track (not `SWIPE_COMMIT`), vertical start scrolls. It is one real button: Enter/Space/screen-reader activation starts at once, a pointer tap only nudges. `aria-disabled` « En attente de votre position » until a reading; « Démarrage… » while writing; a storage error shows under the track. No toast on commit.
- Location dialog: shadcn `AlertDialog` with blurred overlay, no cancel, status line (`role="status"`) for locating, too coarse, refused, unavailable; a muted line names Réglages › Localisation. A passing reading closes it and focuses the swipe.
- Tournée: counter « {n} sur {total} » with gold bar and aria « {n} arrêts faits sur {total} »; next-stop card « Arrêt {n} » is the lowest number with no visit today; rows in number order, distances informational only; « Nouveau » is an outline badge. Gaps get no placeholder row. All-done and total-0 states point to Carnet. Rows and card are named « Arrêt {n} · {name} ».
- Carnet (third tab): newest first, neutral outcome badge (never a status colour), time, « {2} visites », « Pas encore envoyé » while in the outbox; one tappable row reopens the visit form with « Retour au carnet ». A door-day outside the tournée (e.g. saved after midnight) shows a dash instead of a number and never counts. Empty state is an invitation card.
- Midnight: screens give way to the new day's first gate with no message of its own.
- All French strings go in `src/client/copy.ts` modules (field-reachable ones via `copy/field`); decide screens against `docs/design.md` first (Story 1.1 is owner-approved, HITL).

## Cross-Story Dependencies

- Build order is by id. Story 1.1 (design, HITL) gates the UI stories 3–9 and 11; Story 1.2 (sync contract, server lane) gates field and admin lanes and owns the door-day reader and shared `schemas.ts` / `api.md` edits.
- Field lane runs serially 3 → 4 → 5 → 6 → 7 → 8 → 9 because they share `useAgentPosition`, `useRound`, `round-map.ts` and the visit form. Story 1.4 is HITL (pavement test sets the threshold).
- Admin lane 10 → 11 → 12 runs beside it from Story 1.2; 11 also needs Story 1.1; 12 also needs 5 (shared `round-map.ts`) and removes the last `buildTodayList` caller.
- Stories 5, 6 and 7 read the server-derived `left` flag from Story 1.2. Story 1.7 depends on 6 for totals; 8 reuses 7's helper; 9 follows 4 and 8. Story 1.13 closes the epic.
- Open unknowns: pavement accuracy for mid-range Android and iPhone; behaviour when two phones append different joiners with the same number; whether D+1's Carnet lists a post-midnight visit not in D+1's tournée (design currently shows it numberless); whether grouped door-day reads fit the 10 ms CPU budget.
