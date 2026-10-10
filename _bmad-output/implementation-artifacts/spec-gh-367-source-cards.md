---
title: 'Source offers two source cards'
type: 'feature'
created: '2026-10-10'
status: 'done'
route: 'oneshot'
route_source: 'auto'
baseline_commit: '9e2b6ac69f6459302a183da85a9dddb03cfbd2e6'
review: 'none'
review_source: 'auto'
lenses_ran: []
review_loop_iteration: 0
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

Issue #367 (story 4 of epic-import-a4-a6, R2, R1 and R7): SourceStep becomes the two source cards of DESIGN.md › `source-card`. The CSV card's « Importer un fichier » opens the file picker straight away; a file that is unreadable, has no header or has no rows stays on Source with the destructive Alert under the cards. The file-reading handler moves to Source so entry 5's « Changer de fichier » can reuse it. FileStep goes away: the CSV path is Source · Fichier & colonnes · Aperçu & validation, today's ColumnsStep is step 2, and Retour on it goes back to Source. « Dessiner une zone » opens Zone. The cards stack below md.

</frozen-after-approval>

## Implementation Notes

- Oneshot: client-only, one screen, under ~250 lines of change.
- Files: `SourceStep.tsx` (two cards, file input, Alert), `read-csv-file.ts` (new, the reusable reader), `ImportScreen.tsx` (FileStep and the `file` step removed), `FileStep.tsx` (deleted), `copy/admin.ts`, `ImportScreen.test.tsx`.
- Not done: no review subagent was run (none was authorised for this run), and the local-build visual check (light, dark, below md) was not made.
- Verified: `pnpm typecheck`, `lint`, `test` (2559) and `build` (precache 948.66 KiB) pass.
- The map card's tag and the `.csv` chip are copy only; the map card has no format chip.
