---
tracker_id: "365"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/365"
tracker_status: backlog
id: 2
type: story
title: "The import rail is shared by both paths"
parent: epic-import-a4-a6
covers: [R1, R7]
risk: low
---

# The import rail is shared by both paths

## Description

ImportStepper becomes the full-width rail (32px circles, « Étape n » / « En cours » overlines, gold line after a done step, only the current label at phone width) on the CSV and map paths, in ImportStepper.tsx, its placement in ImportScreen.tsx and adminCopy.import.steps in src/client/copy/admin.ts; the step lists stay as they are until entry 4 merges Fichier into Colonnes.

## Acceptance Criteria

Verify: Component tests assert the done, current and future states with the hidden « (terminée) » and aria-current="step"; on a local build the rail shows on both paths in light, dark and at phone width.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
