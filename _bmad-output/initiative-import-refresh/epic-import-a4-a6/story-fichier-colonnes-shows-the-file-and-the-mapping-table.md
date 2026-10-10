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
---

# Fichier & colonnes shows the file and the mapping table

## Description

The step opens with the file card, whose « Changer de fichier » reuses entry 4's file-reading handler, then the mapping table with Exemple, Statut chips, « Ignoré » rows and the head and foot counters, and a bottom bar component (Retour secondary, « Étape 2 sur 3 », « Voir l'aperçu ») that entries 6 and 10 reuse; it corrects design.md's « outline » Retour to secondary.

## Acceptance Criteria

Verify: Tests assert each chip rule (Requis, Coordonnées GPS, Clé unique, Détecté, Optionnel, Ignoré) and that « Voir l'aperçu » stays disabled until Nom has a column; on a local build the step matches the mockup in light and dark and shows one block per field at phone width.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
