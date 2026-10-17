# Epic 538 Context: The numbered tournée holds under failed, late and racing syncs

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Harden the shipped numbered tournée (a morning swipe that freezes each agent's numbered stops, kept on the server as inserts only) against failed, late and racing syncs. Two phones of one agent must end every day with the same tournée and numbers, and no sync may be refused because of its tournée. These are fixes to a shipped feature from the epic #496 retro (actions 2, 3, 4, 6, 8), not a new path through the layers. Success is that the next retro finds none of F1–F15 open again.

## Stories

- Story 1: The release checklist waits for the review bot
- Story 2: A failed tournée write no longer fails the sync, and the ledger counts stay whole
- Story 3: The earliest swipe wins, whichever phone syncs first
- Story 4: Stop numbers are unique in the database and joiners show « Nouveau » on any clock
- Story 5: The tests pin the door-day readers, the wire schemas and the outbox drain

## Requirements & Constraints

- A throw in the tournée write must not fail the sync: visits stay acknowledged; tournées and stops not written stay out of `accepted` so the phone resends them.
- The Visites live feed cursor must miss no door-day on a truncated poll, including rows tied on `received_at` at the cut.
- The duplicates screen counts door-days (one agent, one prospect, one Brussels day), like every other admin figure.
- The stop-number rule lives once in the shared schemas; the sync stop schema reuses it.
- The earliest swipe wins, defined as `min(client_started_at)` with the id as tie-break. The clamped `started_at` is deliberately not used: with both clocks ahead, both clamp to arrival time and arrival order decides again. The loser adopts the winner's numbers on its next pull.
- D1 refuses a second stop under one number in one tournée; the insert decides the collision, not an in-memory check.
- A stop whose prospect never arrives is accepted and not stored once its tournée's day has passed (owner's decision; no quarantine table, so ADR-0022 is unchanged). Until then it stays held back. This stops it filling the 250-stop slice for ever.
- A stop naming a tournée the server does not hold for this agent stays accepted-and-dropped, pinned by a server test.
- A joiner shows « Nouveau » whatever the phone's clock, with no comparison of a server time against a phone time.
- Every Worker test about "today" fixes the clock (as `dashboard.test.ts` does), so the suite passes 00:00–01:00 Brussels.
- Tests: one parity test over the three door-day readers on a seed crossing both DST changes; DST-day tests for `doorDaysOn`, `writeTournees`, `todayTournee`; Worker tests parse responses with their zod schemas; `indexes.test.ts` plans the statements the code actually runs; six client tests, the partial-accept drain first (a sent stop the server did not list, beside one it did; "delete everything sent" must fail a test).
- Out of scope: the location-gate threshold, F17 (the admin round's own `left` check), the retro's unverified findings, #527/#528/#530, admin-built tournées.
- Done also means: the epic ships through CI; `pnpm lint`, `typecheck`, `test`, `build`, `check:precache` green; `docs/api.md`, `docs/data-model.md`, `docs/domains/field-operations.md` and ADR-0036 match what shipped. PRs touching the field client quote the precache total against the 1,000 KiB ceiling.

## Technical Decisions

- Data stage is disposable (ADR-0033): schema and contract change in one step, one migration per change, no backfill, no expand/contract. A breaking contract change raises `CLIENT_VERSION` and `MIN_CLIENT_VERSION` together, with no window. Sync contract changes go through the `sync-contract-change` skill, migrations through `d1-migration`.
- Agents only insert; the server is the source of truth and the outbox is deleted only for ids listed in `accepted` (invariants 2, 4, 5; ADR-0007). "Earliest wins" must stay insert-only: store every tournée of the agent's day, pick the winner on read (`todayTournee`, admin round, `agentsStartedOn`) rather than updating.
- That replaces the `tournees_agent_day_idx` unique (agent, day) index, and the phone's adoption of the winner changes with it. A phone that held a later tournée replaces its stops with the winner's on its next pull. What happens to the loser's unsent joiners and stops is an open unknown for story 3.
- `accepted` means "the server has durably taken this", not "a row exists" (ADR-0022). The F4 drain and the F5 drop apply that reading to stops.
- Failure policy for a sync write step: its own try/catch, as the agent-position write does (ADR-0028), so the visits are still acknowledged. A new write step states what its failure does to `accepted`.
- Server write order: field prospects, then visits, then tournées, then stops. A tournée takes its Brussels day from its clamped start time today; a stop is sent only with or after its tournée; D1 allows at most 100 bound parameters per statement (`chunk()`); batches are capped (`SYNC_TOURNEES_PER_REQUEST`, `SYNC_STOPS_PER_REQUEST`, 250-stop slice).
- Unique (tournée, prospect) already exists; unique (tournée, number) is the addition. Today the first stored keeps a number and the losing phone re-appends its prospect as the next number after its pull.
- The sync response already carries `serverTime`, `tournee` (with derived `left`) and `visitedStops`. Whether the « Nouveau » fix needs a new response field is unresolved (story 4 settles it); wire schemas are zod/mini in `src/shared/schemas.ts`.
- ADR-0036 › Numbers says only an unsynced number can change; the earliest-wins rule contradicts that, so reword it in place (as the 2026-10-15 amendment did). Confirm with `architect` that no new ADR is needed.
- ADR-0028's consequence line must say the owner has told both agents (confirmed 2026-10-13), not that he will. `docs/security.md` line 43 changes with it. The checklist's existing line about telling the agents before changing what the phone sends stays.
- Admin feed fix may need a compound (`received_at`, id) cursor or a has-more flag. This may change the admin feed response but not the sync contract.

## Cross-Story Dependencies

- Stories 2 → 3 → 4 → 5 are one lane: they share the sync handler, `writeTournees`, shared schemas, the DB schema and migrations, `sync.test.ts` and the client sync code. Build in that order.
- Story 3 builds on story 2's try/catch guard and keeps `writeTournees` inside it; it keeps the `agentsStartedOn` plan in `indexes.test.ts` green with a minimal change.
- Story 4 builds on the tournées story 3 stores and its migration.
- Story 5 tests what stories 2–4 leave, reuses story 2's clock-faking setup, and rewrites `indexes.test.ts` against the indexes left by 3 and 4.
- Story 1 touches only the release checklist, ADR-0028 and `security.md`, so it runs beside story 2. It is not a code prerequisite, but its checklist line is in place for later PRs.
