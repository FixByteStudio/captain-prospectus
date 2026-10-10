---
tracker_id: "390"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/390"
tracker_status: backlog
id: 11
type: story
title: "Source lists the last five imports"
parent: epic-import-a4-a6
covers: [R3, R7, R8]
after: [8]
risk: medium
---

# Source lists the last five imports

## Description

Source shows Derniers imports under the cards from GET /api/admin/imports (the response type in src/shared/schemas.ts) through a new adminKeys.imports() query that this entry also invalidates in useImportBatches' finally, after entry 8 sends the log: History head icon; Date & heure; Source with a FileSpreadsheet or Map icon (csv « CSV », osm « Carte OpenStreetMap », google « Carte Google », the raw value otherwise); Fichier ou zone (the file name, blank once redacted, or copy.map.vertices / copy.map.circle.radius); Volume right-aligned in .tnum (« +{c} créés · {u} mis à jour · {r} rejetés »); Par (blank once redacted); Statut badge (« Terminé » success tint, « Interrompu » warn tint); the empty state; two-line rows without Par at phone width; and it drops design.md's « Nothing records an import today » line.

## Acceptance Criteria

Verify: Component tests cover both badges, every source label and the fallback, the zone labels, a redacted row and the empty state; on a local build, after a CSV and a map import the table lists both newest first with « Terminé »; a 300-row import run under a very slow custom DevTools throttling profile, with the tab closed once the card shows 250 / 300, reads « Interrompu » when Source is reloaded after IMPORT_STALE_MS (5 min) (or seed a part-finished import with wrangler d1 execute --local); an empty database shows « Aucun import pour l'instant. »; light, dark and phone width match the mockup.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md
- adr — docs/adr/0030-the-server-keeps-an-import-log.md, sections Decision and Retention
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md, section Components › Admin, Derniers imports

## Notes

- Assumption: the radius reuses Zone's `copy.map.circle.radius`, which reads « Rayon 1,5 km » at 1,000 m and above, not the spine's « Rayon {300} m » form.
- « Carte Google » rows need GH #362 closed first.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
