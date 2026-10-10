---
tracker_id: "368"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/368"
tracker_status: backlog
id: 5
type: story
title: "Fichier & colonnes shows the file and the mapping table"
parent: epic-import-a4-a6
covers: [R4, R7, R8]
after: [4]
risk: medium
refined: true
---

# Fichier & colonnes shows the file and the mapping table

## Description

The step opens with the file card. Its « Changer de fichier » reuses entry 4's file reader. A good file replaces the current one and re-guesses the columns. A file that is unreadable, has no header or has no rows keeps the current file and mapping, and shows the destructive Alert under the file card.

Then the mapping table: Exemple, the Statut chips, the « Ignoré » rows, and the head and foot counters. Last, a bottom bar component (Retour secondary, « Étape 2 sur 3 », « Voir l'aperçu ») that entries 6 and 10 reuse. It corrects design.md's « outline » Retour to secondary.

## Acceptance Criteria

Verify: Tests assert each chip rule (Requis, Coordonnées GPS, Clé unique, Détecté for any mapped column, Optionnel, Ignoré); that « Voir l'aperçu » stays disabled until Nom has a column; that « Changer de fichier » with a good file re-guesses the columns; and that a bad one keeps the current file and shows the Alert. On a local build the step matches the mockup in light and dark, and shows one block per field at phone width.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md
- copy — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, row "Import › Fichier & colonnes" and component pattern "Fichier & colonnes"
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md, Components › Admin, "Fichier & colonnes"

## Notes

- Decision (2026-10-10): « Détecté » marks any field that has a column, guessed or picked by hand, so every row keeps one chip.
- Decision (2026-10-10): a bad file from « Changer de fichier » stays on this step, keeps the current file and mapping, and shows the Alert under the file card.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
