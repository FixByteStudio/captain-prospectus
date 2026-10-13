---
title: 'The import result dialog reports the rejected count the run sent'
type: 'bugfix'
created: '2026-10-12'
status: 'done'
baseline_commit: '9ac1d29b39601d723a57d0724a812bd8241b235d'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic #363 retro, F3 / action 2 (`epic-363-retro-2026-10-12.md`). After a CSV file is read, Retour on Fichier & colonnes goes back to Source without clearing `parsed` (`ImportScreen.tsx:142`), so a map import started from there shows the CSV file's rejected lines in « Import terminé » (`ResultDialog` takes `rejected.length` at `:173`), while the import log was sent the map's own count. The dialog and Derniers imports then disagree. The map path's unnamed places, which the log counts as rejected (`MapStep.tsx:340`), never appear in the dialog. Also, `onParsed` (`:72-78`) never sets the fork back to `"csv"`, so a file read that finishes after « Dessiner une zone » would stamp CSV rows with the map's source.

**Approach:** The dialog shows the rejected count the run itself sent with its import log, so it always matches Derniers imports. `useImportBatches` keeps `log.rejected` beside the server's totals. The dialog words it per path: « n lignes rejetées » on CSV, and on the map path the unnamed places as rejected (owner's decision, 2026-10-12). `onParsed` sets the fork to `"csv"`.

</frozen-after-approval>

## Tasks & Acceptance

**Execution:**
- [x] `src/client/admin/queries.ts` -- `useImportBatches` result carries `rejected` from the run's `log` -- one source for the dialog and the log
- [x] `src/client/admin/import/ResultDialog.tsx` -- drop `rejectedCount`; read `result.rejected`; pick the wording from the run's `source` -- no count from another path's state
- [x] `src/client/copy/admin.ts` -- `copy.import.result.unnamed(n)`: « 1 lieu sans nom rejeté » / « {n} lieux sans nom rejetés » -- invariant 15
- [x] `src/client/admin/import/ImportScreen.tsx` -- `onParsed` sets the fork to `"csv"`; stop passing `rejected.length` to `ResultDialog` -- F3's two halves
- [x] `src/client/admin/import/ImportScreen.test.tsx` -- a file read held open past « Dessiner une zone » lands on the three-step CSV rail -- pins the fork half
- [x] `src/client/admin/import/MapStep.test.tsx` -- file with a rejected line → Retour → « Dessiner une zone » → search (one named, one unnamed) → import: the dialog names one unnamed place and no CSV line; a map import with no unnamed place names none -- pins F3
- [x] `docs/design.md`, `docs/domains/ingestion.md` -- the result's rejected count is the one sent with the log; on the map path, the unnamed places -- the doc owning the rule

**Acceptance Criteria:**
- Given a CSV file with 4 rejected lines read and left by Retour, when a map import with no unnamed place finishes, then « Import terminé » shows no rejected count.
- Given a map search with 1 unnamed place, when the import finishes, then the dialog reads « 1 lieu sans nom rejeté » and the log sent `rejected: 1`.
- Given a CSV import with 1 rejected line, when it finishes, then the dialog still reads « 1 ligne rejetée ».

## Implementation Notes

Oneshot: about 40 lines over five files plus one test, no contract or schema change. `ImportResult` (the server's answer) stays as it is; the run's result is a client type.

- `ImportRunResult` (`queries.ts`) carries the run's `source` and `rejected` beside the server's totals. The dialog words the count from `source` (`csv` → « lignes rejetées », `osm`/`google` → « lieux sans nom rejetés »), so count and wording both come from the run, never from live screen state. This replaced a first draft that passed the screen's `fork` (review finding 2).
- Both new tests fail on `9ac1d29` (checked by reverting the screen and dialog, then the fork line) and pass with the fix.
- Checks: typecheck, lint, 102 files / 2,675 tests, build green; precache 25 entries, 952.77 KiB (admin-only change, unchanged).

## Review Triage Log

Quick lens, one pass: 0 high, 0 medium, 3 low (all patched), 0 false. No unmet AC or broken rule.

1. **low, patch.** `onParsed`'s `setFork("csv")` had no test; the race is reachable (`SourceStep.read` is async and « Dessiner une zone » stays enabled). Added the held-read test in `ImportScreen.test.tsx`; it fails without the line.
2. **low, patch.** The wording followed the live `fork` while the count followed the run. Not reachable today (closing the dialog calls `startOver`), but the fix was one field: the run's `source` now picks the wording and the `fork` prop is gone.
3. **low, patch.** The map test's no-CSV-leak check matched one exact count. It now rejects any « ligne(s) rejetée(s) ».

## Verification

**Commands:**
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` -- expected: green; precache total quoted is not needed (admin route).
