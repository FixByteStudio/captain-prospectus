---
title: 'The server logs each import (#371)'
type: 'feature'
created: '2026-10-10'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
baseline_commit: 'ada04559b8f80bc523e4775853b7ee82ecc99e48'
context:
  - '{project-root}/docs/adr/0030-the-server-keeps-an-import-log.md'
  - '{project-root}/docs/adr/0023-retention-by-redaction.md'
  - '{project-root}/_bmad-output/initiative-import-refresh/epic-import-a4-a6/story-the-server-logs-each-import.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing records an import, so the Import screen cannot list the last five (epic #363, R3). The server sees only batches, and a re-sent batch changes its own `created`/`updated` answer.

**Approach:** Build exactly what ADR-0030 decides, server and shared schema only: two expand-only tables, an optional `importLog` field on `POST /api/admin/prospects/batch`, a per-batch log row written after the prospects, `GET /api/admin/imports`, and a retention-sweep step. The client (ticket 8) sends the field and reads the route.

## Boundaries & Constraints

**Always:** `zod/mini` schemas in `src/shared/schemas.ts` (INVARIANT 6); additive request field (9); client ids and `onConflictDoNothing` (4); `chunk()`/≤100 bound params (7); status derived on read and never stored; counts are the sum of `import_batches` rows, never an updated counter; `started_at` is the server's `now`; the log write is one `db.batch` after the prospects and a failed log write fails the request; sweep step has its own try/catch and a batch constant; budget tests re-run at 250 rows (13); `IMPORT_STALE_MS` = 5 min in `src/shared/constants.ts`; `created_by` and `file_name` nullable; `import_batches` is never redacted.

**Never:** Any client change (ticket 8). Any new route besides the GET. Storing a status or running counter. A start/finish call. Editing a migration already on `main`. Fixing unrelated findings here (open a `found-in-passing` issue instead).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No log field | batch without `importLog` | imports as before; no `imports` or `import_batches` row | No error expected |
| First batch | `importLog` with new `importId` | `imports` row (first batch's fields, `started_at = now`) plus batch row | No error expected |
| Later batches | same `importId`, other `batchIndex` | one import; GET sums the batches' counts | No error expected |
| Re-sent batch | same `(importId, batchIndex)` | counted once with its first counts; response is the live `{created, updated}` | No error expected |
| Bad log field | `batchIndex >= batchCount`, negative or oversized number | 400 from zod | Nothing written |
| Log write fails | D1 error on the log batch | request fails | Client re-sends; the upsert is idempotent |
| Complete | `n = batch_count` | listed `done` | — |
| Stalled | `n < batch_count`, newest `received_at` older than `IMPORT_STALE_MS` | listed `interrupted` | — |
| Running | `n < batch_count`, newer than the window | not listed | — |
| Many imports | more than 5 settled in the 20 newest | five newest by `started_at`; older never settled late | — |
| Sweep | `started_at` older than `RETENTION_DAYS` | `created_by`, `file_name` set to NULL, counts kept; a second run is a no-op | Failure logged by name, visit redaction continues |

</frozen-after-approval>

## Code Map

- `src/worker/db/schema.ts` -- add `imports` (index on `started_at`) and `import_batches` (PK `(import_id, batch_index)`), plus row types; follow `loginAttempts` for composite PK.
- `drizzle/` -- generate with `pnpm db:generate` (d1-migration skill); expand-only, no edit of existing migrations.
- `src/shared/constants.ts` -- `IMPORT_STALE_MS`, `IMPORT_LOG_BATCH_COUNT_MAX` (10 000), a recent-imports window (20) and list size (5), and a sweep batch constant for the import redaction.
- `src/shared/schemas.ts` -- optional `importLog` on `prospectBatchSchema` (line ~262, `z.optional`, `z.int().check(...)`, `shortText` for `fileName`); `importsResponseSchema` and its type next to `importResultSchema` (~398).
- `src/worker/routes/admin.ts` -- `POST /prospects/batch` (~746): destructure `importLog`, write both log rows in one `db.batch` after the prospects loop, before `c.json`; add `GET /imports` (register with the other admin GETs, literal path).
- `src/worker/retention.ts` -- new sweep step in its own try/catch (pattern of `sweepAgentPositions`); add its count to `SweepResult` and `describeSweep`; may live in a new `src/worker/import-log.ts` with the read/settle logic.
- `src/worker/retention.test.ts`, `src/worker/admin.test.ts`, `src/shared/constants.test.ts` -- tests below; `src/worker/db/indexes.test.ts` for the `started_at` plan.
- `docs/api.md` (batch row line 42, new GET), `docs/data-model.md`, `docs/domains/ingestion.md`, `docs/security.md` (retention line), `docs/glossary.md` (« Journal des imports »), `docs/free-tier-budget.md` if the budget numbers move.

## Tasks & Acceptance

**Execution:**
- [ ] `src/worker/db/schema.ts` + `drizzle/` -- two tables and index, generated migration -- storage per ADR-0030
- [ ] `src/shared/constants.ts`, `src/shared/schemas.ts` -- constants, `importLog` field, response schema -- additive wire contract
- [ ] `src/worker/routes/admin.ts` -- log write on batch; `GET /imports` -- reads 20 newest, sums batches, settles, keeps five
- [ ] `src/worker/retention.ts` (+ helper) -- redact `created_by`/`file_name` past `RETENTION_DAYS`, bounded and idempotent, own try/catch, count in log line
- [ ] Tests -- every row of the I/O matrix, the `started_at` index plan, the budget test at 250 rows with the log field
- [ ] Docs -- the files listed in the Code Map

**Acceptance Criteria:**
- Given one `importId` across several batches, when the GET is read, then it shows one import with summed counts.
- Given a request without `importLog`, when imported, then nothing is logged and the response is unchanged.
- Given the budget tests, when run at 250 rows with the two extra inserts, then they pass.
- Given `pnpm typecheck`, `pnpm test`, `pnpm lint` and the build, then all pass.

## Implementation Notes

## Spec Change Log

## Review Triage Log

Pass 1 (blind-hunter, edge-case-hunter, verification-gap, intent-alignment): 1 high, 2 medium, 1 low patched; rest rejected or deferred.

| Verdict | Route | Finding and evidence |
|---|---|---|
| high | patch | Sweep update binds 100 ids plus 2 NULLs (`import-log.ts`). Confirmed with drizzle `toSQL()`: NULLs are params. Chunk now `D1_MAX_BOUND_PARAMS - 2`. |
| medium | patch | No test forced the log write to fail. Added a trigger-based test in `admin.test.ts`: 5xx, then a re-send logs one batch row. |
| low | patch | `retention.test.ts` comment sat above `ADMIN_EMAIL`; moved to `OLD`. |
| medium | defer | The visit sweep in `retention.ts:92` has the same 103-parameter pattern, pre-existing; issue #387. |
| false | reject | A failed log write skews a re-send to `updated`. ADR-0030 states this as a known limit. |
| false | reject | First batch's `batchCount`/`source`/`rejected` win; out-of-range rows could inflate `n`. ADR-0030 Consequences accept it: a convenience, not an audit. |
| false | reject | Tables grow without limit. ADR-0030 keeps counts for ever by decision. |
| low | reject | Index-plan test uses a hand-copied query; the index and its plan are checked, a fix adds complexity. |
| low | reject | Sweep-failure test string-matches SQL; it asserts the failure is logged by name. |
| low | reject | Plan test lives in `admin.test.ts` not `indexes.test.ts`; location only. |
| low | reject | No CPU-time test exists in the repo; the request-size budget test now carries `importLog`. Reported at presentation. |
| low | reject | Cap reuse for zone fields, free-text `source`/`fileName`, English refine message, boundary-at-`IMPORT_STALE_MS`, dead `startedAt` fallback: cosmetic, no named harm. |
| n/a | none | Intent-alignment: diff implements ADR-0030 as written; the client surface is ticket 8, by intent. |

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm test` -- expected: all pass
- `pnpm lint` -- expected: clean
- `pnpm build` -- expected: succeeds
- `pnpm db:migrate:local` -- expected: the new migration applies
