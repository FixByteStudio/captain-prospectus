---
title: 'Visits index on visited_at (GH #106)'
type: 'feature'
created: '2026-09-26'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick', 'migration-guard']
review_loop_iteration: 0
context: []
baseline_commit: '0721a71422e7efd035b86c0ee6f6b83b498b186f'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The dashboard endpoint (G1, epic #104) counts visits by clamped `visited_at` over
up to 180 days, but every `visits` index leads with `prospect_id` or `agent_email`, so a
`visited_at` range is a full table scan and threatens the 10 ms CPU budget (INVARIANT 13,
server-gaps G2).

**Approach:** Add `visits_visited_idx` on `visits(visited_at)` in `schema.ts`, generate the
additive migration with `pnpm db:generate` (d1-migration skill: a new index is safe in one
release and the deployed Worker ignores it), prove with `EXPLAIN QUERY PLAN` in a worker test
that a `visited_at` range count searches the new index, record it in `docs/data-model.md`, and
have `migration-guard` review it.

</frozen-after-approval>

## Implementation Notes

Oneshot: one schema line, one generated migration (plus drizzle-kit's snapshot and journal),
one small worker test and one docs row, well under 100 hand-written lines.

- `src/worker/db/schema.ts:127-131` — add `index("visits_visited_idx").on(t.visitedAt)` to
  the `visits` table's index list, following the `<table>_<col>_idx` naming. No other table
  or column changes.
- `pnpm db:generate --name visits_visited_index` → `drizzle/0006_visits_visited_index.sql`
  should be a single `CREATE INDEX`. Earlier migrations are named, not drizzle-kit's random
  names. Never hand-edit it, and never touch 0000–0005.
- `src/worker/db/indexes.test.ts` (new, worker project: `src/worker/**/*.test.ts`) —
  `test/setup-worker.ts` already builds the DB from `drizzle/` via `applyD1Migrations`, so the
  suite passing is the "migration applies" proof. Run `EXPLAIN QUERY PLAN SELECT count(*) FROM
  visits WHERE visited_at >= ?1 AND visited_at < ?2` through `env.DB.prepare(...).bind(...)`
  and assert a `detail` names `visits_visited_idx` and no row reads `SCAN visits`.
- `docs/data-model.md` `## Indexes` — add `visits(visited_at)` | the dashboard's
  period counts, next to the other `visits` rows.
- `pnpm db:migrate:local` applies it to the local D1.

Done as planned:
- `src/worker/db/schema.ts:131` gets `visits_visited_idx`. Generated files: `drizzle/0006_visits_visited_index.sql`
  (one `CREATE INDEX`), `drizzle/meta/0006_snapshot.json` (its only change is the index; `prevId` is 0005's `id`) and the
  journal entry.
- `src/worker/db/indexes.test.ts` passes, and fails with `expected false to be true` when 0006 is moved out of
  `drizzle/`, so it really detects a missing index.
- `docs/data-model.md:158` gets the new row. It lands in the half of the Indexes table that a paragraph cuts off,
  which is already tracked as #16 (found-in-passing), so no new issue was opened.
- `baseline_commit` is the merge-base of `feat/106-visits-index` and `origin/main`, which is also HEAD at branch time.
- Verification: typecheck 0, `pnpm test` 44 files / 994 tests passed, lint clean, build ok (precache 676.74 KiB,
  unchanged by this story), `pnpm db:migrate:local` applied 0006.

## Review Triage Log

Pass 1 (quick + migration-guard): 0 high, 0 medium, 0 low, 0 false, 0 maybe-false. There are no findings to route.
- The quick reviewer confirmed that the existing `visits` queries (`routes/status.ts:43`, `routes/agent.ts:341`, the
  retention sweep) still pick their old indexes, and that a G1-shaped `GROUP BY outcome` over a `visited_at` range
  searches the new one.
- migration-guard: safe in one release, with an unbroken snapshot chain and no edit to 0000–0005. Two notes for the
  PR, not defects:
  - The index lands before the dashboard query that uses it (entry 3 and later).
  - Every visit insert now writes one more index entry, which is negligible at 2 agents.
- Both reviewers flagged the split Indexes table in `docs/data-model.md`. It pre-dates this change and is issue #16.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm test` -- expected: all projects pass, including the new EXPLAIN test
- `pnpm lint` -- expected: clean
- `pnpm build` -- expected: succeeds
- `pnpm db:migrate:local` -- expected: 0006 applies with no error

**Manual checks:**
- `migration-guard` subagent reviews `schema.ts` and `drizzle/0006_*` and finds no issue.
