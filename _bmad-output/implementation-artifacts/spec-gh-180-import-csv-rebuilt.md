---
title: 'Import rebuilt: the CSV path (GH #180)'
type: 'feature'
created: '2026-09-28'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '2e6fe0b9f8ab2ae3d3e152b1e752897bef1c26bf'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-174-context.md'
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Import's CSV path predates the #175 primitives: a text-only stepper, hand-spelled panels and status edges, raw `toFixed(4)` coordinates (#154), an inline French `aria-label="Étapes"` (`ImportScreen.tsx:107`), no DOM test, and no `docs/design.md` section. The UX spine's "Import running" row requires a browser confirmation before leaving, which the code has never had, and its "failed mid-way" Alert must name how many rows went in, which it does not.

**Approach:** Rebuild Source, Fichier, Colonnes and Aperçu on ScreenHeader / Surface with a numbered stepper component (done: ink circle + check; current: gold fill, navy text, primary-edge; future: secondary), shared with the map path's two-step rail. Keep every behaviour; add the `beforeunload` guard while an import runs and the row count in the failure Alert.

## Boundaries & Constraints

**Always:** File parsed in the browser, never uploaded. Rejected rows first, struck through, `STATUS_EDGE.rejected`, reason shown; ready rows `STATUS_EDGE.new`. 250-row batches via `useImportBatches` unchanged. "Import terminé" dialog with created · updated · rejected and "Terminer" / "Voir les prospects". Coordinates via `formatCoordinate`, joined " · ". Counts in import copy via `formatCount`. Every French string in `copy.ts`; tokens only; one gold action per view. Admin stays out of the precache.

**Never:** No change to MapStep / MapCanvas content (#181) beyond the shared stepper above it; #167 stays open because MapStep's edges stay hand-spelled. No worker, schema or sync change. No new dependency. No import history, "Terminé" fourth step, encoding badges or other Stitch inventions (EXPERIENCE.md excludes import history).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fork CSV | Source, pick "Un fichier CSV" | stepper Source ✓ · Fichier (current) · Colonnes · Aperçu | No error expected |
| Fork map | Source, pick "Une zone sur la carte" | stepper Source ✓ · Zone (current), two steps only | No error expected |
| Stepper a11y | any step | `nav` labelled from `copy.import.steps.label`; current has `aria-current="step"`; a done step's check is not the only cue (label + sr text) | No error expected |
| Preview with rejects | CSV with a nameless row and a valid row at 50.8466 / 4.3528 | rejected row first, name struck through, reason « Nom manquant »; valid row shows `50,8466 · 4,3528` | No error expected |
| Running | click « Importer N lignes », first batch pending | Progress bar + « Import en cours : 0 / N »; Retour and Importer disabled; a `beforeunload` event is cancelled | No error expected |
| 300 rows | two batches | second POST after the first; progress reads « 250 / 300 » between | No error expected |
| Done | all batches answer | « Import terminé » dialog: « X prospects créés · Y mis à jour · Z lignes rejetées »; `beforeunload` no longer cancelled; « Terminer » returns to Source | No error expected |
| Failed mid-way | 2nd batch 500 | Alert naming the 250 rows already sent, idempotent-retry sentence; button reads « Réessayer » | retry re-sends from the start |
| Unreadable / empty file | bad file | destructive Alert on Fichier, stays on Fichier | shown inline |

</frozen-after-approval>

## Code Map

- `src/client/admin/import/ImportScreen.tsx` -- owns step, fork, parsed/columns state and the stepper `nav` (line 108, inline `aria-label`). Replace the nav with `<ImportStepper steps current />`; register `beforeunload` (`preventDefault` + `returnValue = ""`) in an effect keyed on `importer.isRunning`, removed on stop/unmount.
- new `src/client/admin/import/ImportStepper.tsx` -- numbered circles joined by a line (design.md › Stepper spine: DESIGN.md:368). Done `bg-foreground text-background` + lucide `Check`, current `bg-primary text-primary-foreground border-primary-edge`, future `bg-secondary text-muted-foreground`. `<ol>` in a `nav`; sr-only « terminée » on done steps.
- `SourceStep.tsx` -- keep the divided-row fork (no cards, design.md), inside `Surface`; add an icon tile per choice (lucide `FileSpreadsheet`, `Map`).
- `FileStep.tsx` -- `Surface` with a file icon tile, the gold choose button, the never-uploaded hint.
- `ColumnsStep.tsx` -- `Surface`; overline header row (Champ / Colonne du fichier / Première ligne); sample in its own column; Retour secondary, « Voir l'aperçu » gold.
- `PreviewStep.tsx` -- display-type tallies (`formatCount`), table in `Surface`, `cn(STATUS_EDGE.x, …)` from `src/client/admin/status.ts:15`, coordinates via `formatCoordinate` (`src/client/format.ts:74`) + `copy.fieldProspect.positionSet`. Failure Alert names `progress.done`.
- `ResultDialog.tsx` -- behaviour unchanged; counts through fr-FR copy.
- `src/client/admin/queries.ts:210` `useImportBatches` -- read-only; `progress.done` already counts sent rows at failure.
- `src/client/copy.ts:306` `import` -- add `steps.label`, `steps.done`, `columns.head.*`, `failedAfter(n)`; route counts through `formatCount`.
- `MapStep.tsx` -- untouched; the ImportScreen passes it the same stepper.
- Tests: pattern from `src/client/admin/VisitsScreen.test.tsx` (QueryClientProvider + `createAdminQueryClient`, MemoryRouter, fetch stub). `vi.mock("./MapCanvas")` so the map fork renders in happy-dom. Upload with `userEvent.upload` on the hidden file input.
- `docs/design.md:570` -- add `### The CSV import` before "The map import": stepper, four steps, preview rules, running/done/failed states.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/copy.ts` -- new import strings, fr-FR counts
- [x] `src/client/admin/import/ImportStepper.tsx` -- numbered stepper
- [x] `src/client/admin/import/ImportScreen.tsx` -- stepper, `beforeunload`
- [x] `src/client/admin/import/{Source,File,Columns,Preview}Step.tsx`, `ResultDialog.tsx` -- rebuild on Surface, STATUS_EDGE, formatCoordinate, failure count
- [x] `src/client/admin/import/ImportScreen.test.tsx` -- every matrix row
- [x] `docs/design.md` -- CSV import section
- [x] `gh issue close 154` at PR time; comment on #167 that the CSV side is done and MapStep's three remain for #181

**Acceptance Criteria:**
- Given `pnpm test`, when the suite runs, then ImportScreen DOM tests cover the stepper fork, a rejected-row preview, the running state, the result dialog and the failure Alert, and every existing test passes unchanged.
- Given `pnpm build`, when the precache manifest is read, then its total is quoted against 1,000 KiB and no admin chunk is precached.

## Implementation Notes

- Implemented by the pwa-engineer subagent. Orchestrator fixes after reading the diff: the test file covered only part of the matrix, so it was rewritten to pin every row — the bad-file Alert, rejected-first order and strike-through, Importer disabled while running, « 250 / 300 » between batches (second batch held pending), the guard released after Done and after a failure, retry re-sending `[250, 50, 250, 50]`, and the stepper's sr-only « terminée » and `aria-current`. Also: the lucide `Map` import renamed `MapIcon` (it shadowed the global), an unused `columns.head.sample` string dropped (the sample stays under each select, as before, rather than a third column), and two wrong cross-references in design.md fixed.
- The step number inside each circle is `aria-hidden`; the `<ol>` carries the position for assistive tech.
- The subagent reported 7 worker-test timeouts under `pnpm test`; the orchestrator's rerun was green (74 files / 1,811 tests), so they were transient.
- Verification: typecheck, lint, 74 files / 1,811 tests, build green. Precache 25 entries, 937.06 KiB of 1,000 KiB; no admin chunk in `dist/client/sw.js`.
- Review patches (triage rows 1-8) applied by the same subagent: `failedAfter(0)` wording and PreviewStep always naming the count; `importer.reset()` on Aperçu's Retour; `file.chosen`/`showingFirst` through `formatCount`; the Colonnes head row `aria-hidden`; ImportStepper generic over the step id; design.md says Retour is outline. Orchestrator rewrote design.md's failure paragraph to match. #154 closes through the PR's `Closes` line rather than a manual close.
- Final verification: typecheck, lint, 74 files / 1,813 tests, build green. Precache 25 entries, 937.17 KiB of 1,000 KiB; no admin chunk in `dist/client/sw.js`. baseline_commit re-stamped at PR time from the merge-base with origin/main.

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped, not a sweep). Counts: high 0, medium 2, low 12, false 3, rejected-low 4. Routes: 9 patch, 3 defer, 0 loopback.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | blind, vgap, intent | First-batch failure (`done === 0`) shows `copy.import.failed`, which says rows were already saved and names no count | medium | patch: `failedAfter(0)` wording, PreviewStep always uses it; test for a first-batch 500. |
| 2 | edge | Retour after a failure, remap, back to Aperçu: stale failure Alert with the old count and « Réessayer » | medium | patch: `importer.reset()` on Aperçu's Retour. |
| 3 | edge | `file.chosen` (and `showingFirst`) interpolate raw counts; Always says counts go through `formatCount` | low | patch; `preview.line` stays raw (a line number). |
| 4 | vgap | Grouping ≥ 1,000 never asserted literally (tests build expectations from the same copy fn) | low | patch: one literal regex assertion. |
| 5 | blind | Colonnes overline head row read as loose words by AT; dead `grid-cols-1` | low | patch: `aria-hidden`, drop class. |
| 6 | blind | ImportStepper cites a nonexistent « Stepper spine » section | low | patch (comment). |
| 7 | blind | ImportStepper types `current: string`, losing the `Step` union | low | patch: generic over the id. |
| 8 | blind, edge | design.md says Retour is secondary; buttons are `outline` | low | patch (doc). |
| 9 | vgap | Only-self-referential failure copy test | low | folded into 1. |
| 10 | blind | Map path failure Alert still generic | low | defer: MapStep is out of scope by intent (#181); logged in deferred-work for #181. |
| 11 | blind | A retry reports the first run's created rows as « mis à jour » | low | defer: pre-existing (retry re-sends since the first build; the upsert is the dedupe rule). |
| 12 | blind | Server's `ApiError.message` (400/403/426) never shown; Alert invites a retry that cannot work | low | defer: pre-existing — PreviewStep showed only `copy.import.failed` before this change. |
| 13 | edge, intent | In-app navigation unmounts the screen mid-import, dropping the guard; spine says the page can't be left | low | defer: already recorded as out of scope (Design Notes; `useBlocker` needs a data router). |
| 14 | blind | CSV failure Alert lacks `role="alert"` | false | `src/client/ui/alert.tsx:29` sets `role="alert"` on every Alert. |
| 15 | blind | Admin preview borrows `copy.fieldProspect.positionSet` | false | Deliberate single home for the pair format (#154's suggested fix, Code Map); a change there should reach both. |
| 16 | blind | Test header cites a spec not in the diff | false | The spec is tracked and ships in the same PR (`_bmad-output` is tracked). |
| 17 | intent | Done circle is `bg-foreground`, light in dark mode, where DESIGN.md says navy | false | Spec's « ink circle »: navy `#141c2e`/`#0b1120` in dark would vanish on the dark page; ink keeps contrast in both themes. |
| 18 | blind | No test for the guard on the map path | low, rejected | Same effect in ImportScreen keyed on `isRunning`, path-agnostic. |
| 19 | blind | No test for « Voir l'aperçu » disabled without a name column | low, rejected | Pre-existing behaviour, unchanged. |
| 20 | blind | Stepper tests glue the aria-hidden number into `textContent` | low, rejected | Works; sturdier form needs restructuring the assertions for no behaviour gain. |
| 21 | intent | Structural claims (Surface, edge classes, icon tiles) unasserted | low, rejected | happy-dom evaluates no CSS; entry 11 is the human pass. |

## Design Notes

The `beforeunload` guard covers reload, tab close and outside navigation only; an in-app sidebar click is a React Router navigation and would need `useBlocker`, which requires a data router — out of scope, noted in design.md. Retrying after a mid-way failure re-sends every row; that is safe because batch writes are idempotent (invariant 4).

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all green
- precache total from `dist/client/sw.js` -- expected: < 1,000 KiB, no admin chunk, quoted in the PR
