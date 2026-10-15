---
title: 'The counter counts arrêts from the server and the outbox (story 1.7, #503)'
type: 'feature'
created: '2026-10-15'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: 'fd3c0700ad6966b8eb1a97ef086656527e7d12a4'
context:
  - '{project-root}/docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-496-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tournée's line « {n} portes sur {total} aujourd'hui » counts prospects from `sentVisits`, a log kept only on the phone, unioned with the outbox. Any prospect visited today counts, in the tournée or not. A cache wipe resets `n` to 0 (the owner's « 0 sur 23 ») and `total` is not the tournée's. The header also repeats « {n} arrêts ».

**Approach:** Build `docs/design.md` › Next-stop card's counter « {n} sur {total} ». One pure helper joins the server's `visitedStops` with this identity's outbox visits by visit id into today's door-days, which Carnet (entry 8) reuses. `n` is the tournée's stops with a door-day today. `total` is the tournée's stops that are not `left` or have a door-day today. `useRound` computes both from its one snapshot. Delete `sentVisits`, `todaysSentVisits`, `dailyProgress` and their writers, and rewrite field-operations.md's counter section.

## Boundaries & Constraints

**Always:** Each stop is counted once, by its prospect: a second visit never moves `n`. `n ≤ total` by construction, since a visited stop is always in `total`. A door-day outside today's tournée never counts. Today is the one `stopsOfToday` uses (`brusselsPeriod(now, 1)` with useRound's `now`). "Mine" is `writtenByOrUnstamped`, and `unconfirmed` rows count. Dexie v6 drops `sentVisits` and touches no outbox table (invariant 5). The text shows `{n}` in `text-display` and « sur {total} » in semibold 18px, both `tnum`, then the existing bar. Its accessible name is « {n} arrêts faits sur {total} » (« {n} arrêt fait sur {total} » when n ≤ 1). The header's `remaining` line goes. Copy lives in `copy/field.ts`. Precache stays under 1,000 KiB, and the PR quotes the total.

**Never:** Carnet's screen or tab (entry 8), midnight (entry 9), admin figures (entries 10–12). No change to the server, the sync wire schema or `CLIENT_VERSION`. No counter on Carte.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| 15 of 20 | 20 stops; 15 with a door-day today (server or outbox) | « 15 sur 20 », bar 75 % |
| Second visit | stop 3 visited (server), new outbox visit on stop 3 | unchanged |
| Same visit, both sides | outbox visit id also in a `visitedStops.visitIds` | one door-day, counted once |
| Unsynced only | visit only in this identity's outbox | counts before any sync |
| Another identity | outbox visit `writtenBy` another agent | does not count |
| Yesterday | outbox visit or visited stop dated yesterday | does not count |
| Not in the tournée | door-day for a prospect with no stop | counts in neither `n` nor `total` |
| Reassigned unvisited | stop pulled `left`, no door-day | `total` − 1, `n` unchanged |
| Left after an outbox visit | stop pulled `left`, visit still in the outbox | stays in `n` and `total` |
| Joiner | stop 21 joined | `total` + 1 |
| Cache wipe | outbox and tables empty, then a sync pulls 15 visited stops | « 15 sur 20 » again |
| Right after the swipe | 20 stops, no visit | « 0 sur 20 » |
| `total` 0 | no stops, or all left unvisited | no counter (AllDoneCard shows `nothingLeft`) |

</frozen-after-approval>

## Code Map

- `src/client/field/tournee-stops.ts` -- add `doorDaysToday({ visitedStops, outboxVisits, identity, period })` → `Map<prospectId, DoorDay>`, with `DoorDay = { prospectId, visitIds: string[], outcome, visitedAt, pending }`. It merges by visit id, and the latest `visitedAt` gives `outcome`. `pending` means an outbox visit id the server has not listed. Carnet will read it. `visitedTodayIds` becomes its key set, or is replaced by it. Replace `tourneeTotal` with `tourneeCounter(input)` → `{ n, total }` over `stopsOfToday` and `doorDaysToday` (distinct prospect ids). `todaysStops` keeps its output.
- `src/client/field/progress.ts` -- delete it with its test, or keep only `DailyProgressValue` (`{ n, total, percent }`) built from `tourneeCounter`. Do not keep two counters.
- `src/client/field/useRound.ts` -- expose `progress: { n, total, percent }` beside `total` (the AllDoneCard keeps reading `total`). Drop `outboxVisits` from `RoundState` if nothing else reads it (only `TodayScreen.tsx:33` does).
- `src/client/field/TodayScreen.tsx` -- drop the `todaysSentVisits` live query, `dailyProgress` and the `remaining` header line. Pass `progress` to `DailyProgress`.
- `src/client/field/DailyProgress.tsx` + test -- the two-size text and the bar named `copy.today.progressLabel(n, total)`. Keep `total === 0` → `null`.
- `src/client/copy/field.ts:51-59` -- `progress` becomes « sur {total} » (or n and total split as the markup needs), `progressLabel(n, total)` is « {n} arrêts faits sur {total} » / « {n} arrêt fait sur {total} ». Delete `remaining` after a grep.
- `src/client/field/db.ts` -- delete `SentVisit`, the `sentVisits` table property, `todaysSentVisits`, `dayStart` if unused, and the log `put` and prune in `queueVisit`, which becomes one `outboxVisits.add`. Remove it from `clearAgentCache`, `confirmOutbox` and `releaseUnconfirmed`. Add `this.version(6).stores({ sentVisits: null })` with a comment like v2/v4's: it drops a table and touches no outbox row. Fix the doc comments at `:56-69`, `:322-341` and `:410-414`.
- `src/client/field/outbox-stamp.ts:29` -- comment names `tourneeCounter`, not `dailyProgress`.
- Tests that touch `sentVisits`: `db.test.ts` (drop the log tests, and keep a v5→v6 upgrade test that the outbox and tournée tables survive), `sync.test.ts:224,247`, `VisitScreen.test.tsx:240,1020-1254`, `TodayScreen.test.tsx:96,304`, `AddProspectScreen.test.tsx:82`. Add a `tournee-stops.test.ts` case for each matrix row, and add TodayScreen cases for « 15 sur 20 » and the cache wipe, seeded with `seedPulledTournee` (`tournee-test-helpers.ts`).
- Docs: `docs/domains/field-operations.md:84-122` -- drop the `sentVisits` row and rewrite the "{n} portes" section as the counter: the door-day join, `n`, `total`, the identity and day rules. Also update line 90 ("in later stories"). In `docs/domains/identity-access.md:173,186-192`, drop the `sentVisits` mentions. Leave the ADR and `docs/backlog/013` as history.

## Tasks & Acceptance

**Execution:**
- [x] `tournee-stops.ts` + test -- `doorDaysToday`, `tourneeCounter`, the matrix -- R7.
- [x] `useRound.ts`, `TodayScreen.tsx`, `DailyProgress.tsx`, `copy/field.ts`, `progress.ts` + tests -- counter UI -- R7.
- [x] `db.ts`, `outbox-stamp.ts` + the tests that touch `sentVisits` -- delete the log, Dexie v6 -- R7.
- [x] `field-operations.md`, `identity-access.md` -- R16.

**Acceptance Criteria:**
- Given a pulled tournée of 20 stops and 15 pulled visited stops, when Tournée renders, then it shows « 15 » and « sur 20 », the bar is named « 15 arrêts faits sur 20 », and no « portes » or « {n} arrêts » line remains.
- Given that state, when a visit to stop 3 is queued, then the counter still reads 15 sur 20. When stop 16's first visit is queued, it reads 16 sur 20.
- Given a v5 database with outbox visits and `sentVisits` rows, when v6 opens it, then every outbox row survives and the `sentVisits` table is gone.

## Implementation Notes

- A Sonnet `pwa-engineer` subagent implemented this from the spec, and then the main session read the diff.
- `copy.today.remaining` stays because `StartScreen.tsx:90` still reads it. Only Tournée's header line is gone. The counter's text is `progressOf(total)` (« sur {total} »), beside `{n}`.
- `progress.ts` and its test are deleted. `RoundProgress` lives in `tournee-stops.ts`, and `useRound` computes `percent`.
- No 18px token exists in `@theme`, so « sur {total} » uses Tailwind's `text-lg` (1.125rem).
- Verification: typecheck, lint and build are green, with 2888/2888 tests passing. `check:precache` reads 23 entries and 999.40 KiB of 1,000 KiB, down from 999.81 KiB. Every matrix row has a test in `tournee-stops.test.ts`, and the screen-level ones are in `TodayScreen.test.tsx`.

- Review pass 1 patches, by the same subagent: `tourneeCounter` returns `RoundProgress` with `percent` (a new 2-of-3 → 67 case), the counter's visible text is `aria-hidden` so the bar's label is its one accessible name, and two stale references are fixed. After the patches, typecheck, lint and build are green, with 2889/2889 tests passing and `check:precache` at 999.39 KiB.

## Spec Change Log

## Review Triage Log

### Pass 1

Lenses: blind-hunter and verification-gap ran on Sonnet (the owner asked for Sonnet on routine work), and edge-case-hunter and intent-alignment on the session's model. duplication-map was skipped because this is not a refactor sweep. A usage limit cut off the first launch of three lenses, and they were relaunched on the same diff.

Counts: high 0 · medium 0 · low 16 · false 6 · maybe-false 0. Routes: patch 4 · defer 0 · rejected 17 · noted 3.

| Finding | Verdict | Route | Evidence / action |
|---|---|---|---|
| `percent` rounding and its zero guard lost their test with `progress.test.ts`; `RoundProgress` is half-owned by `tournee-stops.ts` (verification-gap, blind) | low | patch | Pre-verified. `tourneeCounter` returns `RoundProgress`, with a 2-of-3 → 67 case |
| `copy/field.ts:164` comment cites the deleted `today.progress` (edge) | low | patch | Direct correction |
| field-operations.md:15 says the counter section is "above"; it is below, at :95 (blind) | low | patch | Direct correction |
| The visible text and the bar's label read the count twice to a screen reader (blind) | low | patch | design.md › Next-stop card gives the counter one accessible name. `aria-hidden` on the text |
| The counter now bounds today with useRound's stale `now`, not `Date.now()`, so an offline phone past midnight counts nothing (blind, intent D) | low | rejected | The frozen Always names useRound's `now`, and `useTourneeGate.ts:38` and `todaysStops` use the same clock, so the list, the gate and the counter agree. Midnight is entry 9's (Never). Raised in the PR |
| `RoundState.total` and `progress.total` can drift (blind) | false | rejected | `useRound` sets `total: progress.total` from the one memo |
| Bar reads 100 % at 199 of 200, or 0 % at 1 of 201 (edge) | low | rejected | A tournée is tens of stops. The text shows the real figures, and the fix adds clamping branches |
| `TodayScreen` revisit test adds both visits before asserting (edge) | false | rejected | A revisit that moved `n` would make the last assertion read 17, not 16, and fail |
| Dropped tests: DST fall-back, clock-ahead `sentAt`, period edges, a real `VisitScreen` save (blind) | low | rejected | They covered `todaysSentVisits`' `sentAt` bounds, which are deleted. `brusselsPeriod` has its own tests. The queue → counter path is the `outboxVisits.add` screen tests |
| `doorDaysToday`'s tie-break and reverse order are untested (blind, verification-gap other) | low | rejected | Nothing reads `outcome` until Carnet (entry 8), whose tests own it |
| `text-lg` is not an `@theme` token (blind) | low | rejected | No 18px token exists. `text-lg` is the default scale, not a hardcoded value (Implementation Notes). Raised in the PR |
| `DailyProgress.test` `getByText("2")` and className asserts are fragile; there is no total-0 case (blind) | false | rejected | The component renders alone, so "2" is unique, and `DailyProgress.test.tsx:12` keeps the total-0 null case. className asserts are the file's existing practice |
| field-operations.md drops the "doors, not visits" and the "differs from admin" notes (blind) | low | rejected | The door-day definition replaces both, and entry 10 makes admin count door-days too |
| design.md:2344 "the same `queueVisit` the counter reads" not rechecked (blind) | false | rejected | Still true: `queueVisit` writes the outbox row that `doorDaysToday` reads |
| Spec artifact stale or incomplete (blind) | false | rejected | Its fix edits this build's spec; logs are filled at this step |
| v5→v6 with an old tab holding the v5 connection (blind) | low | rejected | Dexie closes a connection on `versionchange` by default, and v6 touches no outbox row either way |
| The counter and the list derive the stops and door-days separately (blind) | low | rejected | Both call the same `stopsOfToday` and `doorDaysToday`. Tens of rows; no measured cost |
| `tourneeCounter`'s duplicate-stop comment is untested (blind) | low | rejected | `tournee_stops` is unique per tournée and prospect, and `stopsOfToday` skips a queued stop the pull holds, so duplicates cannot reach it |
| Empty-round test checks for no `progressbar` rather than the named bar (blind) | low | rejected | The test awaits `nothingLeft` first, so the screen rendered |
| `DoorDay` lacks Carnet's name, type, address and flyer (intent A) | low | rejected | Fields arrive with their reader in entry 8 (Never: Carnet's screen). Its keys and merge rule are the shared part |
| Cache-wipe screen test seeds tables and never wipes or syncs (intent) | — | noted | `sync.test.ts:972` covers the pull writing `visitedStops`; the end-to-end wipe is the manual check in the PR |
| No screen-level test of an off-tournée door-day (intent) | — | noted | Pure case "a door-day with no stop counts in neither" covers it |
| `total` now keeps a `left` stop with a door-day (verification-gap other) | — | noted | Intended (frozen Always: `n ≤ total`). The all-done card then reads « Tous les arrêts sont faits. », as design.md says |

## Design Notes

The counter takes useRound's deliberately stale `now`, not `Date.now()`, so `n` and the list read the same tournée and the same day. A stale day is entry 9's to fix. Joining by visit id matters to Carnet's « {2} visites » and « Pas encore envoyé ». For the counter, a set of prospect ids would be enough, but one helper serves both.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test` -- expected: green.
- `pnpm lint && pnpm build && pnpm check:precache` -- expected: green, under 1,000 KiB (999.81 KiB before).

**Manual checks:**
- `pnpm dev`: swipe, then save three visits, one of them a second visit. The counter reads « 2 sur N ». Clear site data, sign in and sync: the same counter.
