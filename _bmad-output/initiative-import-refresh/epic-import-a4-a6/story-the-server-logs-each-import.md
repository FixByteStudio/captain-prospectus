---
tracker_id: "371"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/371"
tracker_status: backlog
id: 7
type: story
title: "The server logs each import"
parent: epic-import-a4-a6
covers: [R3]
after: [3]
risk: medium
refined: true
---

# The server logs each import

## Description

Builds what ADR-0030 decides, server and shared schema only; entry 8 sends the field and reads the route.

- The `imports` and `import_batches` tables and their expand-only migration (d1-migration skill), with the index on `imports(started_at)`.
- The optional `importLog` field on POST /api/admin/prospects/batch. A request without it imports as before and logs nothing.
- The log write after the prospects, in one batch. A re-sent batch keeps its first counts and still answers the live created and updated.
- GET /api/admin/imports: the five newest settled imports, newest first, with the status worked out when reading: « Terminé » when every batch arrived, « Interrompu » when some are missing and the newest is older than `IMPORT_STALE_MS`, not listed while still running.
- The daily cleanup job blanks `created_by` and `file_name` after `RETENTION_DAYS`, in its own try/catch.
- The CPU budget tests run again with the two extra inserts per batch.
- docs/api.md, data-model.md, domains/ingestion.md, security.md (retention) and the glossary's « Journal des imports ».

## Acceptance Criteria

Verify: Worker tests: one `importId` across several batches gives one import with summed counts; a re-sent batch is counted once; a batch without `importLog` imports and logs nothing; the GET returns at most five settled imports, newest first; a complete import reads done, one with missing batches past `IMPORT_STALE_MS` reads interrupted, and a running one is absent; the cleanup job blanks `created_by` and `file_name` past `RETENTION_DAYS` and leaves the counts; the budget tests still pass at 250 rows.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md
- adr — docs/adr/0030-the-server-keeps-an-import-log.md
- adr — docs/adr/0023-retention-by-redaction.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
