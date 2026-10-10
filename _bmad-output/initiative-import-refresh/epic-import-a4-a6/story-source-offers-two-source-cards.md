---
tracker_id: "367"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/367"
tracker_status: backlog
id: 4
type: story
title: "Source offers two source cards"
parent: epic-import-a4-a6
covers: [R2, R1, R7]
after: [2]
risk: medium
refined: true
---

# Source offers two source cards

## Description

SourceStep becomes the two source cards. The CSV card's « Importer un fichier » opens the file picker straight away. A file that is unreadable, has no header or has no rows stays on Source, with the destructive Alert under the cards. The file-reading handler moves to Source, so entry 5's « Changer de fichier » can reuse it.

FileStep goes away. The CSV path becomes Source · Fichier & colonnes · Aperçu & validation, with today's ColumnsStep as step 2 until entry 5 rebuilds it. Retour on step 2 goes back to Source.

## Acceptance Criteria

Verify: ImportScreen tests: a file picked from the CSV card lands on step 2 of 3; an unreadable, header-less or empty file shows the Alert on Source; Retour on step 2 returns to Source; « Dessiner une zone » opens Zone. On a local build the cards match the mockup in light and dark, and stack below md.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md
- copy — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, rows "Import › Source, CSV card" and "Import › Source, map card"
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md, component `source-card`

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
