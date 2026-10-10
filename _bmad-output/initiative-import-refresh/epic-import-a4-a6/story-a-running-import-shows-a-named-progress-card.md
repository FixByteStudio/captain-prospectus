---
tracker_id: "370"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/370"
tracker_status: backlog
id: 10
type: story
title: "A running import shows a named progress card"
parent: epic-import-a4-a6
covers: [R6]
after: [6]
risk: medium
---

# A running import shows a named progress card

## Description

While batches run, a progress card floats bottom right over entry 5's bottom bar with « Import en cours », the tabular count and an ink Progress bar through a new variant on src/client/ui/progress.tsx (other callers, including the field DailyProgress, stay gold), and both import progress bars (PreviewStep and MapStep) get an aria-label from adminCopy.import, closing #231. The `beforeunload` guard keeps holding while `isRunning`. Assumption: MapStep's bar takes the ink variant too, since the gold exception covers only daily progress and Taux de conversion. Entry 8 builds on this entry's MapStep and ImportScreen changes.

## Acceptance Criteria

Verify: Tests assert Retour and « Importer {n} lignes » are disabled while running and that both progressbars have an accessible name; on a local build the card matches the mockup in light, dark and at phone width; the PR quotes the field precache total against 1,000 KiB.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
