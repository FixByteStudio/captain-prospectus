# Epic 496 Context: Each agent's day runs on a numbered tournée

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Replace the live, ever-reshuffling round with a numbered tournée: each morning the agent swipes « Commencer la tournée » to freeze their open work into a day's stops that keep their numbers all day. The phone sends it through the outbox and the server keeps it as inserts only, so a second phone or a reinstall sees the same numbers. The counter becomes « {n} sur {total} » in arrêts, computed from server visits plus the outbox, which ends the « 0 sur 23 » and « 17 sur 16 » reports. Admin figures switch to one unit (door-days), so phone, map and admin round view agree. Stories 1.1 to 1.12 have shipped; Story 1.13 closes the epic.

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

- A tournée is one agent's stops for one Brussels day, at most one per agent per day. It holds assigned open prospects, follow-ups due today or earlier, and field prospects still in the outbox; later follow-ups are excluded and come back on their day.
- Gate order after sign-in: a no-tournée message (two distinct ones: nothing assigned, and never loaded/needs connection), then the start screen under an alert location dialog, then the swipe, then the app (Tournée, Carte, Carnet, Ajouter). The location gate ends at the swipe; losing GPS later locks nothing. The sync and the unsent-visits strip are never gated. At Brussels midnight the gates return, and an open visit form saves first.
- Location readings are one-off (`refresh()`), repeated until accuracy passes a named threshold (target 100–200 m, set by an owner pavement test). Never `watchPosition`.
- Numbers are given once at the swipe, nearest-next from the swipe position, and never change. Joiners take the next number and show « Nouveau ». An unvisited stop that leaves (reassigned, closed, merged) leaves a gap and leaves the total. Card, list, Carte pins and admin round view show the same number.
- Counter: `n` is stops with at least one visit today (any outcome, each once); `total` is snapshot plus joiners minus stops that left unvisited. The UI says « arrêt », never « visite ». The phone-only `sentVisits` log is gone.
- Every saved stop leaves Tournée whatever its outcome; there is no « Plus tard ». Carnet lists today's visited stops (number, latest outcome, closed prospects included); reopening saves a new visit and does not move the counter.
- Admin: a door-day is one agent, prospect and Brussels day, whose outcome is the day's latest visit. « Visites », the visits-by-day chart, « Activité par agent », flyers (any visit gave one), refusal reasons (latest visit only), conversions and the recap card's visit count all count door-days. The Visites ledger shows one row per door-day with its full history; the CSV export stays one row per visit. « Agents en tournée » and « actifs aujourd'hui » count agents who started today's tournée (the swipe, no visit needed).
- Each part updates its own docs: field-operations.md, the round-placement spec, design.md, EXPERIENCE.md, api.md, data-model.md, the comment in `useAgentPosition.ts`, the glossary (Tournée, Arrêt, Carnet, door-day). The field precache stays under 1,000 KiB and the PR quotes the total. Workers CPU is 10 ms per request, which bears on the grouped door-day reads.
- Out of scope: admin-built tournées, agent edits to a visit, the CSV export's shape, continuous tracking.

## Technical Decisions

- Two D1 tables, `tournees` (agent from the session, Brussels day, start time clamped to `received_at`, unique per agent and day) and `tournee_stops` (tournée, prospect, number, time added, unique per tournée and prospect). Inserted with `onConflictDoNothing`, never updated, neither holds a position. A stop that left is derived from the prospect's assignment and status, never written.
- Visits carry no tournée id and the visit contract is unchanged; "which stop, which day" derives from agent, prospect and the Brussels day of `visited_at`.
- Sync contract: the request carries tournée and stop inserts (ids in `accepted`; the outbox rewrites a stop's prospect id through `idMap` like a visit's). The response carries today's tournée, its stops each with a server-derived `left` flag (one function, shared with the admin round response), and today's visited stops from one Worker door-day reader. `CLIENT_VERSION` and `MIN_CLIENT_VERSION` rose together with no window (disposable data stage). Rules: zod/mini schemas in `src/shared/schemas.ts`, ≤100 bound params with `chunk()`, idempotent inserts, outbox rows cleared only via `accepted`.
- An offline stop insert for a prospect reassigned meanwhile is accepted and listed in `accepted` (never quarantined); the server derives it as left. If two phones of one agent swipe offline the same day, the first swipe wins: the loser's ids are listed in `accepted` but not kept, and that phone adopts the winner's numbering on its next pull.
- The swipe reading is an ordinary ADR-0028 reading (may be sent as the marker). It places the admin's marker only and no longer orders the round. Placement is read from the outbox, never a status (invariants 2, 3).
- One pure numbering function (swipe) is reused for joiners; one shared counter helper is reused by Carnet. `round-map.ts` helpers are shared by phone and admin. `buildTodayList` leaves the phone at Story 1.5 and the admin at Story 1.12, so a leftover caller is dead code for the sweep.
- Dexie owns the tournée, stops and visited-stops tables and stays cache plus outbox; agents only insert.

## UX & Interaction Patterns

- Start screen: date overline, « Tournée du jour », stop count, a name-sorted preview of the first 7 stops (no numbers, not tappable) then « et {n} autres arrêts », the unsent strip, no tab bar. Admins get a « Tableau de bord » escape on gate screens.
- Swipe: a real button for keyboard and screen readers (Enter/Space start at once; a pointer tap only nudges the thumb). It commits past three quarters of the track, a vertical start scrolls, it is `aria-disabled` « En attente de votre position » until a reading, shows « Démarrage… » while writing, and shows a storage error under the track. No toast.
- Location dialog: shadcn `AlertDialog` with no cancel, one « Activer » action, a `role="status"` line (locating, too coarse, refused, unavailable) and a line naming Réglages › Localisation. A passing reading closes it and focuses the swipe.
- Tournée: counter « {n} sur {total} » with a bar; next-stop card « Arrêt {n} » is the lowest number with no visit today; rows follow the numbers, not the distance; gaps get no placeholder; all-done and total-0 states point to Carnet. Rows and card are named « Arrêt {n} · {name} ».
- Carnet: newest first, neutral outcome badge (never a status colour), time, « {2} visites », « Pas encore envoyé » while in the outbox. A row reopens the visit form with « Retour au carnet ». A door-day outside the tournée shows no number and never counts. The empty state is an invitation card.
- Visites ledger: one row per door-day showing its latest visit, ordered by the greatest `received_at`; opening a row expands it in place to every visit, oldest first.
- Midnight: screens give way to the new day's first gate with no message of its own.
- All French copy lives in `src/client/copy.ts` modules (field-reachable ones via `copy/field`); screens are decided against `docs/design.md`.

## Cross-Story Dependencies

- Story 1.13 follows all others. It is cleanup only, scoped from build records and review findings deferred during the epic: each is fixed or filed. It also checks that `pnpm lint`, `typecheck`, `test`, `build` and `check:precache` are green, that CI has deployed the epic to production, and that the docs match what shipped.
- Docs drift to check in 1.13: EXPERIENCE.md's dashboard-metrics table still carries « Pending ADR-0036 » notes on « Visites » and « Flyers remis » although Story 1.10 shipped, and its Activité par agent definition still says visits.
- Open unknowns: the pavement-test threshold value; two phones appending different joiners with the same number; whether D+1's Carnet lists a post-midnight visit whose prospect is not in D+1's tournée (the design shows it numberless); whether grouped door-day reads fit the 10 ms CPU budget.
