---
title: 'Prospects rebuilt: name search, pagination and CSV export (GH #179)'
type: 'feature'
created: '2026-09-27'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '9a9a3d1559375321af3bfb957a554b360dc25d9c'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-174-context.md'
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Prospects predates the #175 primitives: no name search (G4 exists server-side since #176), no paging (it shows the API's first 200 rows only), no export, a table that breaks below 768px, bare-text empty and load-failed states, and `docs/design.md` has no Prospects section.

**Approach:** Rebuild `ProspectsScreen` on ScreenHeader / ScreenState / Surface following #178: a debounced `q=` search in the one toolbar slot (replaced in place by the selection actions), server-side 25-row paging over `limit`/`offset`, a CSV export of the same filters, status as edge + badge, a list of rows below 768px, and the two empty states.

## Boundaries & Constraints

**Always:** Keep 2.10's URL contract (`status` several comma-separated, `dueBefore`, `assignedTo`, `source`, chips with ×, replace-not-push, selection emptied on any URL change) and add `q` to it through `searchQuerySchema` (trimmed, 1–200; blank never sent). The row menu keeps its side submenus. Every current `ProspectsScreen.test.tsx` assertion still holds. French in `copy.ts`; tokens only; admin input at 16px (`md:text-base`); admin out of the precache. Export follows #178's truncation rule (warning toast naming `EXPORT_ROWS`, suggesting narrower filters).

**Never:** No worker, schema, sync or migration change. No new dependency. No scroll area around the table. Accent-insensitive search is out (deferred-work, #176). Do not rework `cn()` — #136 was fixed by #175 (`src/client/lib/utils.ts`), close the issue.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Search | type "bistro" | after the debounce URL `?q=bistro` (replace); request `…?q=bistro&limit=25&offset=0` | No error expected |
| Blank search | type "   " or clear | `q` removed from URL and request | No error expected |
| Deep link | `?status=converted&q=Léa` | box shows "Léa"; request carries both | No error expected |
| Pages | total 60 | page 1 → `offset=0`; "Suivant" → `offset=25`; 3 pages; Précédent disabled on 1, Suivant on 3; range "26–50 sur 60" | No error expected |
| Filter change on page 2 | pick a status | back to page 1, selection cleared | No error expected |
| Page emptied by a mutation | last row of page 3 re-statused out | clamps to the last page that exists | No error expected |
| Total ≤ 25 | total 13 | no pager | No error expected |
| No prospects | no filters, total 0 | icon tile, `copy.prospects.empty`, "Importer un CSV" | No error expected |
| Search no results | `q` set, total 0 | icon tile, `noMatch`, a sentence naming the search (accents count), "Effacer les filtres" | No error expected |
| Filters no results | no `q`, total 0 | icon tile, `noMatch`, "Effacer les filtres" (existing test) | No error expected |
| Export | click "Exporter en CSV" | GET `/api/admin/prospects/export.csv` + `toQueryString(filters)` (no limit/offset) | failed → error toast; 401 → session-expired toast |
| Export capped | `x-truncated: true` | file saved + warning toast | No error expected |
| Load fails | 500 | ScreenState Alert with "Réessayer"; kept rows stay | retry refetches |
| Below 768px | `(width < 768px)` matches | list of rows (checkbox, name, type, status badge, agent, row menu); no table | No error expected |

</frozen-after-approval>

## Code Map

- `src/client/admin/ProspectsScreen.tsx` -- rebuild; keep `writeFilters`, `setFilter`, `dropFilter`, chips, `Filter`, `RowMenu`, `runAssign`, `changeStatus`, `failureMessage`. Selection key becomes query + page. Split row rendering into `src/client/admin/prospects/` (table, mobile list, empty state, toolbar) to keep the file readable.
- `src/client/admin/queries.ts:37` `ProspectFilters` + `toQueryString` + `parseProspectFilters` -- add `q` (last param, so existing exact-URL assertions hold). `useProspects(filters, page)` sends `limit=PAGE_SIZE&offset=(page−1)·PAGE_SIZE` appended after the filters, key `[...adminKeys.prospects(filters), page]` (prefix invalidation unchanged), `placeholderData: keepPreviousData`. `downloadCsv(path, fallback, failed)` takes its failure string instead of hardcoding `copy.visits.export.failed`; update the VisitsScreen call.
- `src/client/admin/visits/VisitsLedger.tsx:77` `VisitsPager` -- extract to `src/client/admin/Pager.tsx` with a `labels` prop; Visites passes `copy.visits.pager` unchanged.
- `src/client/admin/pagination.ts` -- `PAGE_SIZE`, `pageCount`, `pageItems` reused; fix its header comment (Prospects pages on the server).
- `src/client/admin/status.ts` -- add `STATUS_BADGE` per docs/design.md › Badges (`bg-secondary text-muted-foreground`, `bg-tint-assigned text-foreground`, `bg-tint-warn text-warn`, `bg-tint-success text-success`, `bg-tint-destructive text-destructive`); badge class shape as `RecentVisits.tsx:19` `BADGE`.
- `src/client/hooks/use-mobile.ts` `useIsMobile()` -- picks list vs table (happy-dom defaults to desktop; tests mock `matchMedia` as `CarteScreen.test.tsx:64`).
- `src/client/ui/input.tsx`, `ui/pagination.tsx`, `ui/badge.tsx`, `ui/table.tsx` -- vendored, use as-is. Search icon from lucide.
- `src/client/admin/ScreenState.tsx`, `Surface.tsx`, `ScreenHeader.tsx` -- #175 primitives. The toolbar + table split panel: toolbar and table inside one `Surface` (toolbar gets `border-b`), resolving deferred-work's split-panel note.
- `src/client/copy.ts:211` `prospects` -- add search (label, placeholder), pager (shared strings with Visites' pager, own `nav`), range, export (button, exporting, failed, truncated), empty-state sentences. `copy.visits.pager` stays addressable.
- API (read only): `GET /api/admin/prospects?…&q&limit&offset` (`limit ≤ 200`, `offset ≤ 20000`), `GET /api/admin/prospects/export.csv?…&q` (no paging, 500 cap, `x-truncated`).
- `docs/design.md:413` "One toolbar slot" -- rewrite (search first in the slot, chips, swap, scope Prospects/Doublons/Visites); add a `### Prospects` section after it (header actions, ledger columns, edge + badge, pager + range, export, empty states, below-768 list).

## Tasks & Acceptance

**Execution:**
- [x] `src/client/admin/queries.ts` -- `q` in the filter contract, paged `useProspects`, `downloadCsv` failure param -- G4, paging
- [x] `src/client/admin/Pager.tsx`, `visits/VisitsLedger.tsx` -- shared pager, Visites behaviour unchanged
- [x] `src/client/admin/status.ts` -- `STATUS_BADGE`
- [x] `src/client/admin/ProspectsScreen.tsx` + `src/client/admin/prospects/*` -- the rebuild
- [x] `src/client/copy.ts` -- every new French string
- [x] `src/client/admin/queries.test.tsx` -- `q` round-trips through `toQueryString`/`parseProspectFilters`; blank/over-long `q` dropped
- [x] `src/client/admin/ProspectsScreen.test.tsx` -- existing tests untouched in what they assert (fetch stub may ignore `limit`/`offset` when matching); new tests for every I/O row above
- [x] `docs/design.md` -- One toolbar slot + Prospects section
- [x] `gh issue close 136` with a comment citing #175's `extendTailwindMerge` -- orchestrator, at PR time (no remote ops during implementation)

**Acceptance Criteria:**
- Given the rebuilt screen, when `pnpm test` runs, then DOM tests pin `q=` reaching the request, pagination offsets, the export URL and truncation toast, both empty states and the below-768 list, and every pre-existing test passes with its assertions unchanged.
- Given `pnpm build`, when the precache manifest is read, then its total is quoted against 1,000 KiB and no admin module is precached.

## Implementation Notes

- Implemented by the pwa-engineer subagent. Orchestrator fixes after reading the diff: the desktop table showed status as text, not a badge (Approach says edge + badge) — `BADGE_SHAPE` + `STATUS_BADGE` now in both layouts, with the edge kept on list rows too; empty states gained a title line and the search one says accents count (`noMatchSearch`, `noMatchFilters`); pager words shared through one `PAGER` const in copy.ts; the page clamp runs only against an answer (no data read as total 0 and threw page 2 back to 1); the debounce reads the latest filters at fire time; design.md no longer decides Doublons' slot (that story's call) and drops two bogus § references.
- Tests added by the orchestrator for matrix rows the subagent left uncovered: blank search, page clamp after a shrinking refetch (driven by invalidating the prospects prefix — Radix submenus do not open under user-event in happy-dom), load failed + retry, filters-only empty sentence, phone list badge and row menu.
- Verification: typecheck, lint, 73 files / 1,794 tests green; subagent's build: precache 25 entries, 936.49 KiB of 1,000 KiB, no admin chunk.

- Review patches (triage rows 1-14) applied by the same subagent. Outside URL changes are detected on the whole query string (the screen records its own writes in `writeFilters`), so a pending search is cancelled on Back/sidebar and "Effacer les filtres" blanks the box. Two pre-existing tests ("clears every filter", "replaces the history entry") had `stubFetch()` answer `rows: []` with `total: 13` just to reach the clear button; with EmptyState now keyed on `total === 0` their fixture became `stubFetch([], 0)` — assertions unchanged.
- Final verification: typecheck, lint, 73 files / 1,800 tests, build green. Precache 25 entries, 936.68 KiB of 1,000 KiB; no admin chunk in dist/client/sw.js. baseline_commit re-stamped at PR time from the merge-base with origin/main.

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped, not a sweep). Counts: high 0, medium 2, low 12, false 2, rejected-low 9. Routes: 12 patch, 0 defer, 0 loopback.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | blind, edge | A pending debounce fires after Back / sidebar / Effacer les filtres and writes the old `q` back | medium | patch: `handleSearchChange` timer is cleared only on unmount; an outside URL change must cancel it and reset the box. |
| 2 | blind, edge | Empty page (server `[]`, total > 0) shows « Aucun prospect… » and hides the pager while the clamp refetches | medium | patch: EmptyState keyed on `total === 0`, not `rows.length`. |
| 3 | blind | Clamp test passes for the wrong reason (stub always answers one row) | low | patch: stub answers `[]` for `offset >= total`; assert no later `offset=50`. |
| 4 | blind, edge | >200-char search: URL keeps `q`, parse drops it, list unfiltered | low | patch: `maxLength` on the Input from the schema's 200. |
| 5 | vgap, blind | Page turn alone emptying the selection untested | low | patch: test. |
| 6 | vgap, blind | Outside URL change resetting the box untested | low | patch: test. |
| 7 | vgap, blind | Filter changed inside the debounce window surviving untested | low | patch: test. |
| 8 | intent, blind | Debounce coalescing untested (only last request checked) | low | patch: assert one `q=` request per burst. |
| 9 | intent | Export carrying `q` untested | low | patch: test. |
| 10 | blind | Pager centres itself (vendored `mx-auto w-full justify-center`) and hardcodes `mt-4` | low | patch: `className` prop; Visites passes `mt-4`. |
| 11 | blind | Export URL ends in a bare `?` with no filters; needless URLSearchParams round trip | low | patch: path + `toQueryString(filters)`. |
| 12 | blind | `setFilter` compares a literal `"any"` beside the exported `ANY` | low | patch: import `ANY`. |
| 13 | blind | `useProspects` doc comment self-contradictory | low | patch (comment). |
| 14 | blind, edge | Spies and the matchMedia mock leak across tests | low | patch: `vi.restoreAllMocks()` in `afterEach`. |
| 15 | blind | Phone list drops address and last visit | false | EXPERIENCE.md § responsive: "a list of rows (name, type, status, agent)". |
| 16 | blind | Spec tasks unticked / logs empty | false | Step 5 ticks them; logs fill in this pass. |
| 17 | vgap, edge | `keepPreviousData` rows of the old filter tickable under the new selection key | low, rejected | Needs a slow fetch plus a tick in that window; the admin assigns rows they can see. Fix adds a guard. |
| 18 | edge | Offset past `PROSPECTS_MAX_OFFSET` (> 20,025 rows) 400s | low, rejected | vision.md plans a few thousand prospects. |
| 19 | edge, blind | No select-all below 768px | low, rejected | EXPERIENCE.md lists the phone row's fields; adds a component. |
| 20 | edge | Toolbar remounts between skeleton and data, losing focus if typed during first load | low, rejected | First load only; fix restructures ScreenState use. |
| 21 | edge | First-load failure hides the toolbar | low, rejected | Retry is offered; client never sends an invalid filter. |
| 22 | blind | Ticking a box inside the debounce window is emptied when `q` lands | low, rejected | 300 ms window; `q` change legitimately empties the selection. |
| 23 | blind | design.md sketch says « Rechercher… » vs « Rechercher par nom… » | low, rejected | Sketches abbreviate throughout the file. |
| 24 | blind | « Export… » is a noun | low, rejected | Pre-existing Visites string reused as-is. |
| 25 | blind | `agentList.map` three times per render | low, rejected | Two agents; negligible. |
| 26 | intent | Badge styling and phone layout beyond the swap not asserted | low, rejected | happy-dom evaluates no CSS; entry 11 is the human pass (epic Done when 2). |

## Design Notes

Paging is server-side (unlike Visites' client-side pager over a held feed): the list endpoint already has `limit`/`offset` and a `total`, and holding 200 rows to show 25 would bill scanned rows for nothing. The page is component state, not a URL param, as on Visites: `toQueryString` is the one spelling shared by the API, the screen URL and the dashboard links, and the API reads `offset`, not `page`. The search box holds its own text and writes the URL after ~300 ms; an outside URL change (Effacer les filtres, Back, sidebar) resets the box from the URL.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all green
- precache total from `pnpm build` (`dist/client/sw.js` manifest) -- expected: < 1,000 KiB, no admin chunk, quoted in the PR
