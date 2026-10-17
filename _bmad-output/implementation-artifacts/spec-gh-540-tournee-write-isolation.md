---
title: 'A failed tournée write no longer fails the sync, and the ledger counts stay whole (#540)'
type: 'bugfix'
created: '2026-10-17'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '2a509fc87111d6d8b0cd4281476592a0d411c491'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-538-context.md'
  - '{project-root}/docs/glossary.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Retro action 2 of epic #496 (F1, F6, F7, F8, F10). A throw in `writeTournees` returns a 500 after the visits are stored, so the phone never clears them. The Visites feed skips door-days when a poll after the seed is cut, ties at the cut included. The duplicates screen counts raw visits. The stop-number rule is written twice. Three Worker tests fail between 00:00 and 01:00 Brussels.

**Approach:** Put `writeTournees` in its own try/catch, as the position write is (ADR-0028). On a throw, the response leaves this request's tournées and stops out of `accepted` and keeps its visits and prospects. When `since > 0`, the feed reads the oldest arrivals first and takes the whole tie group at the cut, so the cursor walks forward with no gap and no wire change. The duplicates screen counts door-days through one helper in `door-days.ts`. `tourneeStopSyncSchema` reuses `tourneeStopNumberSchema`. The named describes freeze `Date` as `dashboard.test.ts` does.

## Boundaries & Constraints

**Always:** Insert-only and idempotent writes (INVARIANTS 2, 4). Never lose a visit (INVARIANT 5). ≤100 bound parameters per statement through `chunk()` (INVARIANT 7). The door-day rule lives in `src/worker/door-days.ts`. A door-day is the visit's own `prospect_id`, never folded to a survivor. The feed response keeps its shape and its newest-first order. Log only the error's name: a Drizzle message carries bound values.

**Never:** No sync-contract change: no `CLIENT_VERSION` bump and no new request or response field. No change to the client cursor (`nextSince`, `queries.ts`). No migration. Do not touch F2–F5, F9 or F11–F15; entries 3–5 own them.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tournée write throws | sync with visits, a tournée and stops; the `tournees` insert raises | 200; `accepted.visits` holds the visits; `accepted.tournees` and `accepted.stops` are `[]` | `console.error` with the error name only |
| Truncated delta poll | `since > 0`, more than `limit` visits after it | the oldest `limit` arrivals; the next poll from `max(receivedAt)` returns the rest | `truncated: true` |
| Tie at the cut | the limit-th and (limit+1)-th visits share `received_at` | every visit with that `received_at` is touched; the page may exceed `limit` by the tie group | none |
| Seed poll | `since` = 0 or absent | unchanged: the newest `limit` arrivals | `truncated` as today |
| Duplicates count | one agent, two visits to one side on one Brussels day | that side counts 1 | none |

</frozen-after-approval>

## Code Map

- `src/worker/routes/agent.ts:268-270` -- step 3b `writeTournees` call with no guard; the position write below it (`:275-282`) is the try/catch pattern to copy.
- `src/worker/tournee.ts:26` `writeTournees` -- unchanged. A partial write before a throw is safe because every insert is `onConflictDoNothing`, so the resend is a no-op.
- `src/worker/door-days.ts:158-293` `doorDaysTouched` -- the first read orders `desc(receivedAt)` and limits to `limit + 1`. `newest` is taken as `touched[0]`, which is only right for a newest-first read. `brusselsDays` (`:300`) is the JS Brussels-day helper to reuse.
- `src/worker/routes/admin.ts:1260-1281` -- duplicates `aVisits` and `bVisits` use `count()` over `visits` per prospect (`chunk(ids, 2)`).
- `src/shared/schemas.ts:625` `tourneeStopNumberSchema` (not exported) and `:697` its inline copy in `tourneeStopSyncSchema`.
- `src/worker/admin.test.ts:2147` describe `GET /api/admin/agents/:email/round` -- `swipe(now - 3_600_000)` (`:2262`) and `now - 1_000` (`:2345`) on the real clock.
- `src/worker/sync.test.ts:1424` describe `tournée at sync` -- `now - 60_000` (`:1554`) and helpers that default to `Date.now()`.
- `src/worker/dashboard.test.ts:105-131` -- the pattern: `vi.useFakeTimers({ toFake: ["Date"] })`, then `vi.setSystemTime(NOW)` in `beforeEach`, and `vi.useRealTimers()` in `afterEach`.
- `src/worker/admin.test.ts:936-942` -- precedent for a test that makes a write throw: a `RAISE(ABORT)` trigger through `env.DB.exec`, dropped afterwards.
- `src/worker/admin.test.ts:1704` describe `GET /api/admin/visits` (`seedVisit`, `addVisit`, `feed`) and `:1306` "reports how many visits each side carries" -- where the new tests go.
- Docs: `docs/api.md:48` (duplicates row), `:53` and `## The live feed` (`since` and `truncated` bullets); `docs/domains/field-operations.md:200` (the tournées-and-stops protocol rule).

## Tasks & Acceptance

**Execution:**
- [x] `src/worker/routes/agent.ts` -- wrap step 3b in try/catch. On a throw, `acceptedTournee = { tournees: [], stops: [] }` and log `"tournee write failed"` with the error name, as the position write does. Comment with the why: the visits are stored, so their acknowledgement must not depend on this write.
- [x] `src/worker/door-days.ts` -- in `doorDaysTouched`, when `since > 0`, order the first read `asc(receivedAt), asc(id)`. When the read is cut and the row past the cut shares the last kept row's `received_at`, read every visit with that `received_at` under the same filters and touch them all. Compute `newest` as the max `receivedAt` touched. Update the doc comment.
- [x] `src/worker/door-days.ts` -- add `doorDayCounts(db, prospectIds): Promise<Map<string, number>>`. It reads `prospect_id, agent_email, visited_at` in `chunk(ids, 1)` batches and counts distinct (agent, Brussels day) per prospect through `brusselsDays`.
- [x] `src/worker/routes/admin.ts` -- the duplicates route uses `doorDayCounts`. Drop the now-unused `count` import if nothing else needs it.
- [x] `src/shared/schemas.ts` -- `tourneeStopSyncSchema.number` becomes `tourneeStopNumberSchema`. Move the constant above its first use if needed.
- [x] `src/worker/sync.test.ts` -- in `tournée at sync`, freeze `Date` at noon Brussels (dashboard pattern). Add a test: a `BEFORE INSERT ON tournees` RAISE trigger, then a sync with a visit, a tournée and a stop gets 200, the visit in `accepted.visits`, and neither id in `accepted.tournees` or `accepted.stops`. Drop the trigger in `finally`.
- [x] `src/worker/admin.test.ts` -- freeze `Date` in the round describe. Add a feed test: `limit=2` over five door-days with a tie at the cut, polled from each answer's max `receivedAt`, returns every door-day exactly once over the polls. Add a duplicates test: two visits by one agent on one day count 1.
- [x] `docs/api.md`, `docs/domains/field-operations.md` -- the feed's delta-poll order and tie rule, `aVisits` and `bVisits` as door-days, and the tournée-write failure policy.

**Acceptance Criteria:**
- Given `Date` faked to 00:30 Brussels around the whole Worker run, when the round and `tournée at sync` describes run, then they pass.
- Given the change, when `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` run, then all pass with no `CLIENT_VERSION` change and no new migration.

## Implementation Notes

## Spec Change Log

## Review Triage Log

Pass 1 (blind-hunter on sonnet, re-run after the owner rejected an opus launch; edge-case-hunter, verification-gap, intent-alignment). Verdicts: 0 high, 1 medium, 6 low, 9 false. Routed: 2 patch, 1 defer, the rest rejected.

| # | Lens | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|---|
| 1 | verification-gap | Duplicates count never asserted above 1, so a "has any visit" count would pass | medium | patch | Test now adds another day and another agent and expects 3 |
| 2 | edge-case | "Tie group is one sync's visits at most" is false: a repaired orphan keeps its `received_at` | low | patch | Wording now says "usually" in `door-days.ts` and `api.md`; behaviour stays correct, only the page grows |
| 3 | edge-case | Concurrent syncs: one stamped T commits after one stamped T+d, so the cursor passes T | low | defer | Pre-existing: the cursor was already max `receivedAt` before this change |
| 4 | edge-case | Persistent `writeTournees` failure retries the swipe for ever, with only a name logged | low | reject | The intent picks this policy, as ADR-0028 does for the position; the visits are no longer held hostage |
| 5 | edge-case | Hidden tab catches up at one 500-row page per 15 s | low | reject | Two agents never reach 500 arrivals per poll; the fix adds client surface |
| 6 | edge-case | With `reason`, a truncated delta page whose door-days are all filtered out stalls the cursor | low | reject | Needs over 500 matching arrivals after `since`; out of reach with two agents, and the fix is a new response field |
| 7 | edge-case, blind | `doorDayCounts` reads every visit of up to 200 prospects into JS | low | reject | Bounded by the duplicates page; `brusselsDays` runs `Intl` about twice per distinct day |
| 8 | blind | `chunk(ids, 1)` sends one query per prospect | false | reject | `chunk`'s second argument is params per row: 100 ids per statement |
| 9 | blind | Tie re-read duplicates rows and inflates `visits[]` | false | reject | `touched` only builds the key map; step 3 reads visits by key, once |
| 10 | blind | Walk test cannot see duplicates | false | reject | `seen` is compared as an exact 5-name list, so a repeat makes it longer and fails |
| 11 | blind | Failure logs only `err.name` | false | reject | Deliberate: a Drizzle message carries bound values (spec Always) |
| 12 | blind | `api.md` sync row lacks the failure policy | false | reject | The diff edits that row |
| 13 | blind | Duplicates' change of meaning not documented | false | reject | `api.md:48` says door-days; the glossary keeps « visites » for door-days in the UI |
| 14 | blind | `tourneeStopNumberSchema` may not be defined | false | reject | Defined in zod/mini at `schemas.ts:625`, above its use |
| 15 | intent | Tests sit at the Worker layer while the intent's outcomes live on the client | false | reject | Descriptive; the frozen Never list excludes client changes |
| 16 | intent | Prospects are not exercised in the F1 test | false | reject | Prospects are accepted at step 1, before the guarded write, and that path is unchanged |

## Design Notes

The story's open question asked whether a gap-free cursor needs a compound `(received_at, id)` cursor or a has-more flag. It needs neither. A delta poll that reads oldest first moves the client's existing cursor (`max(receivedAt)` held) past only what it received. Taking the tie group at the cut whole means the exclusive `since` skips nothing. Its size is bounded by one sync's visits, since a sync stamps one `received_at`. The seed stays newest first, because a fresh tab wants the latest page and its cut is already announced by `capped`.

One residual case is accepted: a window that held nothing polls again with `since = 0`, so more than `limit` arrivals inside one 15 s poll would be capped silently. With two agents that is out of reach.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all green
- before the fix, then after it: temporarily fake `Date` at module level to `2026-10-14T22:30:00Z` (00:30 Brussels) in both files, run `pnpm vitest run --project worker src/worker/sync.test.ts src/worker/admin.test.ts`, then revert -- expected: the named tests fail before and pass after
