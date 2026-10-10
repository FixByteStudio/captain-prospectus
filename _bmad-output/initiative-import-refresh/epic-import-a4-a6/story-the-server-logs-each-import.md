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
---

# The server logs each import

## Description

Builds what entry 3's ADR decides: the D1 table and migration (d1-migration skill), the additive field on the batch request in src/shared/schemas.ts, the log write on each batch, a GET of the last 5 imports, and docs/api.md, data-model.md, domains/ingestion.md and the glossary; server and shared schema only, since entry 8 sends the field and reads the GET.

## Acceptance Criteria

Verify: Worker tests: batches with one import id give one log row with summed counts, a re-sent batch is not counted twice, a batch without the field still imports and logs nothing, and the GET returns the last 5 newest first.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md

## Notes

- Open question: The table and request shape wait on entry 3's ADR.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
