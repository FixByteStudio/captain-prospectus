---
title: 'Field prospects in a sync stop costing ~4 ms of Worker CPU (GH #449)'
type: 'bugfix'
created: '2026-10-18'
status: 'done'
baseline_commit: 'd4e7b2f917c6be871398857514227246153d60a8'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: ['{project-root}/docs/free-tier-budget.md', '{project-root}/docs/adr/0005-d1-with-drizzle.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** PR #563 measured 100 field prospects on 50 bare visits at 6.8 ms median and 13.4–14.5 ms worst warm, against the 10 ms Workers Free budget (INVARIANT 13). #449's premise was wrong: the dedupe lookup is one statement for 100 keys. Profiling by phase (below) shows where the ~4 ms goes: **the prospect insert, ~2.9 ms**. Of that, ~2.1 ms is Drizzle building 25 statements of 4 rows × 23 columns (~1 µs per bound value). `foldForSearch` + `dedupeKey` cost 0.13 ms, the lookup 0.22 ms, zod +0.17 ms and the larger pull ~+0.2 ms.

**Approach:** A cheaper insert path, not a smaller cap (no contract change). A smaller cap would quarantine visits on queued field prospects past the cap, because the phone sends visits on unsent field prospects. Record the before/after figures and the phase split in `docs/free-tier-budget.md`, and correct #449's premise there. Closes #449.

**Decision (owner, 2026-10-18):** a typed raw-D1 insert helper, `insertOrIgnore(d1, table, rows)` in `src/worker/db/client.ts`. Table and column names come from the Drizzle schema, rows are the table's insert type, values pass through each column's `mapToDriverValue`, and every chunk goes in one `d1.batch`. Prototype at `PROSPECTS=100 SIZES=50`: 4.64 / 8.14 ms median / worst warm, down from 7.26 / 17.81. It goes around ADR-0005's "accessed through Drizzle" but keeps the typing that ADR wanted; one Consequences line in ADR-0005 records the exception and when to use it.

## Boundaries & Constraints

**Always:** idempotent insert-only writes (`on conflict do nothing`, INVARIANT 4); ≤100 bound parameters per statement (INVARIANT 7); dedupe collisions still map through `idMap` and follow `mergedInto`; every timed request is a 200 that stored what it sent; measurements run only on a temporary copy of the local D1.

**Never:** change the dedupe key, `foldForSearch`, or the lookup's shape; touch the visit insert (follow-up issue); run anything `--remote`; commit the profiling instrumentation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Full pass | 100 new field prospects + 50 visits on them | all 100 stored with `name_search`, `dedupe_key`, `source='field'`, assigned to the sender; 50 visits stored | — |
| Collision | a field prospect whose dedupe key exists | existing row kept, `idMap[clientId] = existing id` (survivor if merged), visits repointed | — |
| Twin in one payload | two field prospects, same dedupe key | the first is stored, the second maps to it | — |
| Resend | the same payload twice | second pass stores nothing new, accepts everything | — |

</frozen-after-approval>

## Code Map

- `src/worker/routes/agent.ts:94-96` -- the field-prospect insert loop (`chunk(rows, boundParamsPerRow(prospects))`, 25 statements at 23 columns). Keep the lookup (`:110`) and the `idMap` loop as they are.
- `src/worker/db/client.ts` -- `getDb`, `boundParamsPerRow`; the home for an insert helper.
- `src/worker/db/schema.ts:29` -- `prospects`: 23 columns, no `$defaultFn`, no boolean or JSON mode; the field row sets 18 of them.
- `src/worker/sync.test.ts:579-720` -- field-prospect tests (collision, `name_search`, 30 prospects over several statements, visit on a same-payload prospect); they run on real D1 in workerd.
- `scripts/measure-sync-cpu.mjs:183` -- sent `clientVersion: 2` after #451 raised the minimum to 3, so every request got a 426. Already fixed on this branch (`3`): it blocked the measurement.
- `docs/free-tier-budget.md:8` (budget row), `:151-191` (« Sync through the session »: the "not isolated; likely…" sentence is what this replaces).
- Local D1: `D1_SQLITE=/home/m0/PROJECTs/captain-prospectus/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/10eb2a0f1e79505128ed29bb4a1c92c383b94742e655277f14d8083aaf02e7a2.sqlite`. Profiling copy of the script and instrumented route: `/tmp/_profile-sync.mjs`, `/tmp/agent.instrumented.ts`, `/tmp/agent.variants.ts` (`VARIANT=raw|placeholder`).

## Tasks & Acceptance

**Execution:**
- [ ] `src/worker/db/client.ts` -- add `insertOrIgnore(d1, table, rows)`. Columns are `rows[0]`'s keys; it throws if a row has a key set the first lacks. It chunks by that column count (≤100 parameters, INVARIANT 7), returns early on no rows, and sends one `d1.batch` of `insert into "<table>" (...) values (...),... on conflict do nothing`. A comment says why (Drizzle's builder ~1 µs a bound value, GH #449) and when to use it (hot multi-row inserts only). -- the cheaper path
- [ ] `src/worker/routes/agent.ts` -- field prospects go through `insertOrIgnore(c.env.DB, prospects, rows)`; the comment names the cost -- #449
- [ ] `src/worker/sync.test.ts` -- cover each Matrix row not yet covered: 100 field prospects (the cap) all stored with their columns; twin keys in one payload; a resend. Unit-test the helper's mixed-keys throw -- Matrix
- [ ] `docs/adr/0005-d1-with-drizzle.md` -- one Consequences line: a hot multi-row insert may use `insertOrIgnore`, typed from the schema (GH #449) -- the exception has one home
- [ ] `docs/free-tier-budget.md` -- a new entry after « Sync through the session »: machine, date, two runs, before/after at `PROSPECTS=100 SIZES=50` and `SIZES=50`, the phase split. Replace the "not isolated; likely…" sentence with a pointer and update the budget row's "100 field prospects add ~4 ms" -- figures have one home

**Acceptance Criteria:**
- Given `PROSPECTS=100 SIZES=50`, when the script runs twice, then the warm worst is recorded beside the 13.4–14.5 ms of #563, and the doc names the phase that cost it.
- Given the Matrix, when `pnpm test` runs, then each row has a worker test.
- Given the diff, then `SYNC_PROSPECTS_PER_REQUEST`, `CLIENT_VERSION` and the wire schemas are unchanged.

## Implementation Notes

- Implemented by a Sonnet subagent; matrix gaps (50 visits on the full pass, merged survivor) and the review patches added after. Files: `src/worker/db/client.ts`, `src/worker/routes/agent.ts`, `src/worker/sync.test.ts`, `docs/adr/0005-d1-with-drizzle.md`, `docs/free-tier-budget.md`, `scripts/measure-sync-cpu.mjs` (`clientVersion` 2 → 3, which blocked the measurement).
- The helper chunks by the keys set (18 → 5 rows, 90 parameters, 20 statements in one batch), not by table width (23 → 4 rows).
- Measured back to back (Ryzen 9 7900): `PROSPECTS=100 SIZES=50` went from 6.99 (7.42) / 14.02 (18.06) to 4.70 (4.70) / 7.74 (7.07) ms median / worst warm. Cold is unchanged past 10 ms (#404).
- Forcing GC before each request (`--expose-gc`) roughly doubled every median in this session (bare 50: 7.2 vs 3.3 ms), so these figures are without it.

## Spec Change Log

## Review Triage Log

**Pass 1** (blind-hunter, edge-case-hunter, verification-gap, intent-alignment; Sonnet per the owner). Verdicts: high 0, medium 1, low 3, false 5, rejected low 3. Verification-gap: no gaps.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | blind, edge, verif | `insertOrIgnore` binds NULL for an `undefined` value or a key missing from a later row, where Drizzle uses the default; docstring overclaims; JS `$defaultFn` skipped | medium | patch | The only caller sets every key (`agent.ts` row literal), so not reachable today; a next caller would get NULLs or NOT NULL failures. Guard made two-way, docstring made exact, test added. |
| 2 | blind | `agent.ts` comment "100 rows of 18 columns" vs the builder's 23 | low | patch | The builder walks all 23 table columns; the route sets 18. Count dropped from the comment. |
| 3 | blind | Merged-survivor test hardcodes the dedupe key literal | low | patch | Computed with `dedupeKey()` instead. |
| 4 | orchestrator | Doc compares 6.8 ms against the 2.7 ms dev-user run | low | patch | The session figure is 3.0 ms (« Sync through the session »). |
| 5 | blind, edge, intent | `d1.batch` makes the insert atomic; one bad row fails all 100, so the outbox is stuck | false | reject | Before, the same bad row also failed its statement and 500'd the request on every retry. Atomicity changes which rows land before the 500, not whether the phone retries; the wire is unchanged, so `api.md` and field-operations don't change. |
| 6 | blind | Script hardcodes `clientVersion: 3` | false | reject | The script must not import `src/` (its own rule; every other constant is copied with a comment). A future bump fails loudly with 426. It's in scope because it blocked the measurement; the PR says so. |
| 7 | blind | ADR-0005 exception as a Consequences line, not a new ADR; "stays typed" is false | false | reject | The owner chose this form (frozen Decision). Rows are `T["$inferInsert"]`, so keys are checked at compile time. |
| 8 | blind | Perf claim has no guard; visit-insert follow-up has no issue | false | reject | A CPU figure cannot be a deterministic test; the doc states the method and its limits. The follow-up issue is opened with the PR. |
| 9 | edge | First row `{}` gives `chunk(…, 0)` an unrelated throw | low | reject | Unreachable (field rows always have keys) and fails loudly; a guard adds a branch. |
| 10 | blind, edge, intent | Helper tests skip mapped types, atomicity, the unknown-column throw, a statement-count assertion | low | reject | No caller has a mapped column. Unknown keys are blocked by the type. The ≤100-parameter bound is exercised by the 100-prospect route test on real D1, which refuses statements past 100. |
| 11 | intent | `column.name` breaks for a column named only by `casing` | low | patch (with #1) | Every column in `schema.ts` has an explicit name (grep). Documented in the docstring. |
| 12 | intent | Intent's 25×4×23 vs the helper's 20×5×18 | false | reject | Both are right: the builder chunks by table width (23), the helper by the keys set (18). |

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: all pass
- `D1_SQLITE=… PROSPECTS=100 SIZES=50 node scripts/measure-sync-cpu.mjs` (twice) and `SIZES=50` (twice) -- expected: exit 0; figures match the doc
