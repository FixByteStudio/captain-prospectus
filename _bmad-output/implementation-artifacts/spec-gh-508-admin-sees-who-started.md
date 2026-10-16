---
title: 'The admin sees who started and the phone''s numbers (story 1.12, #508)'
type: 'feature'
created: '2026-10-16'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '67f1dbae7acdbd8d8e194a7837443c4ae97e9a07'
context:
  - '{project-root}/docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-496-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** « Agents en tournée » and the recap card's « actifs aujourd'hui » count agents who sent a visit today, so an agent who swiped but has not visited yet is invisible. The admin round view still orders open prospects with `buildTodayList` from the stored reading, so its numbers differ from the phone's Tournée and Carte (ADR-0036 R14, R15).

**Approach:** Both figures count roster members with a `tournees` row for today's Brussels day, through one Worker helper. `GET /api/admin/agents/:email/round` returns today's tournée stops with their swipe numbers, leaving out those `isStopLeft` marks. The admin view renders them through `round-map.ts` exactly as Carte does. The stored reading only places the marker and the distances. `src/shared/today.ts` (`buildTodayList`) loses its last caller and goes.

## Boundaries & Constraints

**Always:** « Started today » = a `tournees` row whose `day_start` is today's Brussels midnight; the swipe alone counts, with no visit needed. One helper serves both figures, so they are the same figure (ADR-0036). It is served by `tournees_agent_day_idx` through an `EXISTS` per active `users` row, never a scan of `tournees`. `left` comes from the one `isStopLeft` via `todayTournee` (story 1.2), with today's door-days from `doorDaysOn`. Stops arrive in number order; gaps stay gaps and nothing renumbers. The next (gold) pin is the lowest number, and the path runs in number order, whether or not a position exists. Copy lives in `copy/admin.ts`. ≤100 bound params per statement.

**Decisions (owner, 2026-10-16):** (1) The round lists only the stops still to do: no visit today and not `left`, as the phone's Tournée and Carte do. The header counts them. (2) Before the swipe, the view shows « {email} n'a pas encore commencé sa tournée aujourd'hui. », with no rows and the map holding the position marker only.

**Never:** No migration or new index, sync contract change, `CLIENT_VERSION` bump, or field-app change. No « Nouveau » badge or counter on the admin view. No polling of the round. No fallback to open prospects before the swipe.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Swiped, no visit | A swiped today, sent nothing | `agentsActiveToday` 1, recap `activeAgents` 1 |
| Visit, no swipe | B sent visits today, no tournée | B counts in neither |
| Yesterday's tournée | C's tournée has `day_start` of yesterday | not counted |
| Off roster | a deactivated user's tournée today | counted in neither |
| Numbers | stops 1–5; 2 visited today, 4 reassigned | round lists 1, 3, 5 with those numbers; pins 1 (gold), 3, 5 |
| No swipe yet | agent has assigned prospects, no tournée | `tournee: null`; the screen shows the not-started message, no rows, and the map with the position marker only |
| All done | every stop visited or left | `tournee` with `stops: []`; the empty message |

</frozen-after-approval>

## Code Map

- `src/worker/tournee.ts` -- add `agentsStartedOn(db, dayStart)`: `count(*) from users where active = 1 and exists (select 1 from tournees where agent_email = users.email and day_start = ?)`. Reuse `todayTournee` unchanged.
- `src/worker/routes/admin.ts:205-247` (recap) -- `activeAgents` = `agentsStartedOn`. Visits still give `visitsToday` and `lastReceivedAt`. Drop the off-roster filter comment and reword the "two statements" doc comment (now three).
- `src/worker/routes/admin.ts:373-378` (dashboard) -- replace the visits read with `agentsStartedOn(db, todayStart)`.
- `src/worker/routes/admin.ts:173-183` (round) -- run `openAssignedProspects`, `doorDaysOn({dayStart, agentEmail})` and `readAgentPosition` together, then `todayTournee(db, email, now, visitedIds)`. Keep stops that are not `left` and have no door-day, joined to their prospect from the open-assigned map (skip one that is missing). Keep `no-store`, the 404 and the 400.
- `src/shared/schemas.ts:624-629` -- `agentRoundResponseSchema` = `{ tournee: nullable({ startedAt, stops: [{ number, prospect: prospectSchema }] }), position }`. Fix the doc comments at `:540` and `:1022`.
- `src/client/admin/round/round-list.ts` -- `roundStops(data)` maps stops to a row item `{ ...prospect fields, number, distanceM }` (distance from the position, or null). `roundMap(stops, position)` = `mapPins` / `walkingPath` as `CarteScreen.tsx:133` does, with `point` = position. No name sort.
- `src/client/admin/round/RoundScreen.tsx` -- rows show `stop.number`. Not-started state; the no-position notice drops "triée par nom". Count = rows. Row type comes from round-list, not `TodayItem`.
- `src/shared/today.ts`, `src/shared/today.test.ts` -- delete. `src/client/field/today.ts:5,15` -- `navigationUrl` takes `{lat, lng, name}` without importing `TodayItem`.
- `src/client/copy/admin.ts:737-749` -- `notStarted(email)`, and the shorter `noPosition`.
- Tests: `src/worker/recap.test.ts`, `src/worker/dashboard.test.ts:987-1007`, `src/worker/admin.test.ts:114-146,2136-2246` (the matrix; seed `tournees` / `tournee_stops` rows directly), `src/client/admin/round/round-list.test.ts`, `RoundScreen.test.tsx`. Update the mocks in `AdminApp.test.tsx`, `VisitsScreen.test.tsx` and `DashboardScreen.test.tsx` only where the types force it.
- Docs: `docs/api.md:33` (round row), `:272` (Agents en tournée), `:313-327` (recap `activeAgents`, Cost); `docs/design.md:1220-1268` (rewrite "The admin round view" and drop *Pending*); EXPERIENCE.md `:51,:131,:222,:281` and Flow 3; `docs/domains/field-operations.md:23`; `docs/free-tier-budget.md:53-58` (recap reads).

## Tasks & Acceptance

**Execution:**
- [x] `src/shared/schemas.ts` -- the round response -- one wire home.
- [x] `src/worker/tournee.ts`, `src/worker/routes/admin.ts` -- the helper, both figures, the round route -- R14, R15.
- [x] Worker tests listed above -- the matrix -- story verify.
- [x] `round-list.ts`, `RoundScreen.tsx`, `copy/admin.ts`, `field/today.ts`; delete `src/shared/today.ts` and its test -- R15.
- [x] Client tests -- numbers, gaps, not-started, gold pin without a position.
- [x] Docs listed above -- R16.

**Acceptance Criteria:**
- Given an agent who swiped and sent no visit, when the dashboard and the recap load, then both count them.
- Given a tournée whose stop 2 was visited and stop 4 reassigned, when the admin opens the agent's round, then rows and pins read 1, 3, 5, the same as the phone's Tournée and Carte.
- Given the repo after the change, `grep -r buildTodayList src` finds nothing.

## Implementation Notes

- One Sonnet subagent implemented the spec. It added `test/tournees.ts` (`seedTournee`) for the recap and dashboard tests, and worker test cleanup now deletes `tournee_stops` and `tournees` first, because of the foreign keys. The mocks in `AdminApp.test.tsx`, `VisitsScreen.test.tsx` and `DashboardScreen.test.tsx` needed no change. `tourneeStopNumberSchema` is now shared by the sync stop and the round stop.
- `pnpm check:precache`: 999.99 KiB, unchanged from baseline `67f1dba` (the implementer built both).

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; run on Sonnet at the owner's request). Verdicts: high 0, medium 2, low 7, false 7, maybe-false 0.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | verification-gap, blind-hunter | Nothing pins that `agentsStartedOn` is served by `tournees_agent_day_idx` | medium | patch | `indexes.test.ts` pins plans for the other polled reads. A local `EXPLAIN QUERY PLAN` gives `SCAN users`, then `SEARCH tournees USING COVERING INDEX tournees_agent_day_idx`. Add that case. |
| 2 | edge-case-hunter | `docs/design.md:260` still defines « actif » as « a visit received that day » | medium | patch | The recap paragraph contradicts the new `activeAgents`. Reword it. |
| 3 | edge-case-hunter | The gold pin disappears when the lowest stop has no coordinates | low | patch (doc) | `mapPins` marks list index 0, as the phone's Carte does, so parity holds. But design.md's new "the lowest-numbered pin is gold" overstates it. Reword it. |
| 4 | blind-hunter | The admin list lags the phone while a visit sits in the outbox, and no doc says so | low | patch (doc) | The server cannot see the outbox. Add one sentence to design.md › The admin round view. |
| 5 | blind-hunter | `src/worker/round.ts` comment has an over-long unwrapped line | low | patch | Rewrap the comment. |
| 6 | edge-case-hunter | Non-atomic reads in the round route give a one-load mismatch | low | reject | The round is fetched once, not polled. The window is milliseconds, and a fix needs a transaction D1 lacks. |
| 7 | blind-hunter | The recap reads `users` twice | low | reject | The roster has a handful of rows, and folding the statements adds complexity for no measurable saving. |
| 8 | blind-hunter | The round route over-fetches open prospects and runs `todayTournee` after the parallel reads | low | reject | It runs once per page open and is not polled. The open prospects are one agent's (dozens). |
| 9 | blind-hunter | The "still to do" rule is split between the route and `todayTournee` | false | reject | `left` stays the one `isStopLeft`. "No visit today" is the Tournée filter (`todaysStops` does the same on the phone), and `!prospect` only guards the join. |
| 10 | blind-hunter | Server tests miss a post-swipe assignee, another agent's visit and the admin email | low | reject | `doorDaysOn` is agent-scoped and tested since 1.2. The listed stops come from `tournee_stops`, so an unlisted assignee cannot appear. |
| 11 | blind-hunter | The spec's tasks are unticked and precache is unquoted | false | reject | The fix edits this build's spec. Precache is quoted above and in the PR. |
| 12 | blind-hunter | DESIGN.md:401 and the ADR still mention `round-placement` / `today.ts`, and the round-placement tests were deleted | false | reject | The ADR is history. DESIGN.md:401 is entry 5's field placement. The deleted tests covered only `buildTodayList`; the phone's rules are tested in `tournee-stops.test.ts`. |
| 13 | blind-hunter | The round response shape breaks an already-open admin tab | false | reject | The data stage is disposable (CLAUDE.md), so there is no compatibility window. The PR notes the one-step change. |
| 14 | blind-hunter | `notStarted(agent ?? "")`, the unused `data`, and the dedupe-key renames | false | reject | That branch renders only when `round.data` exists, which needs `agent !== null`. `data` versus the outer values is the screen's existing pattern. The renames are cosmetic. |
| 15 | edge-case-hunter | `seedTournee` throws on a second call for the same agent and day | false | reject | No test calls it twice, and a throw is the right signal for that misuse. |
| 16 | intent-alignment | No test joins the Worker output to RoundScreen or compares against the phone | false | reject | Descriptive only. Both sides are tested against one shared schema, and phone parity is the spec's manual check. |

## Design Notes

The `EXISTS` drives from the handful of active `users` rows into the unique `(agent_email, day_start)` index. A bare `where day_start = ?` would scan every tournée ever stored on each 15 s recap poll. Counting roster members only, on both figures, is what makes them ADR-0036's "same figure".

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: green.
- `pnpm check:precache` -- expected: unchanged, since this is admin-only. Quote the total.

**Manual checks:**
- Local build: an agent swipes in one profile, and the admin sees « Agents en tournée » 1 and the round view with the phone's numbers. After one saved visit and one reassignment, both views drop the same numbers.
