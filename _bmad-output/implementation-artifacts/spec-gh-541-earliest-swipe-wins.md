---
title: 'The earliest swipe wins, whichever phone syncs first (#541)'
type: 'bugfix'
created: '2026-10-17'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '113b080843d672bc5eca98a788692a7d090263f1'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-538-context.md'
  - '{project-root}/docs/glossary.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Retro action 6 (F2). The unique `tournees_agent_day_idx` makes the first tournée to *arrive* the agent's day, so a phone that swiped earlier but synced later loses its numbers to the later swipe.

**Approach:** Store every tournée insert-only and pick the day's tournée at read time: the one with the earliest `client_started_at`, `id` as tie-break. The unique index becomes a non-unique index on `(agent_email, day_start, client_started_at, id)` in one migration. The phone already replaces its cached tournée wholesale on each pull, so a phone that held a later tournée takes the winner's stops on its next pull.

## Boundaries & Constraints

**Always:** Insert-only, idempotent writes (INVARIANTS 2, 4); `writeTournees` stays inside #540's try/catch. Every tournée id is listed in `accepted.tournees`. One migration from `pnpm db:generate`, no backfill (disposable stage). "Earliest" is `min(client_started_at)`, never the clamped `started_at` (epic decision 2026-10-17). ADR-0036 › The tournée, › Numbers and › On the server are reworded in place as "(amended 2026-10-17)"; `architect` confirmed no new ADR is needed (ADR-0024: restores the ADR's own "first swipe wins", nothing hard to reverse, disposable stage), and the PR says so in one line.

**Never:** No wire-shape change and no `CLIENT_VERSION`/`MIN_CLIENT_VERSION` bump: old builds already adopt whatever tournée the pull returns. No `(tournee_id, number)` index, no F4 drain, no F9 change (entry 4). No rewrite of `indexes.test.ts` beyond what keeps the `agentsStartedOn` plan green (entry 5). No message to the agent on renumbering.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Later swipe syncs first | phone B (started 09:05) syncs, then phone A (started 09:00) | both tournées stored; A's sync, B's next pull and the admin round return A and its numbers | none |
| Clocks ahead | both phones' clocks 2 h ahead; B (client later) arrives first, A second | A wins although both clamped `startedAt` equal their arrivals and B's is earlier | none |
| Tie | equal `client_started_at` | lower `id` wins | none |
| Resend | either tournée and its stops sent again | accepted again, nothing new stored | none |
| Losing phone's own stops | B's queued snapshot stops or joiners on B's tournée | stored on B's tournée (insert-only), never read; listed in `accepted.stops` as today | stop whose prospect has not arrived still waits |
| Losing phone pulls | B holds pulled tournée B and its stops | after the pull it holds only A and A's stops; joiners are re-derived against A | none |

</frozen-after-approval>

## Code Map

- `src/worker/db/schema.ts:160-183` -- `tournees` doc comment and `uniqueIndex("tournees_agent_day_idx")`. Replace with `index("tournees_agent_day_started_idx").on(agentEmail, dayStart, clientStartedAt, id)`.
- `src/worker/tournee.ts:16-51` -- `writeTournees` doc comment and the insert comment ("the first swipe wins", "lost its day"). The insert stays `onConflictDoNothing()` (now only the id conflicts). `owned` (`:57-70`) then naturally includes a losing tournée: keep the code, fix the comments.
- `src/worker/tournee.ts:153-170` `todayTournee` -- add `.orderBy(asc(tournees.clientStartedAt), asc(tournees.id))` before `.limit(1)`. Serves sync (`routes/agent.ts:306`) and the admin round (`routes/admin.ts:187`).
- `src/worker/tournee.ts:200-219` `agentsStartedOn` -- query unchanged (`EXISTS` counts an agent once); comment names the new index.
- `src/worker/db/indexes.test.ts:86-99` -- rename the index in the test name, comment and assertion only.
- `src/worker/sync.test.ts:1424` describe `tournée at sync` -- Date faked at `NOW`; helpers `tourneeOf(startedAt)`, `stopOf`, `swipe(count)`, `sync`, `asOther`. `:1566` "keeps the first swipe of the day and drains the losing phone" asserts the old rule: rewrite it.
- `src/worker/admin.test.ts:2210` describe round -- `swipe(startedAt, stops)` inserts rows directly; add the earliest-wins round test there.
- `src/client/field/sync.ts:274-284` -- wholesale replace on pull; only the comment changes. `src/client/field/tournee-stops.ts:157-186` `stopsOfToday` already ignores queued stops of another tournée id.
- `src/client/field/sync.test.ts:982` "adopts the winner's tournée" -- the pattern for the new client test (`startTournee`, `acceptingServer`, a `fetchFn` that overrides `tournee`).
- Docs naming the index or the first swipe: `docs/adr/0036-...md:92-108,131-136`; `docs/api.md:26,279,332`; `docs/data-model.md:233`; `docs/domains/field-operations.md:5,198,200`; `docs/free-tier-budget.md:77,209`; `docs/design.md:1792-1801`.

## Tasks & Acceptance

**Execution:**
- [x] `src/worker/db/schema.ts` -- swap the unique index for the non-unique one; reword the comment. Then `pnpm db:generate` (d1-migration skill) and check the SQL is one `DROP INDEX` + one `CREATE INDEX`.
- [x] `src/worker/tournee.ts` -- `todayTournee` orders by `client_started_at, id`; comments of `writeTournees`, `todayTournee`, `agentsStartedOn` say every tournée is stored and the earliest swipe wins.
- [x] `src/worker/db/indexes.test.ts` -- point the `agentsStartedOn` plan at the new index name.
- [x] `src/worker/sync.test.ts` -- replace the `:1566` test with: later swipe B syncs first, earlier A second (same agent, separate requests); A's response, a bare pull, and the DB (2 tournées, both stop sets) show A wins. A second test with both clocks 2 h ahead (`tourneeOf(NOW + 2h)` for B synced at NOW, A at `NOW + 2h - 10 min` synced after `vi.setSystemTime(NOW + 5 min)`). Resending both tournées and stops stays accepted with no new rows. A tie test (same `startedAt`, lower id wins).
- [x] `src/worker/admin.test.ts` -- in the round describe, `swipe` a later tournée first and an earlier one second (different numbers); the round returns the earlier one's stops.
- [x] `src/client/field/sync.ts` -- reword the comment at `:276`.
- [x] `src/client/field/sync.test.ts` -- a phone holding pulled tournée B with stops (and a queued joiner on B) syncs; the server answers tournée A with its stops; `db.tournees` holds only A, `db.tourneeStops` only A's stops, and `stopsOfToday` shows none of B's.
- [x] Docs -- ADR-0036, Date and Amends headers untouched, inline "(amended 2026-10-17)": › The tournée "at most one per agent per day" becomes one is read per agent and day; › Numbers replaces "Only a number not yet synced can change" with: the earliest swipe by the phone's start time (id breaks a tie) wins, and a phone holding another tournée adopts the winner's numbers on its next pull even if its own were synced; `client_started_at` is the phone's clock, so a skewed clock can win, accepted; › On the server drops "unique per agent and day" for: every tournée is inserted with `onConflictDoNothing` on its id, and the earliest `client_started_at` is read. `docs/api.md`, `docs/data-model.md`, `docs/domains/field-operations.md`, `docs/free-tier-budget.md`, `docs/design.md` at the lines above.

**Acceptance Criteria:**
- Given an empty local D1, when `pnpm db:migrate:local` runs, then every migration applies from zero.
- Given the change, when `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm check:precache` run, then all pass with `CLIENT_VERSION` unchanged, and the PR quotes the precache total.

## Implementation Notes

- Migration `drizzle/0017_jazzy_manta.sql`: one `DROP INDEX`, one `CREATE INDEX`; applies from zero on a fresh `--persist-to` state (0001–0017).
- `writeTournees` code unchanged; only its comments. `todayTournee` gains the `orderBy`. Client code unchanged but the pull comment.
- The `:1566` worker test became four (later-first, clocks 2 h ahead, resend, tie). The losing phone's stops are asserted accepted after the earlier swipe landed.
- Precache: 25 entries, 967.68 KiB against 1,000 KiB.

## Spec Change Log

## Review Triage Log

Pass 1 (all on sonnet except intent-alignment on haiku; edge-case and intent re-run after a rate limit cut the first launch). Verdicts: 0 high, 0 medium, 3 low, 11 false. Routed: 1 patch, 1 defer, the rest rejected.

| # | Lens | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|---|
| 1 | intent | Client test never re-derives a joiner against the winner (matrix row "Losing phone pulls") | low | patch | Test now leaves J out of A and asserts a queued stop for J on A at max+1 |
| 2 | edge-case, blind | No `EXPLAIN` pins `todayTournee`'s `ORDER BY … LIMIT 1` on the new index | low | defer | Entry 5 (R15) plans the statements the code runs; frozen Never keeps `indexes.test.ts` minimal here |
| 3 | verification-gap | Dropping the `orderBy` might pass because the index already returns rows in order | low | reject | The tests would still catch a change of index or plan: with the later row inserted first, rowid order picks it and the tests fail |
| 4 | edge-case, blind | A clock that runs behind wins the day | false | reject | Frozen intent: `min(client_started_at)`, skew accepted (epic decision 2026-10-17); a clock days behind is bucketed on its own past day by the pre-existing clamp |
| 5 | blind, intent, edge | Day bucket from clamped `startedAt`, rank from `client_started_at` | false | reject | Ranking runs inside one `day_start`; the bucket rule is unchanged from ADR-0036 and both tests sit on one day |
| 6 | edge-case, blind | Winner's stops may be partial (chunked drain, waiting prospect) | false | reject | A tournée travels with its first 250 stops in one request (`sync.ts` send order); the same was true of the first-to-arrive winner before |
| 7 | blind, edge | Numbers change after work started; joiners on the loser are orphaned | false | reject | Accepted by the amended ADR; visits carry no tournée id; `appendJoiners` re-appends a loser's joiner to the winner on the same pull (patch 1 pins it) |
| 8 | blind | Losing rows accumulate; "retention sweep gains none" now false | false | reject | That sentence is about positions; one extra row per extra phone per day |
| 9 | blind | Other readers may assume one row per agent-day | false | reject | `tournees` readers are `todayTournee`, `agentsStartedOn` (`EXISTS`) and `writeTournees`' owned check only (grep) |
| 10 | blind | No CLIENT_VERSION note though semantics changed | false | reject | Design Notes: shapes unchanged and every build replaces its cache wholesale; the PR states it |
| 11 | edge-case | A foreign or changed tournée id is listed as accepted | false | reject | Pre-existing: insert conflicted on the id before too; ids are `randomUUID()` |
| 12 | edge-case | Unbounded tournées per agent-day | false | reject | Bounded by the agent's phones; `SYNC_TOURNEES_PER_REQUEST` caps each request |
| 13 | edge-case | Tie test runs one arrival order only | false | reject | High id first then low: "first arrival" fails it, and "last arrival" fails the main test |
| 14 | edge-case | `setSystemTime(NOW + 5 min)` leaks into later tests | false | reject | `beforeEach` resets to `NOW`; `afterEach` restores real timers; NOW + 2 h is 14:00 Brussels |

## Design Notes

The story's open questions, settled by reading the code. **Not breaking:** the request and response shapes are the same, and every build since ADR-0036 clears and re-puts `tournees` and `tourneeStops` from each pull, so an old build adopts the earliest swipe exactly as a new one does; no bump, no 426 path. **The losing phone's own stops** keep flowing: they name a tournée the server now holds for this agent, so they are stored there and never read (insert-only beats a drain rule that would need its own test). On the same pull, `appendJoiners` re-derives joiners against the winner's stops, so a prospect the losing phone had appended joins the winner at the next number.

Accepted residual: if a tournée write fails (#540) the pull may return the later tournée for one sync, and the phone flips to the earliest on the resend.

## Verification

**Commands:**
- `pnpm db:migrate:local` on a fresh `.wrangler/state` -- expected: every migration applies.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:precache` -- expected: all green; note the precache total.
