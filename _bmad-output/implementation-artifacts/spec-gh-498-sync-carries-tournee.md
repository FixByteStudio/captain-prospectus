---
title: 'The sync carries today''s tournée (story 1.2, #498)'
type: 'feature'
created: '2026-10-14'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment', 'migration-guard']
review_loop_iteration: 0
baseline_commit: '6fae7f62a1d87f9f1ed308029e2c78471ae24d22'
context:
  - '{project-root}/docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md'
  - '{project-root}/.claude/skills/sync-contract-change/SKILL.md'
  - '{project-root}/.claude/skills/d1-migration/SKILL.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** ADR-0036's tournée lives nowhere on the server: a phone cannot send it, and a second phone, a reinstall or the admin cannot get it back, nor the day's visited stops that Carnet and the counter need.

**Approach:** Two insert-only tables (`tournees`, `tournee_stops`) in one migration, a sync request that carries tournée and stop inserts, and a sync response that returns today's tournée with each stop's server-derived `left` flag, plus today's door-days from one Worker reader. `CLIENT_VERSION` and `MIN_CLIENT_VERSION` go 1 → 2 together (data stage disposable). Server and contract only: the phone's Dexie tables and its use of the new fields are entry 3's.

## Boundaries & Constraints

**Always:** Agent from the session only (invariant 10). Inserts only, `onConflictDoNothing`, never an update (invariants 2, 4). Every id the server took or deliberately dropped is listed in `accepted` (invariant 5 spirit: an outbox row must never retry forever). `chunk()` + `boundParamsPerRow` for every multi-row insert (invariant 7). zod/mini (invariant 6). Start and added times clamped to `received_at`, like `visited_at` (invariant 12). `left` is computed in one pure function. Brussels day via `brusselsMidnightDaysFromNow(t, 0)`.

**Never:** A tournée id on visits, or any change to the visit contract. A position on either table. Dexie, the start screen or any client screen (entries 3+). Admin figures or `/agents/:email/round` (entries 10, 12). A unique index on (tournée, number) (entry 6 owns joiner collisions).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Swipe syncs | tournée T + 20 stops, all the agent's prospects | T and 20 stops stored; all 21 ids in `accepted`; response `tournee` = T with 20 stops, `left: false` |
| Second session | another session of the same agent syncs empty | same `tournee`, same numbers |
| Resend | same batch twice | nothing inserted twice; same `accepted` |
| Losing phone | T2 for same agent and day after T | T2 and its stops in `accepted`; none stored; response `tournee` = T, stops unchanged |
| Stop on reassigned prospect | prospect assigned to someone else, unvisited | stop stored, accepted, `left: true` |
| Visited then closed | agent's visit today converted it | stop `left: false`; prospect in `visitedStops` with latest outcome, name, type, address |
| Field prospect | stop for a client id rewritten by `idMap` | stored against the server id |
| Unknown prospect / tournée not the agent's | stop references neither | accepted, dropped |
| Old build | `clientVersion: 1` | 426, nothing written |
| No tournée today | agent never swiped | `tournee: null`; `visitedStops` still returned |

</frozen-after-approval>

## Code Map

- `src/worker/db/schema.ts` -- add `tournees` (`id` pk text, `agentEmail`, `dayStart` int = Brussels midnight ms, `startedAt`, `clientStartedAt`, `receivedAt`; unique `tournees_agent_day_idx` on (agentEmail, dayStart)) and `tourneeStops` (`id` pk, `tourneeId` FK, `prospectId` FK prospects, `number` int, `addedAt`, `clientAddedAt`, `receivedAt`; unique (tourneeId, prospectId); index on prospectId). Follow `visits` style; add inferred types near :392.
- `drizzle/` -- `pnpm db:generate` after the schema; latest is `0015_old_mantis.sql`.
- `src/shared/schemas.ts:628-697` -- sync block. Request gains `tournees` (`{id, startedAt}`, max `SYNC_TOURNEES_PER_REQUEST`) and `stops` (`{id, tourneeId, prospectId, number ≥1 int, addedAt}`, max `SYNC_STOPS_PER_REQUEST`), both `z._default(…, [])`. `accepted` gains `tournees`, `stops`. Response gains `tournee: nullable({id, dayStart, startedAt, stops: [{id, prospectId, number, addedAt, left}]})` and `visitedStops: [{prospectId, outcome, visitedAt, flyerGiven, visitIds, name, type, address}]`. Export the types.
- `src/shared/constants.ts:139-161` -- `CLIENT_VERSION`/`MIN_CLIENT_VERSION` → 2; `SYNC_TOURNEES_PER_REQUEST = 7`, `SYNC_STOPS_PER_REQUEST = 250` (a bigger snapshot drains over passes, entry 3).
- `src/shared/tournee.ts` (new, pure) -- `isStopLeft({assignedTo, status, mergedInto}, agentEmail, visitedToday)`: false when visited today; else true unless assigned to the agent, open (`isOpen`) and not merged.
- `src/worker/door-days.ts` (new) -- `doorDaysOn(db, {dayStart, agentEmail})`: the agent's visits with `visited_at` in that Brussels day, one row per prospect (the visit's own `prospect_id`), latest by `visited_at desc, received_at desc, id desc` (SQLite window function), `flyerGiven` = any, `visitIds` all, joined to the prospect's name/type/address. Entry 10 extends it to many days and agents; keep the latest-visit rule in one place.
- `src/worker/tournee.ts` (new) -- `writeTournees(db, email, now, tournees, stops, idMap)` and `todayTournee(db, email, now, visitedProspectIds)` (stops in number order with `left` from `isStopLeft`).
- `src/worker/routes/agent.ts:62-290` -- after visits (step 2) and status (step 3): write tournées then stops (stops into tournées owned by `email` only, found by a chunked lookup after the insert; prospect ids via `idMap`; unknown prospects dropped before the insert because of the FK), extend `accepted`; in the pull, add `tournee` and `visitedStops`.
- `src/worker/sync.test.ts` -- harness: `sync()` helper (:35), `seedProspect(s)`, `beforeEach` deletes (add the new tables, children first), `testSession` from `test/session.ts` for a second session, `env.DEV_USER_EMAIL` switching. Bump the helper's `clientVersion` to `CLIENT_VERSION`.
- `src/shared/constants.test.ts:59-92` -- the full-sync byte budget must include maxed tournées and stops.
- `src/client/field/sync.test.ts:33` (`okResponse`) and any typed `SyncResponse` literal -- add the new response fields. `src/client/field/sync.ts` needs no logic change (it parses with the shared schema; entry 3 consumes).
- Docs: `docs/api.md` (Agent row :26, Payload caps :76), `docs/data-model.md` (ERD :6, Rules :211, Indexes :245), `docs/domains/field-operations.md` › Protocol :139.

## Tasks & Acceptance

**Execution:**
- [x] `src/worker/db/schema.ts` + `drizzle/` -- two tables, one generated migration -- R10.
- [x] `src/shared/constants.ts`, `src/shared/schemas.ts` -- caps, versions, request/response -- R11.
- [x] `src/shared/tournee.ts` + `.test.ts` -- `isStopLeft` truth table -- one home for `left`.
- [x] `src/worker/door-days.ts` -- the reader -- R11, entry 10's base.
- [x] `src/worker/tournee.ts`, `src/worker/routes/agent.ts` -- write and pull -- R6, R10, R11.
- [x] `src/worker/sync.test.ts` -- a `describe("tournée at sync (ADR-0036)")` covering every matrix row -- story verify.
- [x] `src/shared/constants.test.ts`, `src/client/field/sync.test.ts` -- budget and fixtures follow.
- [ ] Docs above -- R16.

**Acceptance Criteria:**
- Given the migration, when `pnpm db:migrate:local` runs on a fresh DB, then both tables and their indexes exist.
- Given any sync, when it is retried after a network loss, then every new row is written exactly once and `accepted` lists the same ids.
- Given an admin syncing from the field, then they get their own tournée like an agent.

## Implementation Notes

- Implemented by a Sonnet subagent; review fixes by the same agent. `src/client/field/sync.ts` sends `tournees: []` and `stops: []` (required by the shared type), nothing more; `admin.test.ts`, `origin.test.ts` and `useSync.test.tsx` moved to `CLIENT_VERSION` because version 1 now gets 426.
- `dayStart` is the Brussels midnight of the clamped swipe time, not of `now`: a swipe made before midnight and synced after keeps its day (the gates return at midnight anyway).
- Review pass 1: stops on the agent's own tournée whose prospect is not on the server yet are held back (not accepted) instead of dropped; the contract (a stop rides with or after its tournée, and waits for its field prospect) is in field-operations.md › Protocol and api.md. `TOURNEE_STOP_NUMBER_MAX = 10_000`.
- Verification: typecheck, 2692 tests (104 files), lint, build green; `check:precache` 984.09 KiB, `main` 983.69 KiB (+0.40 KiB). `measure-sync-cpu.mjs` fixed to version 2 but not re-run (deferred).

## Spec Change Log

- Review pass 1 (high): a stop for a prospect the server does not have yet was accepted and dropped, so a stop sent ahead of its field prospect was lost for good. Amended (Implementation Notes, docs): such a stop is not accepted and retries. Known-bad state avoided: a numbered stop silently missing from the server's tournée. KEEP: accept-and-drop for a tournée that is not the agent's or lost its day (the losing phone must drain).

## Review Triage Log

Pass 1, all lenses on Sonnet (owner's standing preference; Opus hit its session limit earlier), plus `migration-guard` (d1-migration skill). Counts: high 1 · medium 8 · low 9 · false 5 · maybe-false 0. Routes: patch 15 · defer 2 · rejected 10.

| Finding | Verdict | Route | Evidence / action |
|---|---|---|---|
| Stop sent before its field prospect arrives is accepted and dropped → stop lost for good | high | patch | Unknown prospect now not accepted (prospects are never deleted, so it can only mean "not yet arrived"); contract documented; test added. Changes the Design Notes' "never reattached" rule for prospects only (Spec Change Log) |
| Stop before its tournée across passes | medium | patch (docs) | An unknown tournée cannot be told from a lost one; contract: a stop rides with or after its tournée's acceptance (entry 3), documented in field-operations › Protocol and api.md |
| `doorDaysOn` agent filter pinned by no test | medium | patch | Test: another agent's visit leaks into neither visitedStops nor `left` |
| Brussels-day window untested at the boundary | medium | patch | Test at midnight − 1 ms and at midnight |
| No handler test past 100 ids (chunked lookups) | medium | patch | 250-stop swipe test |
| Second session tested with the dev identity | medium | patch | Two real `testSession` cookies |
| Cap validation untested (8 tournées, 251 stops) | low | patch | 400 tests |
| `scripts/measure-sync-cpu.mjs` sends version 1 → 426 | medium | patch | Version 2; measurement itself not re-run (needs a seeded dev server) |
| CPU of the extra reads per pass not measured (invariant 13) | medium | defer | deferred-work: re-run measure-sync-cpu.mjs with a tournée before entry 3 ships the swipe; budget doc notes it as unmeasured |
| dayStart from the phone's clamped clock vs today's read | low | rejected | By design: a swipe before midnight belongs to its day, and the gates come back at midnight (design.md › Midnight). A clock days behind is an accepted edge |
| Comment "from the server clock" on dayStart | low | patch | Comment fixed |
| Window partition by prospect only | low | patch | Comment: valid because filtered to one agent and day; entry 10 widens it |
| Non-deterministic order on equal visitedAt | low | patch | prospectId tie-break |
| `number` unbounded | low | patch | Named cap in request and response |
| isStopLeft test hard-codes open statuses | low | patch | Derived from OPEN_STATUSES |
| Client comment cites "entry 3" | low | patch | Cites ADR-0036 |
| Docs: Rules order, payload rule, api run-on, data-model blank line, budget line | low | patch | Fixed |
| Visit quarantined on a reassigned prospect leaves the stop `left` and out of Carnet | false | rejected | ADR-0022: the visit does not count until repaired; then it lands in `visits` and the stop reads visited |
| Stop on a merged-away prospect whose survivor the agent visited reads `left` | low | defer | deferred-work: entries 6/12 decide whether `left` follows `merged_into` |
| Response size and door-day reads on every drain pass | low | rejected | A day's door-days are bounded by what one agent visits; measured with the CPU item above |
| Ancient `startedAt` (0) makes stale-day rows | low | rejected | Never returned, harmless, no everyday path; would add a floor rule |
| Stops for an owned past-day tournée stored but not returned | false | rejected | Correct: yesterday's tournée is not today's |
| Two client prospect ids deduping to one stop | false | rejected | Unique (tournée, prospect) keeps one, both ids drained: the intended idempotency |
| Spec left half-filled (boxes, logs) | false | rejected | Spec edit; this log fills it |
| Intent: no phone producer/consumer, no admin read | false | rejected | Intent assigns both to entries 3, 10, 12 |
| Client test fixture duplication | low | rejected | Cosmetic; no named harm |

## Design Notes

- **Why stops for an unowned tournée are accepted and dropped:** the losing phone's outbox must drain (first swipe wins), and a stop can never be reattached later.
- **Order in the handler:** tournées first, then a lookup of `tournees.id` for the request's `tourneeId`s where `agent_email = email` (this also catches a T2 that lost on the unique (agent, day)), then stops. Unknown prospect ids are filtered with one chunked `prospects.id` lookup.
- **`left` needs today's visits:** compute `doorDaysOn` once in the pull and pass its prospect ids to `todayTournee`, so the reader runs once per sync.

## Verification

**Commands:**
- `pnpm db:generate` -- expected: one new migration, two `CREATE TABLE` plus indexes, nothing else.
- `pnpm typecheck && pnpm test` -- expected: green, including the new describe block.
- `pnpm lint && pnpm build && pnpm check:precache` -- expected: green.
