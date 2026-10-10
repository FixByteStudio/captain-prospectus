---
tracker_id: "372"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/372"
tracker_status: backlog
id: 8
type: story
title: "Both import paths send the import log"
parent: epic-import-a4-a6
covers: [R3]
after: [7, 10]
risk: medium
---

# Both import paths send the import log

## Description

useImportBatches sends ADR-0030's importLog on every batch (one crypto.randomUUID() importId per run, a retry being a new run, batchIndex, batchCount and rejected), with the CSV file name and rejected-row count from ImportScreen, and from MapStep the polygon's vertex count or the circle's radius and the unnamed-candidate count as rejected; entry 11 adds the imports query and its invalidation in useImportBatches.

## Acceptance Criteria

Verify: queries tests assert one importId across a run's batches, batchIndex 0..n-1, the batchCount, and a new importId on retry; on a local build, GET /api/admin/imports after a CSV import and an OSM map import returns both with their file name or zone and counts.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md
- adr — docs/adr/0030-the-server-keeps-an-import-log.md, section Decision

## Notes

- Assumption: on the map path `rejected` is the unnamed candidates only; likely duplicates the admin chose to skip are a choice, not a rejection (ingestion.md, ADR-0030).

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
