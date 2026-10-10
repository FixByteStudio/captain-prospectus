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
refined: true
---

# A running import shows a named progress card

## Description

While batches run, a progress card floats bottom right over entry 5's bottom bar on Aperçu & validation: « Import en cours », the count in tabular figures, and an ink Progress bar.

The ink bar is a new variant of the shared Progress element. Every other caller, including the field's daily progress and Taux de conversion, stays gold. The map path's bar takes the ink variant too, but no floating card, since Zone has no bottom bar.

Both import progress bars (Aperçu & validation and Zone) get an accessible name from the admin copy, which closes #231. What is already true stays: Retour and « Importer {n} lignes » are disabled while running, and the `beforeunload` guard holds while `isRunning`. Entry 8 builds on this entry's Zone and ImportScreen changes.

## Acceptance Criteria

Verify: Tests assert that the card shows « Import en cours » and the done / total count while running and goes when the import ends; that both import progress bars have an accessible name and use the ink variant; that the field's daily progress bar is still gold; and that Retour and « Importer {n} lignes » stay disabled while running. On a local build the card matches the mockup in light, dark and at phone width. The PR quotes the field precache total against 1,000 KiB.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md
- issue — https://github.com/FixByteStudio/captain-prospectus/issues/231
- design — docs/design.md, section "The CSV import", bullet "Running"

## Notes

- Decision (2026-10-10): the Zone bar takes the ink variant too; gold progress stays reserved for daily progress and Taux de conversion.
- Decision (2026-10-10): #231 was closed by accident by #374 and reopened; this ticket closes it.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
