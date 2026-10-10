---
tracker_id: "369"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/369"
tracker_status: backlog
id: 6
type: story
title: "Aperçu & validation counts and filters the rows"
parent: epic-import-a4-a6
covers: [R5]
after: [5]
risk: medium
---

# Aperçu & validation counts and filters the rows

## Description

The preview gets the summary banner with the separator chip, the two count cards with share chips, « Prêt » / « Sans coordonnées » and reason chips in the ledger, and the « Toutes les lignes » / « Voir les {n} erreurs » filter, on entry 5's bottom bar with « Étape 3 sur 3 » and « Importer {n} lignes ». What PreviewStep already does stays: `STATUS_EDGE`, rejected rows first and struck through, `formatCoordinate` and `formatCount`. No per-row checkboxes and no created/updated forecast.

## Acceptance Criteria

Verify: Tests assert the counts and shares, that the filter shows only rejected rows, and that rejected rows come first; on a local build the step matches the mockup in light, dark and at phone width.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
