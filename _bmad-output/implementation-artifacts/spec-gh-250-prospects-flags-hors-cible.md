---
title: 'Prospects flags places reported Hors cible'
type: 'feature'
created: '2026-10-05'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '6a8483b6a8665ff44a909eb98bc8a2b9c108e3fa'
context:
  - '{project-root}/_bmad-output/specs/spec-not-interested-skips-script/SPEC.md'
  - '{project-root}/_bmad-output/initiative-dashboard-redesign/epic-refusal-reasons/story-prospects-flags-places-reported-hors-cible.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An agent who reports a place "Hors cible / fermé" (refusal reason `out_of_target`) leaves the base wrong, and no admin screen says which prospects to fix (GH #250, CAP-7 of epic #246).

**Approach:** Add an `outOfTarget` filter to the Prospects list and its CSV export, and a "Hors cible signalé" toggle in the toolbar that shows the filtered count (the list's existing `total`) while it is on. A prospect is flagged while its latest visit has `refusal_reason = 'out_of_target'` and `out_of_target_reviewed_at` is null or not after that visit's `visited_at`. A direct admin `PATCH /prospects/:id` stamps `out_of_target_reviewed_at`; assign, merge and CSV import never do. A newer visit with another outcome unflags it, since the latest visit no longer carries the reason.

## Boundaries & Constraints

**Always:** No migration: the column exists since #247. The filter is one SQL predicate in `prospectFilters`, so the list and the export cannot diverge. Merged prospects stay excluded. "Latest visit" orders `visited_at`, `received_at`, `id` descending, as `deriveProspectStatus` does. Nothing reads `updated_at` for the flag. Schemas in `zod/mini` (INVARIANT 6); the French strings live in `copy/admin.ts` (INVARIANT 15). Additive API change: the list and export queries gain one optional param; the response is unchanged. Docs updated in the same change.

**Decided (2026-10-05, owner):** the review compares to the latest visit's `visited_at`, not `received_at`; the count is the current filtered list only, so the toggle shows it while on.

**Never:** No new writer of `out_of_target_reviewed_at` besides PATCH. No change to assign, merge, batch import, the sync contract, `visits` or Visites. No row badge, dashboard tile or visit-history view. No dependency, no ADR (a rule has one home: prospecting.md, ADR-0024).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Flag appears | Latest visit `not_interested` + `out_of_target`, never reviewed | Listed by `?outOfTarget=true`; `total` counts it | none |
| Admin reviews | Direct PATCH (fields or status) after the visit | Leaves the list; `total` drops | none |
| Newer other outcome | Later visit, any other outcome or reason | Leaves the list | none |
| Newer visit, same reason | Later `out_of_target` visit after a PATCH | Back in the list | none |
| Not a review | Assign, unassign, merge as survivor, CSV/OSM re-import | Stays flagged | none |
| Merged prospect | `merged_into` set | Never listed or counted | none |
| Same instant | PATCH stamped at exactly the visit's `visited_at` | Stays flagged ("not after") | none |
| Filter combined | `outOfTarget=true&assignedTo=…` | Both apply; `total` is the combined set | none |
| Bad value | `outOfTarget=maybe` | 400 | validation error |

</frozen-after-approval>

## Code Map

- `src/shared/schemas.ts:309` -- `prospectFiltersSchema` (shared by list and export): add `outOfTarget`; `prospectsResponseSchema` is unchanged.
- `src/worker/routes/admin.ts:624` -- `prospectFilters()`: add the predicate; `:918` PATCH: stamp `outOfTargetReviewedAt: now`; `:415` `MANUAL_STATUS_IN_FORCE` is the sql-fragment pattern.
- `src/worker/routes/status.ts:34` -- latest-visit ordering to mirror; do not change.
- `src/client/admin/queries.ts:~88,~110` -- `ProspectFilters`, `toQueryString`, `parseProspectFilters`: carry `outOfTarget` through the URL.
- `src/client/admin/ProspectsScreen.tsx`, `prospects/Toolbar.tsx` -- toggle (shadcn `ui/toggle`), `filtered` flag, chip-free; count from `prospects.data.total`, shown only while on.
- `src/client/copy/admin.ts:175` -- `prospects.filters`: label and count text.
- Tests: `src/worker/admin.test.ts` (PATCH/assign/merge/batch blocks, seeding visits), `src/client/admin/ProspectsScreen.test.tsx`.
- Docs: `docs/api.md:26,28,30`, `docs/domains/prospecting.md` (refusal reasons section), `docs/data-model.md:29`, `schema.ts:65` comment ("nothing writes it yet").

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/schemas.ts` -- `outOfTarget` optional (`"true"` only) in `prospectFiltersSchema` -- list and export share it
- [ ] `src/worker/routes/admin.ts` -- one predicate for "flagged"; filter and PATCH stamp -- see Design Notes
- [ ] `src/worker/db/schema.ts` -- update the column comment to name PATCH as its writer
- [ ] `src/client/admin/queries.ts`, `ProspectsScreen.tsx`, `prospects/Toolbar.tsx`, `copy/admin.ts` -- the toggle with its count, URL-backed
- [ ] `src/worker/admin.test.ts` -- every matrix row, incl. survives assign, merge, batch import
- [ ] `src/client/admin/ProspectsScreen.test.tsx` -- toggle shows the filtered count, writes `outOfTarget=true`, request carries it
- [ ] `docs/api.md`, `docs/domains/prospecting.md`, `docs/data-model.md` -- param, field, rule

**Acceptance Criteria:**
- Given a seeded flagged prospect, when the admin PATCHes it, then it leaves `?outOfTarget=true` and `total` drops by one.
- Given `pnpm typecheck`, `lint`, `test` and `build`, then all pass and the precache line is quoted against 1,000 KiB.

## Implementation Notes

- Work only in the worktree `/home/m0/PROJECTs/captain-prospectus-250` (branch `feat/250-hors-cible-signale`); never touch `/home/m0/PROJECTs/captain-prospectus`. Do not commit; the orchestrator commits.

- Verification: typecheck, lint, 2089 tests (83 files) and build green; precache 25 entries, 932.53 KiB / 1,000 KiB. Baseline re-checked at hand-over: merge-base with origin/main is still 6a8483b6a8665ff44a909eb98bc8a2b9c108e3fa.
- Review pass 1 patched five low findings (placeholder-total flash, empty state with the toggle on, OSM re-import test, glossary row, late-sync sentence). Deferred: doc drift, issue #256.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough; blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: high 0, medium 0, low 5, false 0, maybe-false 0 (rejected: 11).

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | blind, edge, intent | A visit dated before an admin PATCH but synced after it is never flagged | low | reject | Owner decided `visited_at` over `received_at` (frozen "Decided"); the consequence is stated to them at the checkpoint. Docs gain one sentence (see 9) |
| 2 | blind, edge, intent | Any PATCH stamps, incl. `assignedTo`-only or `nextVisitAt`-only | low | reject | No UI path sends those bodies (`changeStatus` is the only PATCH caller); fixing needs per-field branches; docs already say "Any PATCH" |
| 3 | blind, edge | Toggle label shows the previous unfiltered `total` while the filtered request is in flight (`keepPreviousData`) | low | patch | Real: `outOfTargetCount` ignores `isPlaceholderData`; stubs return one total so tests cannot see it. Guard it and test with two totals |
| 4 | verification | `outOfTarget` with `total` 0 is never rendered; dropping `|| filters.outOfTarget` from `filtered` shows the "import" empty state | low | patch | Real: the normal end state of the workflow; add a screen test |
| 5 | blind, edge | Only the csv import is tested, matrix says CSV/OSM | low | patch | Add the `osm` source to the survives-import test |
| 6 | blind | "Hors cible signalé" is a new term missing from the glossary | low | patch | CLAUDE.md "glossary always"; one row |
| 7 | blind | SQL double-wrapped subselect, no EXPLAIN, runs for list and total | low | reject | Runs only when the filter is on; reads a prospect's own visits through `visits_prospect_visited_idx`; no named harm at 2 agents |
| 8 | blind | Toggle's accessible name changes with state | low | reject | `aria-pressed` carries the state; cosmetic, fix is a redesign |
| 9 | blind | Docs do not state the late-sync consequence | low | patch | One sentence in prospecting.md (folds with the patch above) |
| 10 | blind | `docs/domains/prospecting.md` still says "no download button yet" | low | defer | Pre-existing drift, not caused here; issue #256 |
| 11 | verification | `id` tie-break not pinned by a test | low | reject | Needs identical `visited_at` and `received_at`; the `received_at` rule is covered |
| 12 | edge, verification | Unmerge, merge of the flagged absorbed side, repeated param, future-dated test visit, date-dependent tests | low | reject | Unmerge writes only `merged_into` and `updated_at`; absorbed rows are never listed; the rest are test hygiene without a named harm |
| 13 | blind | Spec file state, stale line numbers, design.md mid-sentence insert | low | reject | Fix is editing this build's spec or cosmetic |

## Design Notes

SQL shape: a correlated subselect picks the latest visit per prospect via `visits_prospect_visited_idx`; flagged = its `refusal_reason = 'out_of_target'` and (`out_of_target_reviewed_at` null or `<=` its `visited_at`). Pruned by `last_visit_at is not null` and `merged_into is null`. It runs only when the filter is on, so an unfiltered list pays nothing.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: green
- `pnpm build` -- expected: green, precache ≤ 1,000 KiB
