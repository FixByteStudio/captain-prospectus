---
title: 'Refactor sweep (GH #116)'
type: 'refactor'
created: '2026-09-27'
status: 'done'
baseline_commit: '10498cdff142e8577b6f3c2a08ad5ba4bda6c5df' # merge-base of refactor/116-dashboard-sweep and main (epic #59 retro F2)
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick', 'duplication-map']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-104-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic #104's eleven dashboard stories left small copies and doc drift behind. `DashboardScreen` repeats its panel-row wrapper (shown unless failed with no data, `aria-busy`, dimmed on placeholder data) three times. The status bar fills (`bg-status-new`, `bg-status-assigned`, `bg-warn`, …) are spelled in both `PipelinePanel` and `OpenProspectsBar`. In `routes/admin.ts`, the prospect key `coalesce(merged_into, id)` is written three times, and the "manual status still in force" predicate twice. Two comments still say "later stories add…", and `docs/design.md`'s Grid line says the same. Its Failure line says the Alert replaces the cards, but a failed refetch keeps them under it. `docs/vision.md`'s last bundle measurement is 677.09 KiB from epic #59 (deferred from spec-gh-115).

**Approach:** Give each copy one home without changing the rendered DOM, the SQL text or its bound parameters, the routes or the stored data. Add a local `PanelRow` in `DashboardScreen` and `STATUS_FILL` in `admin/status.ts` beside `STATUS_EDGE`. Add module-level `PROSPECT_KEY` and `MANUAL_STATUS_IN_FORCE` SQL fragments in `admin.ts`. Reword the stale comments and the two design.md lines, and append a dated measurement to vision.md. Every existing test passes unchanged. No new dependency, no copy change, no behaviour change. Behaviour items stay with their filed issues (#135, #136, #147, #151, #159–#162). The PR quotes the precache total and entry chunk before and after.

</frozen-after-approval>

## Implementation Notes

Oneshot: about 80 mechanical lines across five source files and two docs, with no design choice left open. The scope comes from the epic's build records (spec-gh-105…115 triage tables), `deferred-work.md`, and a read of every file the epic added. It is limited to what can move without a behaviour change.

- `DashboardScreen.tsx`: a local `PanelRow` takes `busy`, `dimmed` and the grid classes. One `showPanels &&` fragment holds the three rows, because a fragment adds no DOM. `cn(className, dimmed && "opacity-60")` gives the same class strings as the three old `cn(...)` calls. The stale "Later stories add…" line is gone from its doc comment.
- `STATUS_FILL` lives in `admin/dashboard/status-fill.ts`, **not** in `admin/status.ts` as the Approach says. The first build with it in `status.ts` put the map in the field entry chunk (+0.13 kB, 899.85 KiB), because the field's `StopRow` imports that module. That breaks epic Done-when 4. With the move the precache is unchanged. `PipelinePanel` keeps its count ink as `COUNT_INK`. It is not `STATUS_TEXT`, which adds `font-medium` beside the panel's `font-semibold`.
- `admin.ts`: `PROSPECT_KEY` and `MANUAL_STATUS_IN_FORCE` are module-level `sql` fragments above `agentConversions`. They replace the inline copies (3 of the key and 2 of the predicate). The SQL comments stay inside the templates, so the statement text and its parameters are byte-identical.
- `TodoPanel.tsx`: its over-long doc-comment line is rewrapped.
- `docs/design.md`: the Grid line no longer promises later stories, and the Failure line says that a failed refetch keeps the figures. `docs/vision.md` records the 2026-09-27 measurement (closes the spec-gh-115 deferral). Two more "later stories" lines, in `schemas.ts` and `docs/api.md`, now read as the rule they state: a new figure is additive.
- Precache before 899.71 KiB / 25 entries, entry 389.20 kB. After: 899.71 KiB / 25 entries, entry 389.20 kB. Recharts only in `AdminApp-*.js`.
- lint and typecheck are green. Tests: 1623/1623 pass with no test file edited. That is 3 more than the 1620 at baseline, because `palette.test.ts` and `safe-area.test.ts` run one case per source file and now also scan `status-fill.ts`.

## Review Triage Log

**Pass 1** (lenses: quick, duplication-map). Counts: high 0 · medium 0 · low 6 patched · rejected-low 9 · accepted 3 · deferred 1 (GH #167).

| # | Lens | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|---|
| 1 | quick | "Later stories extend it additively" still in `schemas.ts:533` and `docs/api.md:112` | low | patch | Reworded as the standing rule: a new figure is additive |
| 2 | quick | Removing the SQL `--` comments changes the statement text, against the frozen Approach | low | patch | Comments restored inside both templates; the text is byte-identical again |
| 3 | quick | design.md Failure: Dernières visites still renders under the Alert | low | patch | Now "the KPI cards and the panels above Dernières visites, which keeps its own feed" |
| 4 | quick | vision.md explains the precache rise but not the entry chunk's, and credits one epic only | low | patch | Now states both figures' baseline and credits epics #104 and #117, whose PRs each quote their own |
| 5 | quick | `STATUS_FILL` is not where the frozen Approach puts it | low | patch | Justified in Implementation Notes and in the file's comment. The PR description calls it out for the owner |
| 6 | dup | Three `showPanels && <PanelRow` guards | low | patch | One fragment; no DOM change |
| 7 | dup | `conversionCounts` doc still restates `coalesce(merged_into, id)` | low | patch | Now "keyed by `PROSPECT_KEY`" |
| 8 | dup | `COUNT_INK` repeats `STATUS_TEXT`'s colours | low | reject | Reusing it reorders or reweights the class string (`font-medium` vs `font-semibold`), which is a DOM change; #128 row 3 set that bar |
| 9 | dup | `STATUS_FILL` uses `bg-warn`/`success`/`destructive`, not the `status-*` aliases | low | reject | Pre-existing, and design.md › Pipeline par statut names those tokens; changing them is a DOM change |
| 10 | dup | The converted-visits and manual-conversion sub-queries are still copied, and `const converted` ×3 | low | reject | #111 triage rejected a shared builder ("adds surface"); drift is caught by the sum test at 7/30/90 |
| 11 | dup | `min-w-0` on both the wrapper and the Card | low | reject | Pre-existing, harmless |
| 12 | dup | Five differing `SHELL` constants | low | reject | File-scoped, deliberate per-panel spacing |
| 13 | dup | `row` names two things across modules | low | reject | Different modules, no collision |
| 14 | dup | The DashboardScreen comment restates design.md's failure rule | low | reject | It carries the TanStack v5 why |
| 15 | dup | `indexes.test.ts` mirrors the SQL | — | accept | Query-plan test, documented at `:36-37`; test files are out of bounds here |
| 16 | dup | Relances dues rule in two places | — | accept | Cross-referenced at `admin.ts:558-559` |
| 17 | dup | `STATUS_FILL` kept out of `admin/status.ts` | — | accept | Forced by the field chunk boundary; the lens's own build confirmed it |
| 18 | dup | Status edge strings copied in MapStep ×3 and PreviewStep ×1 | low | defer | Outside the epic's surface. Filed as GH #167 and logged in deferred-work.md |

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- expected: green, no existing test edited
- `pnpm build && pnpm check:precache` -- expected: at or under 1,000 KiB; Recharts only in `AdminApp-*`
