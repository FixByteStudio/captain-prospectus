---
tracker_id: "372"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/372"
tracker_status: backlog
id: 8
type: story
title: "Source lists the last five imports"
parent: epic-import-a4-a6
covers: [R3, R7, R8]
after: [7, 10]
risk: medium
---

# Source lists the last five imports

## Description

Both paths send the import details entry 7 accepts (CSV file name and rejected count; map vertex count or radius) through useImportBatches, and Source shows Derniers imports from entry 7's GET, with the empty state and the phone rows; it drops design.md's « Nothing records an import today » line, and comes after 10 because it touches ImportScreen and MapStep.

## Acceptance Criteria

Verify: On a local build, after a CSV and a map import the table lists both newest first with « Terminé »; a 300-row import with the batch request blocked in devtools after the first batch reads « Interrompu »; an empty database shows « Aucun import pour l'instant. ».

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
