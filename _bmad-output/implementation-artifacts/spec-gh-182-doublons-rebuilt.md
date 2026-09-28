---
title: 'Doublons rebuilt (GH #182)'
type: 'feature'
created: '2026-09-28'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '8dc5801c273319818e755ecae7264c4128d3524c'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-174-context.md'
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Doublons (`src/client/admin/DuplicatesScreen.tsx`) predates the #175 primitives: a bare `<p>` for load failure and loading, a hand-spelled panel, status as coloured text instead of edge + badge, a `rowSpan` table that has no phone shape, `outline` row buttons, an empty state that is one grey line, no toolbar slot, no DOM test and no `docs/design.md` section. Its truncation Alert tells the admin to « relancez la recherche » but there is no control that does.

**Approach:** Rebuild on `ScreenHeader`, `ScreenState`, `Surface` and `STATUS_EDGE`/`STATUS_BADGE`. Each pair is one list item: two stacked rows with the distance shown once for the pair. « Garder » (secondary) on either row merges the other into it, no confirmation. The toolbar slot holds the pair count and a secondary « Relancer la recherche ».

## Boundaries & Constraints

**Always:** `useDuplicates` / `useMerge` unchanged, so the sidebar badge and the dashboard's « À traiter » row keep reading the same query. « Garder » on row A sends `{ survivorId: A, mergedId: B }` and vice versa; every « Garder » is disabled while a merge is pending; success toast `copy.duplicates.merged(survivor)`, failure toast `mergeFailed` (as today). Each row shows name, address, status as `STATUS_EDGE` + `STATUS_BADGE` label, agent (« — » when none), visit count with a French label. Distance via `formatDistance`, or `distanceUnknown` when `null`, rendered once per pair. The truncation Alert stays, below the list. Load failure and loading go through `ScreenState` with the existing `loadFailed`/`loading` strings. Every French string in `copy.ts`; tokens only; admin stays out of the precache.

**Decision (toolbar slot, taken in this story):** Doublons has no filters and no row selection, so the slot never swaps. It holds the standing fact — the pair count, left — and one secondary action, right: « Relancer la recherche », which refetches the sweep, disabled while fetching. It is the control the truncation Alert already names, and the sweep's 60 s `staleTime` otherwise hides a fresh import's pairs. Recorded in the PR body and in `docs/design.md` (One toolbar slot + Doublons).

**Never:** No worker, schema, API or sync change. No confirmation dialog on merge. No gold button on the screen. No client-side name filter (it would only search the loaded pairs). No new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Pair as one unit | 1 pair, `distanceM: 12` | one list item holds both names; « 12 m » appears once in it; two « Garder » buttons | No error expected |
| Unknown distance | `distanceM: null` | « Position inconnue » once for the pair | No error expected |
| Keep B | click « Garder » on B's row | POST `/api/admin/prospects/merge` body `{survivorId: B.id, mergedId: A.id}`; toast « Fusionné dans « B » »; duplicates refetched | 500 → toast `mergeFailed`, pair stays |
| Empty | `{pairs: [], truncated: false}` | healthy empty state: icon tile, « Aucun doublon détecté. », one sentence, one button; toolbar count « 0 paire » | No error expected |
| Truncated | `truncated: true` | Alert with `copy.duplicates.truncated` | No error expected |
| Relaunch | click « Relancer la recherche » | a second GET on `/api/admin/prospects/duplicates` | button disabled while fetching |
| Load failure | GET 500 | `ScreenState` destructive Alert with `loadFailed` and « Réessayer » | retry refetches |
| Phone | 390px | rows wrap (name line, meta line), no horizontal page scroll | manual check (happy-dom has no layout) |

</frozen-after-approval>

## Code Map

- `src/client/admin/DuplicatesScreen.tsx` -- full rewrite. Keep the doc comment's reasoning, the `keep()` mutate-with-toasts function (and its comment on `dedupeKeyUpdated`). Structure: `ScreenHeader` (title, lede as subtitle `<p className="text-muted-foreground mt-0.5">` like VisitsScreen) → `ScreenState<DuplicatesResponse>` (skeleton: Surface with the toolbar + 3 `Skeleton` rows, as ProspectsScreen.tsx:311-320) → `Surface className="overflow-hidden"` holding the toolbar (`border-border flex min-h-11 flex-wrap items-center gap-2 border-b px-3`, same classes as prospects/Toolbar.tsx:65) then a `<ul className="divide-border divide-y">` of pairs, or the empty tile. Truncated `Alert` after the Surface.
- A pair `<li aria-label={copy.duplicates.pairAria(a.name, b.name)}>` as a two-column grid: left, two stacked side rows (no rule between them); right, the distance cell spanning both, `tnum text-muted-foreground border-l`. A side row: `STATUS_EDGE` on the row, name `font-medium` + address muted, then a `flex-wrap` meta group with `Badge variant="ghost" className={cn(BADGE_SHAPE, STATUS_BADGE[s])}` (as ProspectsTable.tsx:87), agent or « — », `copy.duplicates.visits(n)`, and `Button variant="secondary" size="sm"` with `aria-label={keepAria(name)}`.
- Empty tile: reuse the shape of `prospects/EmptyState.tsx`'s private `Tile` (copy the 4 lines, or export `Tile` from there — prefer exporting and importing; no new file). Icon `CopyCheckIcon` (lucide, already a dep), title `copy.duplicates.empty`, sentence `copy.duplicates.emptyHint`, `Button variant="outline" size="sm" asChild` → `<Link to="/admin/prospects">{copy.duplicates.emptyCta}</Link>`.
- `src/client/admin/queries.ts:165` `useDuplicates`, `:174` `useMerge` -- read-only.
- `src/client/admin/status.ts` -- `STATUS_EDGE`, `STATUS_BADGE`, `BADGE_SHAPE`, reuse only. `STATUS_TEXT` no longer used here (still used elsewhere? check before leaving it).
- `src/client/format.ts:56` `formatDistance`, `:82` `formatCount`.
- `src/client/copy.ts:608` `duplicates` -- add `pairAria`, `visits(n)` (« Aucune visite » / « 1 visite » / « N visites » via `formatCount`), `emptyHint`, `emptyCta`, `relaunch`, `relaunching`; `count` through `formatCount`; drop `columns` if nothing reads it.
- new `src/client/admin/DuplicatesScreen.test.tsx` -- harness as `ProspectsScreen.test.tsx` (QueryClientProvider with `createAdminQueryClient`, MemoryRouter, `Toaster`, `vi.stubGlobal("fetch", …)`), a `pair()` fixture built from a full `Prospect`. Cover every non-manual matrix row.
- `src/client/admin/AdminSidebar.tsx`, `dashboard/DashboardScreen.tsx` -- consumers of `useDuplicates`; untouched. Their tests (`AdminApp.test.tsx:53`, `DashboardScreen.test.tsx:617-655`) must pass unchanged.
- `docs/design.md:413` "One toolbar slot" -- replace "is decided when that screen is rebuilt" with the decision; add a `### Doublons` section after "### Prospects" (sketch, pair-as-unit, secondary Garder with no confirmation, the slot, truncation, healthy empty state, phone wrap).

## Tasks & Acceptance

**Execution:**
- [x] `src/client/copy.ts` -- new duplicates strings
- [x] `src/client/admin/prospects/EmptyState.tsx` -- export `Tile` for reuse
- [x] `src/client/admin/DuplicatesScreen.tsx` -- rebuild per Code Map
- [x] `src/client/admin/DuplicatesScreen.test.tsx` -- matrix rows
- [x] `docs/design.md` -- toolbar-slot decision + Doublons section
- [ ] PR body: `Closes #182`, the toolbar-slot decision, precache total vs 1,000 KiB, the manual-only rows

**Acceptance Criteria:**
- Given `pnpm test`, when the suite runs, then the new tests pass and every existing test (sidebar badge, dashboard « À traiter » duplicates row) passes unchanged.
- Given `pnpm build`, when `dist/client/sw.js` is read, then the precache total is quoted against 1,000 KiB and no admin chunk is precached.
- Given `grep -n 'variant="default"\|<Button\b[^>]*>' DuplicatesScreen.tsx`, then no button on the screen uses the default (gold) variant.

## Implementation Notes

`pnpm typecheck && pnpm lint && pnpm test` all green (76 files, 1828 tests). `pnpm build` precache: 25 entries, 938.38 KiB (< 1,000 KiB ceiling); `dist/client/sw.js` carries no admin-chunk entry. `grep -n 'variant="default"\|<Button\b[^>]*>' DuplicatesScreen.tsx` shows one match, an `outline` button — no gold/default variant on the screen. No commit made (worktree instructions: no git commits/push); PR body task left to the caller.

- Implemented by the pwa-engineer subagent. Orchestrator fixes after reading the diff: `count(0)` read « 0 paires » (matrix and the dashboard's own `pairs` say « 0 paire »), now the same `n <= 1` agreement; the skeleton's toolbar no longer shows a count before the sweep answers; `emptyHint` no longer repeats the title; design.md's merge sentence now matches prospecting.md (a merge only marks the other side absorbed, each keeps its visits, unmerge restores it); tests now assert the in-flight « Relancer » is disabled, the refetch and disappearance after a merge, the empty sentence, and that « Réessayer » actually refetches.
- Re-verified: typecheck, lint, 76 files / 1,828 tests, build green. Precache 25 entries, 938.40 KiB of 1,000 KiB; no admin chunk in `dist/client/sw.js`.

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped, not a sweep). Counts: high 0, medium 0, low 13, false 1, rejected-low 2. Routes: 11 patch, 0 defer, 0 loopback; 1 found-in-passing issue.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | blind | design.md "One toolbar slot" still says the Doublons slot "is decided when that screen is rebuilt" | low | patch: now points to § Doublons. |
| 2 | blind | The toolbar-slot decision written twice in design.md (ADR-0024: one home) | low | patch: kept only in § Doublons. |
| 3 | blind | "unmerging restores it" — no admin UI calls `/prospects/:id/unmerge` | low | patch: doc says undo is server-side only; missing control filed as found-in-passing. |
| 4 | blind | Sketch shows `Pos. inconnue`, `lea@…`, distance on one row | low | patch. |
| 5 | edge, blind | Long unbroken name/address/email grows the `1fr` track; `overflow-hidden` clips « Garder » at phone width | low | patch: `minmax(0,1fr)` + `break-words`. |
| 6 | edge | « Garder » enabled while a refetch is in flight → a stale pair can be merged | low | patch: disabled on `merge.isPending \|\| duplicates.isFetching`. |
| 7 | blind | Non-zero visit count lost its emphasis | low | patch: `text-foreground font-semibold` when > 0. |
| 8 | blind | Doublons imports `Tile` from the Prospects folder | low | patch: `src/client/admin/EmptyTile.tsx`, used by both. |
| 9 | vgap, blind, intent | Keep-A direction untested (swapped args would pass) | low | patch: test posts `{survivorId:"a", mergedId:"b"}`. |
| 10 | vgap, intent | Per-row visits and status label never asserted | low | patch: `within` each side row. |
| 11 | vgap, blind, intent | No test that the skeleton shows no count; none that a pending merge disables both « Garder » | low | patch: both tests added. |
| 12 | edge | Paused (offline) initial query leaves an enabled relaunch in the skeleton | low, rejected | Admin is online-only; clicking only refetches. |
| 13 | blind | Two retry controls after a failed refetch; relaunch reads « Recherche en cours… » after each merge | low, rejected | Both accurate (the sweep is re-running); a guard adds branches for no user harm. |
| 14 | intent | « Relancer » adds no reach under truncation, since a merge already invalidates the sweep | false | The intent's approach names exactly this control; its reach is the stale-after-import case design.md states, and post-merge invalidation is unchanged. |
| 15 | intent | Edge/badge classes, secondary variant, phone layout untested in DOM | low | Accepted: happy-dom has no CSS or layout; entry 11 of the epic is the human pass. |
| 16 | edge | design.md phone claim unverified | low | Same as 15; manual check listed in the PR. |

- Review patches (triage rows 1-11) applied by the same subagent. Re-verified: typecheck, lint, 76 files / 1,834 tests, build green; precache 25 entries, 938.42 KiB of 1,000 KiB, no admin chunk.

## Design Notes

A `<ul>` of pair items instead of the old `rowSpan` table: the pair is the unit the admin decides on, a list item carries that boundary (and an accessible name) natively, and one wrapping row shape serves 1280 and 390 without a second phone layout. The column headers go; the visit count gains its word (« 3 visites ») so nothing relies on a header to be read.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all green
- precache total from `dist/client/sw.js` -- expected: < 1,000 KiB, no admin chunk

**Manual checks:**
- `pnpm dev`, /admin/doublons at 390px and in dark mode: pair reads as one unit, no horizontal scroll.
