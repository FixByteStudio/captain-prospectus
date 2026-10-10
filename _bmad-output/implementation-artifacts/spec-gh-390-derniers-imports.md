---
title: 'Source lists the last five imports (GH #390)'
type: 'feature'
created: '2026-10-10'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: 'd299db6202b7f6f655a5af41bd8ef7d994171858'
context:
  - '{project-root}/docs/adr/0030-the-server-keeps-an-import-log.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The server logs each import (#371, #372) but the admin cannot see it: Source has no « Derniers imports » panel (epic #363, R3, R7, R8).

**Approach:** A read-only Derniers imports panel under Source's cards, fed by `GET /api/admin/imports` through a new `adminKeys.imports()` query that `useImportBatches` invalidates when a run ends. Desktop ledger table; two-line rows without Par at phone width; `docs/design.md` drops « Nothing records an import today ».

## Boundaries & Constraints

**Always:** French strings in `copy/admin.ts` (INVARIANT 15); counts via `formatCount`, the date via `formatDateTime` (fr-FR short: « 08/10/2026 16:05 »); zone labels reuse `copy.map.vertices` and `copy.map.circle.radius` (« Rayon 1,5 km » at ≥ 1 000 m); shadcn `Table`/`Badge`, `Surface`, `ScreenState`, tokens only; the status reads as a 4px leading edge **and** a badge (DESIGN.md › Tables). The list is shown in the server's order. Decision (owner, 2026-10-10): a redacted file or admin reads « — » (muted, `aria-hidden`), the DESIGN.md › Tables empty cell, not a truly blank cell.

**Never:** No server, schema, migration or wire change; no row action, link, paging or polling; no new dependency; no status derived on the client (the server's `status` is the truth, ADR-0030).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| CSV done | `source:"csv"`, `fileName:"a.csv"`, 118/6/4, `status:"done"` | `FileSpreadsheet` « CSV » · « a.csv » · « +118 créés · 6 mis à jour · 4 rejetés » · email · « Terminé » success tint, success edge | — |
| OSM polygon | `source:"osm"`, `zoneVertices:7` | `Map` « Carte OpenStreetMap » · « 7 sommets » | — |
| Google circle | `source:"google"`, `zoneRadiusM:300` / `1500` | `Map` « Carte Google » · « Rayon 300 m » / « Rayon 1,5 km » | — |
| Unknown source | `source:"field"` (or any other) | the raw value as label, `Map` icon | — |
| Interrupted | `status:"interrupted"` | « Interrompu » warn tint, warn edge | — |
| Redacted | `fileName:null`, `createdBy:null` | Fichier ou zone and Par read « — » | — |
| Singular counts | 1/1/1 | « +1 créé · 1 mis à jour · 1 rejeté » | — |
| Empty | `imports: []` | one muted line « Aucun import pour l'instant. » | — |
| Load fails | GET errors | panel keeps its head; ScreenState's destructive Alert with retry | `copy.import.recent.loadFailed` |

</frozen-after-approval>

## Code Map

- `src/shared/schemas.ts:422-439` -- `ImportLogEntry`, `ImportsResponse`: the response type. Reuse, do not change.
- `src/client/admin/queries.ts:69-81` -- `adminKeys`: add `imports: () => ["admin", "imports"] as const`.
- `src/client/admin/queries.ts:335-399` -- `useImportBatches`: its `finally` `Promise.all` gains `client.invalidateQueries({ queryKey: adminKeys.imports() })`. Add `useImports()` near `useScripts` (`apiFetch<ImportsResponse>("/api/admin/imports")`).
- `src/client/admin/import/SourceStep.tsx` -- renders the panel under the cards and after the error Alert.
- `src/client/admin/import/ColumnsStep.tsx:163-255` -- the pattern to copy: `Surface` panel with a head, `TableHeader` `hidden md:table-header-group` on `bg-secondary`, rows `grid … md:table-row`, « — » as `aria-hidden` muted text.
- `src/client/admin/ScreenState.tsx` -- loading skeleton / load-failed Alert gate; `DuplicatesScreen.tsx:72-128` shows its use.
- `src/client/admin/status.ts` -- `BADGE_SHAPE`, and the `shadow-[inset_4px_0_0_0_var(--color-…)]` edge idiom; `bg-tint-warn text-warn` / `bg-tint-success text-success` exist as tokens.
- `src/client/copy/admin.ts:351-381` (`import.source`), `:541`, `:563` (`map.circle.radius`, `map.vertices`).
- `src/client/format.ts` -- `formatDateTime`, `formatCount`.
- `src/client/admin/import/ImportScreen.test.tsx:78-83, 243-262` -- the global `fetch` stub answers every URL with `{created,updated}`; Source now also GETs `/api/admin/imports`, so the stub must answer it with `{ imports: [] }` and `calls[0]` readers must pick the batch POST by URL.
- `src/client/admin/queries.test.tsx` -- existing `useImportBatches` tests; assert the new invalidation there.
- `docs/design.md:717-721` -- the Derniers imports bullet; `:762-765` phone width.
- Mockup: `_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-a4-a6-import.html` lines 123-150 (light), 186+ (dark).

## Tasks & Acceptance

**Execution:**
- [x] `src/client/copy/admin.ts` -- add `import.recent`: `title` « Derniers imports », `head` (`date` « Date & heure », `source` « Source », `target` « Fichier ou zone », `volume` « Volume », `by` « Par », `status` « Statut »), `sources` (`csv` « CSV », `osm` « Carte OpenStreetMap », `google` « Carte Google »), `volume(c,u,r)`, `status` (`done` « Terminé », `interrupted` « Interrompu »), `empty` « Aucun import pour l'instant. », `loadFailed` « Impossible de charger les derniers imports. Réessayez. », `loading` « Chargement des derniers imports… ».
- [x] `src/client/admin/queries.ts` -- `adminKeys.imports`, `useImports`, the invalidation in `useImportBatches`.
- [x] `src/client/admin/import/RecentImports.tsx` -- new panel component (see Design Notes); rendered by `SourceStep`.
- [x] `src/client/admin/import/RecentImports.test.tsx` -- one test per I/O matrix row (fetch stubbed with a fixture `ImportsResponse`), plus order kept and Par hidden below md (`hidden md:table-cell` class asserted).
- [x] `src/client/admin/import/ImportScreen.test.tsx` -- route the fetch stub by URL; keep every existing assertion.
- [x] `src/client/admin/queries.test.tsx` -- `useImportBatches` invalidates `adminKeys.imports()` on success and on failure.
- [x] `docs/design.md` -- the Derniers imports bullet: drop « Nothing records an import today… does not depend on it. », state it reads `GET /api/admin/imports` (ADR-0030), « — » for a redacted file or admin, and « Interrompu » appears up to `IMPORT_STALE_MS` after the last batch.

**Acceptance Criteria:**
- Given a CSV import then a map import on a local build, when the admin returns to Source, then both are listed newest first with « Terminé » without a reload.
- Given a part-finished import older than 5 min (seeded with `wrangler d1 execute --local`), when Source loads, then it reads « Interrompu ».
- Given a 390px viewport, when Source shows imports, then each is two lines (date · source · file, then volume · statut) and Par is not shown.
- Given light and dark themes at 1280px, then the panel matches the mockup.

## Design Notes

Panel: `Surface overflow-hidden`; head `flex items-center gap-2.5 px-5 py-4` with `History` (`aria-hidden`) and an `h2.text-heading`. The panel head stays outside `ScreenState`, so loading/empty/error all sit under the title. Skeleton: three `h-6` rows.

Row (one `TableRow` per import, `key={id}`): at md a table row; below md `grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-5 py-3` with `md:table-row md:p-0`, so date + source + file wrap onto the first line and volume + statut onto the second (use `col-span`/`order` utilities as needed; exact classes are the implementer's call). Par cell `hidden md:table-cell`. The edge sits on the first cell at md and on the row below md. Source cell: `csv` → `FileSpreadsheet`, everything else → `Map`; label from `copy.import.recent.sources[source]` when the key exists (guard with `Object.hasOwn`), else the raw `source`. Statut: `<Badge variant="ghost" className={cn(BADGE_SHAPE, tint)}>`.

```ts
volume: (c, u, r) => `+${formatCount(c)} ${c === 1 ? "créé" : "créés"} · ${formatCount(u)} mis à jour · ${formatCount(r)} ${r === 1 ? "rejeté" : "rejetés"}`
```

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all green.

**Manual checks:**
- `pnpm dev` with a seeded local DB: run a CSV and an OSM import, go back to Source, compare with the mockup in light, dark, 390px; empty DB shows « Aucun import pour l'instant. ».

## Implementation Notes

- Implemented by a `pwa-engineer` subagent. New `RecentImports.tsx` is rendered by `SourceStep`; below md a row is a flex-wrap whose `::before` breaks the line between date · source · file and volume · statut.
- Beyond the Code Map, needed for the suite: `MapStep.test.tsx` and `ColumnsStep.test.tsx` also render `ImportScreen`, so their fetch stubs now answer `GET /api/admin/imports` with `{ imports: [] }`.
- Matrix audit: icon assertions (`svg.lucide-file-spreadsheet`, `svg.lucide-map`) added to the CSV, OSM, Google and unknown-source tests; every matrix row now has a passing test.
- Verified: typecheck, lint, 2614 tests, build green; precache 951.63 KiB (admin-only change). Browser checks (mockup, 390px, « Interrompu » on a seeded DB) not yet run.

## Spec Change Log

## Review Triage Log

### Pass 1 (2026-10-10) — high 0 · medium 2 · low 3 · false 7 · rejected-low 6 · maybe-false 0

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|------|---------|---------|-------|-------------------|
| 1 | blind, edge, intent, vgap | design.md says « Interrompu » appears "up to `IMPORT_STALE_MS` … never sooner"; queries.ts comment implies the invalidation surfaces it | medium | patch | `listImports` (`src/worker/import-log.ts:102`) lists an unfinished import only once stale; no polling. Reworded doc and comment. |
| 2 | vgap, blind, intent | No test shows the panel on Source or its refresh after Terminer (AC1) | medium | patch | Only `RecentImports.test.tsx` mounts it; removing `<RecentImports />` from SourceStep passes every test. Added ImportScreen tests. |
| 3 | vgap, blind, intent | Desktop status edge (`look.cell`) unasserted | low | patch | Edge tests read only `row.className`, which is `md:shadow-none`. Added first-cell assertions. |
| 4 | edge | `md:max-w-56 md:truncate` on a `<td>` never ellipsizes in auto layout | low | patch | max-width is ignored on table cells in auto layout. Inner truncating span. |
| 5 | edge, blind | Phone row can wrap to 3+ lines (`break-all` on the file name) | low | patch | Long names wrap at 390px; same inner span truncates below md. |
| 6 | blind | Second source-label map; `field` shows raw English | false | — | Spec/EXPERIENCE.md mandate « Carte OpenStreetMap » / « Carte Google » here; `prospectBatchSchema.source` is `["csv","osm"]` (`schemas.ts:284`), so `field` never reaches the log; raw fallback is the ticket's rule. |
| 7 | edge, blind, intent | Failed run never surfaces while Source stays mounted | false | — | Documented ADR-0030 consequence ("sees nothing on Source until then"); no polling is a stated boundary. |
| 8 | edge | « 0 créés » should be singular for zero | false | — | The approved mockup reads « 0 mis à jour · 0 rejetés »; `copy.import.result` also uses `n === 1`. |
| 9 | blind | Identifiers should use glossary "Import log" | false | — | The ticket names `adminKeys.imports()`; the key mirrors `/api/admin/imports` and table `imports`. |
| 10 | blind | Read-only rows keep the shadcn hover tint | false | — | Repo ledgers (`PreviewStep`, `RecentVisits`) keep the body-row hover and override only header rows. |
| 11 | blind | Redacted « — » is aria-hidden with no explanation | false | — | Owner decision in the frozen block (muted, `aria-hidden`). |
| 12 | blind | Spec record unfinished (tasks unchecked, logs empty) | false | — | Fix edits this build's spec; logs are filled by this step. |
| 13 | edge | Unknown future `status` crashes the panel | low | reject | The status is a zod enum in the wire contract; a new value is a contract change (INVARIANT 9). Fix adds a guard; unlikely. |
| 14 | edge, blind | Phone width hides `thead`; cells lose column labels for screen readers | low | reject | Same responsive-table pattern as `ColumnsStep.tsx:172`; the values are self-describing; fix adds per-cell sr-only labels. |
| 15 | blind | No test of the loading skeleton / status text | low | reject | `ScreenState` owns and tests that behaviour (`ScreenState.test.tsx`). |
| 16 | blind | Failure stub reuses one `Response` instance | low | reject | Works with `retry: false`; test-only, rarely met. |
| 17 | blind | Fetch-stub helper duplicated across three test files | low | reject | Test-only; consolidating needs a new shared helper. |
| 18 | intent | Refresh after Terminer comes from remount + staleTime 0, not the invalidation | low | reject | True but harmless: the invalidation also covers a mounted query elsewhere; finding #2's test pins the visible outcome. |
