---
title: 'The tests pin the door-day readers, the wire schemas and the outbox drain (#543)'
type: 'chore'
created: '2026-10-17'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '005534e899568a0343c7f1695c9bc773a1f55a51'
context:
  - '{project-root}/docs/glossary.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Retro action 4 (F11–F15). The three door-day readers are never compared on one dataset, and `doorDaysOn`, `writeTournees` and `todayTournee` have no DST-day tests. No Worker test parses a response with its zod schema. `indexes.test.ts` plans stale hand-copied SQL. Six client tests do not pin what they claim, among them the partial-accept drain, which is invariant 5.

**Approach:** Tests only. Use #540's fixed clock (`vi.useFakeTimers({ toFake: ["Date"] })` + `setSystemTime`). In `indexes.test.ts`, record the statements the real routes prepare, with their bound values, and plan those, as `admin.test.ts` already does for `doorDaysTouched`. No production code changes, so nothing needs exporting.

## Boundaries & Constraints

**Always:** Tests only, under `src/worker/**` and `src/client/**`. Every new Worker test about "today" fixes `Date`. Dexie stays on real timers. Copy and labels come from `copy` modules and are never inlined. Each of the three hand mutations fails at least one test.

**Never:** No production code change. No new dependency. No `.toSQL()` refactor or exported SQL builders. F17 and the retro's unverified findings stay out.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Parity | One seed of visits across 2026-03-29 and 2026-10-25, with a `visited_at` tie | `doorDaysBetween`, `doorDaysOn` (per agent, per day) and `doorDaysTouched` give the same set of (agent, prospect, day, latest outcome) | — |
| Long DST day | A visit at 23:30 on 2026-10-25 (a 25 h day) | `doorDaysOn(dayStart of the 25th)` includes it | Fails under `dayStart + DAY_MS` |
| Short DST day | A visit at 00:30 on 2026-03-30 | `doorDaysOn(dayStart of the 29th)` excludes it | Fails under `dayStart + DAY_MS` |
| Tournée on a DST day | `Date` faked to late on 2026-10-25 and on 2026-03-29, then a swipe is synced | The tournée is stored with that day's `dayStart`, and the next sync's `tournee` is it | — |
| Partial accept | 3 stops sent, `accepted.stops` lists 1 | 2 stops stay in `outboxStops` | Fails under "delete all sent" |
| Schema parse | sync, admin visits, admin round responses | `schema.parse(body)` succeeds | Fails when `serverTime` is dropped |

</frozen-after-approval>

## Code Map

- `src/worker/door-days.ts` -- `doorDaysBetween({from,to,dayKey})` :37 is a SQL fragment, run as `db.all(sql\`select … from (${doorDaysBetween(range)})\`)` (see `dashboard.test.ts:1281`). `doorDaysOn(db,{dayStart,agentEmail})` :78 has its day bound at :103. `doorDaysTouched(db,{since,limit,…})` :164.
- `src/worker/tournee.ts` -- `writeTournees` :28 (day at :46, :90), `todayTournee` :129 (:141). Both are reached through POST `/api/agent/sync`.
- `src/worker/dashboard.test.ts` -- the fixed-clock pattern :116-130, `seedProspect` :52, `seedVisits` :79, and the DST `it.each` at ~:520.
- `src/worker/sync.test.ts` -- describe "tournée at sync (ADR-0036)" :1424, with its noon `NOW`, `tourneeOf`, `stopOf`, `bodyOf` :1464 and `sync()` :48. The DST tests for writeTournees/todayTournee go here. Responses are cast to `SyncResponse` (:194): parse them with `syncResponseSchema` and also check `body.tournee` with `todayTourneeSchema`.
- `src/worker/admin.test.ts` -- `feed()` :1813 casts to `AdminVisitsResponse`; parse with `adminVisitsResponseSchema`. The round read at :2287 gets `agentRoundResponseSchema`. The recording `Proxy` over `env.DB` is at :2134-2160.
- `src/worker/db/indexes.test.ts` -- replace the hand-copied SQL (:35 conversionCounts, :63 visitsByDay, :87 agentsStartedOn). Use a recording proxy that also records `bind(...)` values, drive GET `/api/admin/dashboard` (conversionCounts, visitsByDay in `routes/admin.ts:580,666`) and the sync or round route for `agentsStartedOn` (`tournee.ts:188`), then `EXPLAIN QUERY PLAN` each recorded statement with its own bindings. Keep the asserted indexes: `visits_visited_idx`, `prospects_status_idx`, `tournees_agent_day_started_idx`, and no `SCAN visits` / `SCAN tournees`. Adjust them only if the real plan differs, and note the change. Index names are in `schema.ts:156-211`.
- `src/client/field/sync.ts:268-273` -- the drain. `sync.test.ts` describe "runSync — the swipe's outbox" ~842 has `okResponse`, `respondWith`, `day()`, `startTournee` and `acceptingServer`.
- `src/client/field/outbox-stamp.ts:48` -- `sendableBy`, which holds back a row stamped `unconfirmed`.
- `src/client/field/TodayScreen.test.tsx` ~339 and ~359, `CarnetScreen.test.tsx` ~254 and ~278, `App.test.tsx` ~529, `RoundMap.test.tsx` -- F15 items 3–6. The helpers are `tournee-test-helpers.ts` (`clearTourneeTables`, `seedPulledTournee`, `TOURNEE_NOW`) and `runSync({db: fieldDb, identity, fetchFn, now})`.

## Tasks & Acceptance

**Execution:**
- [x] `src/worker/door-days.test.ts` (new) -- parity test plus the two `doorDaysOn` DST tests, with a fixed clock -- F11, F14
- [x] `src/worker/sync.test.ts` -- DST-day `writeTournees`/`todayTournee` tests in the tournée describe. Parse sync responses with `syncResponseSchema` and `todayTourneeSchema` via `bodyOf`/the shared read -- F12, F14
- [x] `src/worker/admin.test.ts` -- `feed()` parses with `adminVisitsResponseSchema`, and the round test parses with `agentRoundResponseSchema` -- F12
- [x] `src/worker/db/indexes.test.ts` -- plan the recorded real statements -- F13
- [x] `src/client/field/sync.test.ts` -- (1) partial-accept drain: 3 stops sent, 1 listed, 2 remain, and an unlisted tournée stays; (2) a confirmed tournée with stops stamped `unconfirmed`: the request carries the tournée, `stops: []`, and the stops stay -- F15.1, F15.2
- [x] `src/client/field/TodayScreen.test.tsx`, `CarnetScreen.test.tsx` -- assert the rendered counter unchanged after a repeat visit before any new visit lands. The cache-wipe tests clear Dexie and run a real `runSync` against a stub response -- F15.3, F15.4
- [x] `src/client/App.test.tsx` -- the midnight test proves the visit row exists by the time the start screen shows -- F15.5
- [x] `src/client/field/RoundMap.test.tsx` -- pins numbered 4 and 7 render "4" and "7", not "1"/"2" -- F15.6

**Acceptance Criteria:**
- Given the suite, when `pnpm test` runs, then it passes, including with `Date` faked to 00:30 Brussels in the new Worker tests' clock.
- Given each mutation applied by hand in turn (the drain deletes every sent stop; `doorDaysOn`'s bound becomes `dayStart + DAY_MS`; `serverTime` is removed from the sync response), when `pnpm test` runs, then at least one new test fails, and the mutation is reverted.

## Implementation Notes

- Tests only; no production file changed. One route (`GET /api/admin/dashboard?period=90`) prepares all three planned statements (conversionCounts, visitsByDay, agentsStartedOn), so `indexes.test.ts` records that one request instead of driving sync or the round.
- The standalone `visits(visited_at)` range-count plan was dropped with the hand-copied SQL: no reader runs that statement, and `visits_visited_idx` stays asserted on the recorded Convertis and Visites dans le temps statements.
- The parity test passes its own `dayKey` to `doorDaysBetween`: the dashboard's `periodDays` allows one clock change per period, and the parity seed crosses both. The production `dayKey` stays pinned by the dashboard DST tests.
- `feed()` in `admin.test.ts` lets the 1970-01-01 Brussels day (`dayStart` −1 h) through the schema; many feed fixtures sit in the epoch's first hours. Every other value is parsed as served.
- TodayScreen: the repeat visit and a first visit land in one `bulkAdd`, so the counter must read 16 and not 17 (replaces a 50 ms wait).
- Mutations, each applied and reverted: drain deletes every sent stop → the partial-accept test fails; `doorDaysOn` bound `dayStart + DAY_MS` → the three `door-days.test.ts` tests fail; `serverTime` dropped → the sync schema parses fail.

## Spec Change Log

## Review Triage Log

Pass 1 (blind-hunter, edge-case-hunter, verification-gap, intent-alignment; sonnet): high 0, medium 1, low 2, false 9, rejected-low 6.
- medium, patch — `admin.test.ts` `feed()` clamped every `dayStart` before the parse, hiding a negative one. Fixed: only the 1970-01-01 day is let through.
- low, patch — client partial-accept test fell back to `""` for a missing stop. Fixed: throws if the seed has no stop.
- low, note — the `visits(visited_at)` range test was removed. Recorded in the Implementation Notes; coverage stays on the recorded statements.
- false — parity test's own `dayKey`: production's `periodDays` cannot span both clock changes. The `dayKey` is the caller's and is pinned by the dashboard DST tests.
- false — `indexes.test.ts` auth: the suite passes; the dev admin answers.
- false — DST `it.each` leaks `setSystemTime`: the describe's `beforeEach` resets `NOW`.
- false — `toEqual([tournee])` stamp leak: the existing test at :843 pins "never the stamp", and this one passes.
- false — TodayScreen 17-check vacuous: a counter of visits shows 17 and never 16, so `findBy(16)` fails.
- false — Carnet `renderedCounter` null equality: `findByLabelText(progressLabel(2,3))` must resolve first.
- false — `wipeAndPull` in the prod bundle: imported only by tests.
- false — single-`bind` recording: each recorded statement is bound once on the dashboard path.
- false — schema parse of the dashboard: not among F12's four schemas.
- rejected low — regex matching on Drizzle text, `doorDaysTouched` non-zero `since`/truncation (pinned in `admin.test.ts`), a round helper, the `text` naming, the App midnight read order (already after the screen, not before), and the hardcoded agent email.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all green
- the three mutations, applied and reverted one at a time -- expected: each fails a named test
