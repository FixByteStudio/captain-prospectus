# ADR-0030: The server keeps an import log

- Status: accepted
- Date: 2026-10-10
- Deciders: owner

## Context

The Import screen's Source step lists the last five imports (epic #363, R3): when, from
which source, which file or zone, how many prospects were created, updated and rejected,
who ran it, and whether it finished. Nothing records an import today.

- **The server sees only batches.** An import is many `POST /api/admin/prospects/batch`
  calls of at most `IMPORT_ROWS_PER_REQUEST` (250) rows, sent one after the other by
  `useImportBatches`. No request says "this is the same import" or "this is the last one".
- **Rejected rows never arrive.** The browser drops them in the preview (`ingestion.md`), so
  only the client knows that count. The file name and the zone's size are client facts too.
- **A re-sent batch changes its own answer.** The upsert reports `created` the first time and
  `updated` the second, so adding up the responses of a retried batch counts it twice, and
  as the wrong kind (INVARIANT 4).
- **A closing call cannot be relied on.** An import is interrupted precisely when the tab
  closes, the network drops or a batch fails, which is when the client cannot say so.
- **A log row names an admin**, which is personal data in the sense of
  [ADR-0023](0023-retention-by-redaction.md).
- Every write is bounded by the Workers Free CPU budget (INVARIANT 13) and D1's 100 bound
  parameters (INVARIANT 7); the log adds a handful of small statements per batch.

## Decision

We will **log each import from the batches the server already receives**, with no new
call and no change for a client that does not send the new field.

**Grouping.** `POST /api/admin/prospects/batch` takes an optional `importLog` object:
`{ importId, batchIndex, batchCount, rejected, fileName?, zoneVertices?, zoneRadiusM? }`.
`importId` is a `crypto.randomUUID()` the client makes once per run; `batchIndex` is 0-based
and below `batchCount`; `rejected`, `zoneVertices` and `zoneRadiusM` are non-negative
integers (capped by the zod schema in `src/shared/schemas.ts`, written in `zod/mini` per INVARIANT 6: `batchCount` ≤ 10 000, `fileName` ≤ the shared short-text length); `fileName` is the CSV's name. The field is additive (INVARIANT 9): a request
without it imports exactly as before and logs nothing. A retry of a failed run is a new
run with a new `importId`.

**Storage.** Two tables, both with client ids and `onConflictDoNothing` inserts
(INVARIANT 4), written together in one `db.batch` after the prospects:

- `imports` (`id` PK = `importId`, `source`, `file_name`, `zone_vertices`, `zone_radius_m`,
  `rejected`, `batch_count`, `created_by`, `started_at`). Written by whichever batch of the
  run arrives first; the other batches' copies of these fields are ignored. `source` is the
  batch's own `source` and is not an enum, so « Carte Google » needs no migration.
  `started_at` is that first batch's `now`, never a client clock.
- `import_batches` (`import_id`, `batch_index`, `created`, `updated`, `received_at`),
  primary key `(import_id, batch_index)`.

An import's counts are the **sum over its `import_batches` rows**; nothing is updated in
place, so there is no counter to get wrong under a retry. French labels (« {7} sommets »,
« Rayon {300} m ») are built by the client from `zone_vertices` and `zone_radius_m`
([ADR-0013](0013-frontend-conventions.md)).

**Counting a re-sent batch once.** The batch row is inserted `onConflictDoNothing` on
`(import_id, batch_index)`, after the prospects are written. A re-sent batch keeps the
counts of its first arrival and still answers with the live `{created, updated}`, so the
progress card is unaffected. If the log write fails, so does the request; the client's
"resend the whole file" advice stays safe because the upsert is idempotent. Known limit: when
the prospects were written but the log was not, a re-send logs `updated` instead of
`created` for that batch. The log undercounts creations in that rare case; it is not an audit.

**Status is derived on read, never stored.** For an import with `n` batch rows out of
`batch_count`:

| State | Reads |
|---|---|
| `n = batch_count` | « Terminé » |
| `n < batch_count` and the newest `received_at` is older than `IMPORT_STALE_MS` (5 min) | « Interrompu » |
| `n < batch_count` and newer than that | not listed: the import is still running and the progress card owns it |

An import whose first batch fails leaves no row, which is correct: nothing was imported.
Because the status is a function of the rows and the clock, no job has to notice an
interruption and nothing can leave an import "running" for ever. `IMPORT_STALE_MS` is a
constant in `src/shared/constants.ts`; changing it needs no migration.

**Read route.** `GET /api/admin/imports` returns the five newest settled imports, newest
`started_at` first: `{ imports: [{ id, source, fileName, zoneVertices, zoneRadiusM, created,
updated, rejected, createdBy, startedAt, status: "done" | "interrupted" }] }`. It has no
paging or filters; an index on `imports(started_at)` serves it. To stay bounded it reads the 20 newest `imports`
rows, sums their `import_batches`, settles them and keeps five; an older import is never
settled late into the list.

**Retention.** A row is kept for ever (the counts are business history, like a visit's
outcome) and its personal parts are redacted with the visits: the existing daily sweep sets
`created_by` and `file_name` to NULL once `started_at` is older than `RETENTION_DAYS`,
bounded by its own batch constant and idempotent, in its own try/catch like the other sweeps so
a failure never stops visit redaction. This extends ADR-0023's redaction to a second table;
`docs/security.md`'s retention line names it. `prospects.created_by` is a business record of
who added a place and is kept, unlike a log row's per-run file name ([ADR-0023](0023-retention-by-redaction.md)).
`created_by` and `file_name` are therefore nullable, and the screen reads an empty « Par »
and file as blank. `import_batches` holds no personal data and is never redacted.

**Glossary.** *Import log* (FR « Journal des imports »): the server's record of one
import, built from its batches. Not the same word as *Import*, which is the act.

## Alternatives considered

| Option | Why not |
|---|---|
| The client records the import in one call when it finishes | The one case that matters, an interrupted import, is the case where the call never happens, so « Interrompu » could not exist |
| A start call and a finish call around the batches | Two new routes and a state machine for the interrupted case anyway; an import abandoned between them stays "running" until a job closes it |
| Store a running `created`/`updated` total on `imports` and add each batch | A retried batch is added twice (it answers `updated` the second time), and making the add idempotent needs the per-batch key this ADR stores anyway |
| Keep the log only on the client, in Dexie | It would show one browser's imports, not every admin's, and Dexie is the field app's cache plus outbox (ADR-0007), not the admin's record of truth |
| Derive imports from `prospects.created_at` and `source` | Cannot say what was updated, rejected, or abandoned, nor the file or zone; two imports in the same minute are indistinguishable |
| Keep `created_by` and `file_name` for ever | A file name can name a customer or a person, and the admin's email is an identity; the screen needs only the last five |

## Consequences

- Two new tables and one additive request field: entry 7 writes the migration
  (expand-only, so the deployed Worker keeps working), the schema, the log write and the
  GET, and updates `api.md`, `data-model.md`, `domains/ingestion.md` and the glossary.
- Entry 8 sends `importLog` from `useImportBatches` for both paths and reads the GET.
- **« Interrompu » takes up to five minutes to appear**, and a phone-width admin watching a
  stalled import sees nothing on Source until then. A slow but live import is never
  mislabelled, as long as one batch finishes inside the window.
- An import of at most 250 rows is one batch and cannot be interrupted in the log's eyes: it
  either arrives whole or not at all.
- A client that sends inconsistent `batchCount`, `rejected` or file fields across one run
  keeps the first batch's values. The log is a convenience for the admin, not an audit trail.
- Entry 7 must re-run the budget tests in `constants.test.ts`: the log adds two inserts per
  batch, and 250 rows stays only if they still fit INVARIANT 13.
- The retention sweep gains a second table to cover, and its log line gains a count.
- Rows from before the migration do not exist; the first screen shows « Aucun import pour
  l'instant. ».
