---
title: 'Fichier & colonnes shows the file and the mapping table (GH #368)'
type: 'feature'
created: '2026-10-10'
status: 'in-review'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_commit: 'ccd8b37ac8a2bd6a7068ff32ffc8aa07087490af'
context:
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Step 2 of the CSV import is still a plain select list. The owner cannot see the file, its size or line count, a change-of-file action, the example value per field, or what each field's status is.

**Approach:** Rebuild `ColumnsStep` as a file card plus a mapping table (Champ · Colonne du fichier · Exemple · Statut), with « Ignoré » rows for unused file columns, head and foot counters, and a reusable bottom bar (Retour secondary, « Étape 2 sur 3 », « Voir l'aperçu ») that stories #6 and #10 reuse. « Changer de fichier » reuses `readCsvFile`.

## Boundaries & Constraints

**Always:** All French strings in `src/client/copy/admin.ts`. Tailwind tokens only; shadcn elements from `src/client/ui/`. File is read in the browser, never uploaded. « Détecté » marks any field that has a column (guessed or hand-picked) other than the fields with their own chip. At phone width each field is one block.

**Never:** Change Zone, `MapCanvas`, the preview/import behaviour or any server code. No new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Chip rules | Nom, Latitude, Longitude, Identifiant source; other fields | « Requis »; « Coordonnées GPS » ×2; « Clé unique »; others « Détecté » if mapped else « Optionnel » | — |
| Unused column | File header feeding no field | Muted row with « Ignoré » | — |
| No Nom column | `columns.name` unset | « Voir l'aperçu » disabled | — |
| Good new file | « Changer de fichier » with readable file | File card shows new name/size/lines; columns re-guessed | — |
| Bad new file | Unreadable, headerless or empty | Current file and mapping kept; destructive Alert under the file card | Message from `readCsvFile` |

</frozen-after-approval>

## Code Map

- `src/client/admin/import/ColumnsStep.tsx` -- rebuilt: file card, mapping table, counters, bottom bar use
- `src/client/admin/import/ImportBottomBar.tsx` -- new shared bar (Retour, « Étape n sur 3 », primary action)
- `src/client/admin/import/ImportScreen.tsx` -- keeps file size; `onParsed` gains size; passes `onReplaceFile`
- `src/client/admin/import/SourceStep.tsx` -- `onParsed` signature gains the size
- `src/client/admin/import/read-csv-file.ts` -- reused as is
- `src/client/admin/import/csv.ts` -- `MAPPABLE_FIELDS`, `sampleFor`, `guessColumns`
- `src/client/copy/admin.ts` -- `import.columns` copy
- `docs/design.md` -- Retour on this bar is secondary, not outline

## Tasks & Acceptance

**Execution:**
- [ ] `copy/admin.ts` -- add chips, Exemple, Statut, field hints, counters, « Changer de fichier », « Étape n sur 3 », Ignoré copy
- [ ] `ImportBottomBar.tsx` -- shared bar
- [ ] `ColumnsStep.tsx` -- file card, table, Ignoré rows, counters, phone blocks
- [ ] `ImportScreen.tsx` / `SourceStep.tsx` -- carry file size; replace-file handler
- [ ] `ImportScreen.test.tsx` (+ a ColumnsStep test) -- chip rules, disabled button, good and bad replacement
- [ ] `docs/design.md` -- Retour secondary

**Acceptance Criteria:**
- Given a mapped file, when step 2 opens, then each chip rule holds and the counters read « {n} champs configurés sur 9 » and « {rows} lignes à traiter · {m} colonnes associées ».
- Given a bad replacement file, when chosen, then the current file and mapping stay and the Alert shows under the file card.

## Implementation Notes

Implemented directly (no subagent). `onParsed` now takes the `File` so size reaches the file card; `ImportBottomBar.tsx` is the shared bar; `formatFileSize` added to `format.ts`. Ignoré rows show a static « Ne pas importer » rather than a Select. Typecheck, lint, 2576 tests and build pass; precache 948.96 KiB. Not checked in a browser against the mockup.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all pass
