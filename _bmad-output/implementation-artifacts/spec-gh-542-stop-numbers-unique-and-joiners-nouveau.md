---
title: 'Stop numbers are unique in the database and joiners show « Nouveau » on any clock (#542)'
type: 'bugfix'
created: '2026-10-17'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '791bda41c443b4911138ec2aef5c6b16a11470db'
context:
  - '{project-root}/docs/glossary.md'
  - '{project-root}/.claude/skills/d1-migration/SKILL.md'
  - '{project-root}/.claude/skills/sync-contract-change/SKILL.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Retro action 3. `writeTournees` decides a number collision in memory, so two concurrent syncs can store two stops under one number (F3). A stop whose prospect never arrives is resent for ever (F4). « Nouveau » compares a phone time with a server-clamped time, so a phone clock ahead of the server loses the badge (F9). F5's drain needs a pinned test.

**Approach:** A unique `(tournee_id, number)` index in one migration; the insert's `onConflictDoNothing` decides, and the in-memory number/prospect check goes. A stop of the agent's own tournée whose prospect is unknown is accepted and not stored once that tournée's `day_start` is before today's Brussels day. « Nouveau » becomes an equality on phone-written values: a swipe writes each stop's `addedAt` equal to its `startedAt`, so a stop is a joiner when its client `addedAt` differs from the tournée's client `startedAt`. The sync response gains, additively, `tournee.clientStartedAt` and a server-derived `joiner` on each stop.

## Boundaries & Constraints

**Always:** Insert-only, idempotent (INVARIANTS 2, 4); `writeTournees` stays inside #540's try/catch. One migration from `pnpm db:generate`, no backfill (disposable stage). The joiner rule lives once, as a pure function in `src/shared/tournee.ts`, used by the server for pulled stops and by the client for queued ones. zod/mini only. Sync-contract-change skill steps 3–5 followed; field-operations Protocol updated.

**Never:** No `CLIENT_VERSION`/`MIN_CLIENT_VERSION` bump: the change is additive and old builds ignore the new fields. No Dexie version bump or cache clear (clearing the pulled tournée offline would bring the swipe gate back). No new request field. No quarantine table for stops (owner's decision 2026-10-17; ADR-0022 unchanged). No change to the admin round. No work from entry 5 (R13–R16).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Direct duplicate | raw insert of a 2nd stop, same tournée + number | D1 rejects | test expects the throw |
| Sequential collision | sync X as 3, then Y as 3 | both ids in `accepted.stops`, only X stored | none |
| Same-request collision | X as 2, Y as 2 in one request | both accepted, X stored | none |
| Unknown prospect, same day | own tournée, prospect missing | not accepted (waits) | none |
| Unknown prospect, day passed | same stop resent the next Brussels day | in `accepted.stops`, nothing stored | none |
| Unheld tournée (F5) | stop on another agent's tournée or an id never sent | accepted, nothing stored | none |
| Phone clock ahead | tournée `startedAt` clamped to serverTime; joiner `addedAt = serverTime` | pulled joiner `joiner: true`; snapshot stops `false` | none |
| Unsent swipe, queued joiner | outbox tournée (phone time) + joiner with `addedAt = serverTime` earlier | marked « Nouveau » | none |
| Snapshot rest still queued | >250-stop swipe, pulled tournée, queued stops with `addedAt === clientStartedAt` | not « Nouveau » | none |

</frozen-after-approval>

## Code Map

- `src/worker/db/schema.ts:192-222` `tourneeStops` -- add `uniqueIndex("tournee_stops_tournee_number_idx").on(t.tourneeId, t.number)`; reword the doc comment ("No unique (tournée, number)…").
- `src/worker/tournee.ts:27-146` `writeTournees` -- owned query (`:63-70`) also selects `dayStart`; a stop whose prospect is unknown waits only while `dayStart >= brusselsMidnightDaysFromNow(now, 0)`, else it is accepted and dropped. Delete the `numbers`/`prospectsHeld`/`touched` block (`:92-127`); insert `insertable` directly. SQLite's multi-row `INSERT … ON CONFLICT DO NOTHING` applies rows in order, so the first in the request still wins. Update the doc comment.
- `src/worker/tournee.ts:154-200` `todayTournee` -- select `tourneeStops.clientAddedAt`; return `clientStartedAt: tournee.clientStartedAt` and each stop's `joiner: isJoiner(r.clientAddedAt, tournee.clientStartedAt)`.
- `src/shared/tournee.ts` -- add `isJoiner(addedAt, startedAt)`: `addedAt !== startedAt`, comment naming why (StartScreen writes `addedAt: startedAt`, `StartScreen.tsx:76-89`).
- `src/shared/schemas.ts:720-738` -- `tourneeStopSchema` gains `joiner: z.boolean()`; `todayTourneeSchema` gains `clientStartedAt: epochMsSchema`. `PulledStop`/`PulledTournee` (`src/client/field/db.ts:53-54`) follow by type.
- `src/client/field/tournee-stops.ts` -- `DayStop` gains `joiner: boolean`; `DayStops.startedAt` stays. In `stopsOfToday`: pulled stops take their `joiner`; queued stops on a pulled tournée use `isJoiner(s.addedAt, pulled.clientStartedAt)`; on an own outbox tournée `isJoiner(s.addedAt, own.startedAt)`. `todaysStops:267` reads `stop.joiner`. `tourneeCounter`, `carnetEntries`, `appendJoiners` unchanged.
- `src/worker/sync.test.ts:1424+` -- helpers `tourneeOf`, `stopOf`, `swipe`, `sync`, `asOther`, `NOW` faked. Existing tests to keep green: `:1737` (holds back), `:1771` describe collisions, `:1859` (F5: already covers another agent's tournée and an unsent id — keep, assert it is not stored). Add: raw `getDb(env.DB).insert(tourneeStops)` duplicate number rejects; day-passed drain via `vi.setSystemTime(NOW + 86_400_000)`; `joiner`/`clientStartedAt` in the response with a phone clock 2 h ahead.
- `src/client/field/tournee-stops.test.ts:671` describe "leavers, joiners and the total" -- fixtures `pulledStop`, `queuedTournee`, `TODAY`; update fixtures for the new fields; add the phone-ahead, unsent-swipe and queued-snapshot-rest cases. `src/client/field/sync.test.ts` fixtures of pulled tournées need the new fields only where typecheck asks.
- `src/worker/db/indexes.test.ts` -- touch only if the new index breaks a plan assertion.
- Docs: `docs/data-model.md:67,233`, `docs/api.md:26`, `docs/domains/field-operations.md:18-19,191,195,200`. ADR-0036 › Numbers stays true ("the first stored keeps it").

## Tasks & Acceptance

**Execution:**
- [x] `src/worker/db/schema.ts` + `pnpm db:generate` -- unique index, one migration `drizzle/0018_*.sql` -- F3 at the boundary.
- [x] `src/shared/tournee.ts`, `src/shared/schemas.ts` -- `isJoiner`, additive response fields -- one rule, two sides.
- [x] `src/worker/tournee.ts` -- index decides collisions; day-passed drain; `joiner` + `clientStartedAt` in `todayTournee` -- F3, F4, F9.
- [x] `src/client/field/tournee-stops.ts` -- joiner from `DayStop.joiner` -- F9.
- [x] `src/worker/sync.test.ts`, `src/client/field/tournee-stops.test.ts` (+ fixtures elsewhere as typecheck needs) -- the matrix rows.
- [x] Docs listed in the Code Map -- the rules as shipped.

**Acceptance Criteria:**
- Given a fresh local state, when `pnpm db:migrate:local` runs, then 0001–0018 apply.
- Given the change, when lint, typecheck, test, build and check:precache run, then all pass with `CLIENT_VERSION` unchanged, and the PR quotes the precache total and closes #542.

## Implementation Notes

- Migration `drizzle/0018_skinny_tana_nile.sql`: one `CREATE UNIQUE INDEX`; 0001–0018 apply on a fresh `--persist-to` state.
- `writeTournees` lost its in-memory number/prospect check and one select per touched tournée; `onConflictDoNothing` over the two unique indexes decides.
- F5 was already pinned by `sync.test.ts` "accepts and drops a stop for a tournée that is not the agent's" (0 rows stored); left as is. `indexes.test.ts` untouched (no plan changed).
- The raw-insert test checks `error.cause` for UNIQUE: Drizzle wraps the D1 message as "Failed query: …".
- Precache: 25 entries, 967.79 KiB against 1,000 KiB (`check:precache`). `CLIENT_VERSION` unchanged.

## Spec Change Log

## Review Triage Log

Pass 1 (blind, edge-case, verification-gap on sonnet; intent-alignment on haiku). Verdicts: 0 high, 0 medium, 4 low, 13 false. Routed: 3 patch, the rest rejected.

| # | Lens | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|---|
| 1 | verification-gap | Queued-on-pulled client test has `startedAt === clientStartedAt`, so comparing with the clamped time would pass | low | patch | Test now uses a pulled tournée clamped 2 h below `clientStartedAt`, with a snapshot rest (false) and a queued joiner (true) |
| 2 | edge-case, blind | Raw-insert test's bare `rejects.toThrow()` | low | patch | Asserts the UNIQUE error; FK cannot fire (tournée and prospect seeded), but the message pins the cause |
| 3 | blind | Stray `). (` before the ADR link in `docs/api.md:26` | low | patch | Reworded |
| 4 | edge-case, blind | A day-passed stop is dropped before its late field prospect arrives | false | reject | Only stops of a tournée whose day is over are dropped; `todayTournee` and the admin round read today's tournée only, so such a stop could never be shown; the visit itself is untouched |
| 5 | blind, edge | Migration fails if production already holds duplicate numbers | low | reject | Disposable stage: the owner's fresh redeploy is the remedy (CLAUDE.md); the PR says so |
| 6 | blind, edge | Cached rows from before the update lack `joiner`/`clientStartedAt` | low | reject | Accepted in Design Notes; lasts until the first pull; a `??` fallback would guard a type the schema calls required |
| 7 | blind | New client against an old Worker fails zod | false | reject | Assets and Worker ship in one deploy; a page always talks to the Worker that served it |
| 8 | blind, intent | F5 test gains no "not stored" assertion | false | reject | `sync.test.ts:1859` already asserts `tourneeStops` has 0 rows for a foreign and an unsent tournée id |
| 9 | verification-gap, blind, intent | Collision rows not shown to assert storage or first-wins | false | reject | `:1772` asserts 3 rows stored and X kept; `:1807` asserts x at 2 and y absent from the tournée in one request |
| 10 | blind, intent | `dayStart === today` boundary untested | false | reject | `:1737` "holds back…" runs on the tournée's own day and asserts the stop is not accepted |
| 11 | edge-case | First-wins unpinned across chunk batches | false | reject | Batches are inserted sequentially in request order, so an earlier row is always stored first |
| 12 | edge-case | Future-dated tournée would wait for ever | false | reject | `startedAt` is clamped to `now`, so `dayStart` is never after today |
| 13 | edge-case, blind | Joiner stamped at exactly the swipe ms is missed | false | reject | Accepted in Design Notes; snapshot stops and joiners are written at different moments |
| 14 | edge-case, blind | `today` may be unused, failing lint | false | reject | `pnpm lint` passed; `today` still feeds the stop loop |
| 15 | blind | Other code may still compare `addedAt > startedAt` | false | reject | grep over src/client and docs: only `isJoiner` remains |
| 16 | intent | Client "phone ahead" test passes `joiner` through rather than deriving it | false | reject | Pulled stops carry the server's flag by design; the server test "derives joiner and clientStartedAt…" covers derivation with the clock 2 h ahead |
| 17 | blind | Spec committed unfinished | false | reject | The spec is completed before commit (step 5) |

## Design Notes

F9 settled: no comparison across clocks remains. A snapshot stop and its tournée carry one phone-written value; a joiner's `addedAt` is written later (`body.serverTime` in `appendJoiners`, or `Date.now()` with Ajouter), so it differs whichever clock wrote it. A coincidence to the millisecond is accepted. The server derives `joiner` like `left`; the client needs `clientStartedAt` only for stops still queued. Not breaking: old builds strip unknown keys; a new build's cached pulled rows from before the update lack the fields until the next pull, which only affects the badge for that window (disposable stage).

## Verification

**Commands:**
- `pnpm db:migrate:local` against a fresh `--persist-to` temp dir -- expected: 0001–0018 apply.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:precache` -- expected: all green; note the precache total.
