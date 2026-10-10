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
---

# Source offers two source cards

## Description

SourceStep becomes the two source cards; the CSV card's button opens the file picker, parse errors show under the cards, and the file-reading handler moves to Source, where entry 5's « Changer de fichier » reuses it; FileStep goes away, so the CSV path becomes Source · Fichier & colonnes · Aperçu & validation with today's ColumnsStep as step 2 until entry 5 rebuilds it.

## Acceptance Criteria

Verify: ImportScreen tests: a file picked from the CSV card lands on step 2 of 3, an empty file shows the Alert on Source, « Dessiner une zone » opens Zone; on a local build the cards match the mockup in light and dark and stack below md.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
