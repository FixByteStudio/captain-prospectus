---
title: 'Finish R15 and clear the day-boundary test residue (#638, CAP-18)'
type: 'chore'
created: '2026-10-26'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
baseline_commit: 'b05647e78b201f7d2e6e9efba8da8f8aee445f3e'
context:
  - '{project-root}/_bmad-output/specs/spec-retro-follow-ups-2026-10/slices.md'
  - '{project-root}/docs/domains/field-operations.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic #538's retro (538/6, N8, N11, N12, N13) left tests that plan hand-typed SQL, a parity test that builds its own day key, position tests on the real clock, five small test gaps and an unmeasured `doorDayCounts`.

**Approach:** Tests and one script, no behaviour change. Every CAP-18 line ends ticked with its test, or struck with a reason, in the PR.

## Boundaries & Constraints

**Always:** Plan the SQL the code prepared and the values it bound (the `recordingDb` of `src/worker/db/indexes.test.ts`), never a copy. Every test that reads "today" fakes `Date`. `docs/free-tier-budget.md` gets the measured row (invariant 13). Conventions of CLAUDE.md hold (named exports, no `any`).

**Decision (2026-10-26, #636 is not merged):** plan the feed's seed and tie reads as they stand on `main`; #636's PR updates those tests with its change, and this PR says so.

**Never:** Change a route, query, schema, wire contract or version. Fix a bug found on the way here: open a `found-in-passing` issue. Touch `door-days.ts` or `tournee.ts` logic. Merge.

</frozen-after-approval>

## Code Map

- `src/worker/db/indexes.test.ts` -- `recordingDb`, `planOf`, `only`, `scans`: the harness to reuse; today it plans only the dashboard. Move the helpers to `test/` if a second file needs them.
- `src/worker/tournee.ts` -- `writeTournees` (`owned`, `known` lookups), `todayTournee` (tournée read, stops read); `src/worker/door-days.ts` -- `doorDaysOn`, `doorDayCounts`, `doorDaysTouched` (seed read when `since=0`, tie read at a truncated cut).
- `src/worker/routes/agent.ts` (POST sync) runs `writeTournees`, `doorDaysOn`, `todayTournee`; `routes/admin.ts` `GET /prospects/duplicates` runs `doorDayCounts`, `GET /visits` runs `doorDaysTouched`. Plan them by calling these routes.
- `src/worker/admin.test.ts:2174-2230` -- the two hand-typed `.bind(...)` plans (`json_each` read, delta poll) to replace; `:2277-2400` round tests (`swipe` helper seeds `clientStartedAt == startedAt`).
- `src/worker/routes/admin.ts:546-572` -- `dayIndexer`, `periodDays`, `twoPeriodsDayKey` are module-private: export `twoPeriodsDayKey` and `periodDays` (the only source change) so the parity test uses them. A key `k` maps back to `brusselsMidnightDaysFromNow(from, k)`.
- `src/worker/door-days.test.ts:89-140` -- parity test with its own `dayKey` (`:121-125`); add the within-an-hour visits and a `doorDayCounts` leg and DST case (`doorDaysOn` clock-change tests at `:217`).
- `src/worker/sync.test.ts:1454,1461,1487,1532` -- position tests on the real clock; the tournée block `:1556-1572` shows the pattern (fake `Date` at noon). R3's trigger test at `:1652`; stop-number bound at `:2175`; `TOURNEE_STOP_NUMBER_MAX` and `tourneeStopNumberSchema` (`z.positive()`, `src/shared/schemas.ts:614`).
- `src/client/field/sync.test.ts` (helpers `day`, `okResponse`, `respondWith`, `acceptingServer`), `src/client/field/sync.ts:295` `appendJoiners(db, identity, body.serverTime)`, `db.ts:219`, `src/shared/tournee.ts` `isJoiner`.
- `scripts/worker-cpu-shim.mjs`, `measure-dashboard-cpu.mjs` -- the measuring pattern; `docs/free-tier-budget.md` (CPU entries, "Watch-outs").

## Tasks & Acceptance

**Execution:**
- [x] `src/worker/db/indexes.test.ts` (+ a shared helper if needed) -- plan `todayTournee`'s two reads, the `owned` and `known` lookups, `doorDaysOn` (via sync with a tournée and stops) and `doorDayCounts` (via duplicates with a seeded pair), and the feed's seed and tie reads; assert the index named and no `SCAN` of `visits`, `tournees`, `tournee_stops` or `prospects` -- R15, N12
- [x] `src/worker/admin.test.ts` -- replace the hand binds at `:2201` and `:2227` with the recorded statement and binds; add the admin-round test with both clocks ahead (two swipes whose `clientStartedAt` is later than the clamped `startedAt`, the earlier client time wins) -- N12, V6
- [x] `src/worker/routes/admin.ts` -- export `twoPeriodsDayKey`, `periodDays` -- the parity test needs the production builders
- [x] `src/worker/door-days.test.ts` -- parity day key from `twoPeriodsDayKey` / `days.dayOf`; a visit within an hour either side of each clock switch; a `doorDayCounts` DST case and parity leg -- V4
- [x] `src/worker/sync.test.ts` -- fake `Date` at noon in the position block; stop `number: 0` and a negative number give 400; a trigger that aborts the `tournee_stops` insert gives 200, visits and tournée accepted, no stop id listed, resend lands -- N11, V8, R3
- [x] `src/client/field/sync.test.ts` -- `runSync` with a pulled tournée whose `clientStartedAt` is ahead of `serverTime` and a new prospect: the appended stop has `addedAt === serverTime` and reads as a joiner -- V5
- [x] `scripts/measure-duplicates-cpu.mjs`, `docs/free-tier-budget.md` -- measure `GET /api/admin/prospects/duplicates` with 100 seeded pairs, with and without visits, so `doorDayCounts` is the difference; add the row with the figures, date, hardware, and the command -- N8, invariant 13

**Acceptance Criteria:**
- Given any CAP-18 line, when the PR is read, then it is ticked with its test's name or struck with a reason.
- Given each new test, when its subject is broken (an index dropped, `Intl` day replaced by `/ DAY_MS`, `serverTime` replaced by a phone clock), then the test fails.
- Given `pnpm typecheck`, `pnpm test`, `pnpm lint` and `pnpm build`, when run, then all pass, and the position tests also pass with `Date` at 00:30 Brussels.

## Implementation Notes

- Shared plan helpers moved to `test/query-plan.ts`; plans run through the real routes (sync, duplicates, feed), so no SQL builder was exported. Only `twoPeriodsDayKey` and `periodDays` gained `export`.
- The aborted `tournee_stops` insert: the code (`agent.ts` step 3b, `field-operations.md`) lists none of the request's tournées or stops in `accepted`, so the test asserts the tournée row stored, nothing listed, the visit accepted, and the resend landing. The task line's "tournée accepted" was inexact.
- `measure-duplicates-cpu.mjs`: `doorDayCounts` costs 0.9-1.05 ms warm for 200 prospects and 800 visits; the route's cold first request is over 10 ms locally with no visit, filed as #652.
- Feed seed and tie tests pin `main` as it is; #636 (not merged) updates them.

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: 1 high, 3 low patched, rest rejected.

| Verdict | Route | Finding and evidence |
|---|---|---|
| high | patch | New V5 joiner test orders stops by random stop id (`stopsOfToday` keeps Dexie order); the full run failed on it. Sorted by `number`. |
| low | patch | `p4`/`p5` within-an-hour visits sit at 02:00-04:00 Brussels, far from midnight, so they cannot fail on a day boundary (p1/p2 do). Comment and test name now say what they pin. |
| low | patch | `indexes.test.ts` repeated the delta poll and `json_each` plans that `admin.test.ts` now owns. Removed the copies. |
| low | patch | Feed seed/tie tests carry no note that #636 will change them. Added. |
| false | reject | Spec says tournée accepted on an aborted stops insert; test says not. Code and `field-operations.md` list none of the request's tournées and stops, so the test is right (see Implementation Notes). |
| false | reject | 00:30 criterion unchecked: the position block now fakes noon, so the real clock cannot reach it. |
| low | reject | Script: exit code ignores the cold figure, `VISITS` above ~10 crosses midnight, `body.pairs?.length`, hardcoded `client_version`. Dev-script knobs; a guard each is more than the defect. |
| low | reject | Regex and autoindex-name brittleness, single-pair fixture, sloppy seed rows, 1.5 stop number, positional `clientStartedAt`. Not met in everyday use; fixes add complexity. |
| false | reject | Route module imported by a test for two exports: the spec chose this. |

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: all pass
- `node scripts/measure-duplicates-cpu.mjs` (after `pnpm db:migrate:local`) -- expected: prints the figures the budget row quotes
