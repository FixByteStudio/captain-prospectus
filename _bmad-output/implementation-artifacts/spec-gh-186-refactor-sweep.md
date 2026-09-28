---
title: 'Refactor sweep (GH #186)'
type: 'refactor'
created: '2026-09-28'
status: 'done'
baseline_commit: '01029d801d88c8aae101bc6fa2fa844af20c8bb1' # merge-base of claude/016-admin-screens-sweep and main (epic #59 retro F2)
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick', 'duplication-map']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-174-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic #174's build records left five small debts in the admin code, each named in `deferred-work.md` or a triage log and not fixed there. The admin `Input` still steps down to `md:text-sm`, against `docs/design.md` › Type (#92). Prospects patches this per site. `OUTCOME_BADGE` lives in `dashboard/outcome-series.ts` although À rattacher now reads it too (spec-gh-183 row 12). The orphan discard route validates a visit id with `prospectIdParamSchema` (spec-gh-176 row 130). Both CSV exports spell out the same `Response` tail. `DashboardScreen` hand-rolls the header that `ScreenHeader` was written for (spec-gh-175). Several other epic entries were closed by later stories but are not marked as closed.

**Approach:** Fix each one without changing a route, a stored value or anything a test asserts. Drop `md:text-sm` from the vendored `Input` default. Every field `Input` passes `touch`, which already sets `md:text-base`, so the field route renders the same. Then remove Toolbar's now-redundant override. Move `OUTCOME_BADGE` beside `STATUS_BADGE` in `admin/status.ts`, use `visitIdParamSchema` on discard, add one `csvResponse` helper in the admin routes, and swap DashboardScreen's header for `ScreenHeader`. Mark the entries this change fixes, and the ones earlier stories already fixed, with `closed_by`. The PR lists every epic #174 entry as taken, already closed or not taken, with its reason. Not taken: #147 Progress, which the field's `DailyProgress` and its test comment depend on. Also not taken: any behaviour change, any field file, and anything that needs a migration. The precache before this change is 939.28 KiB (25 entries, entry chunk 379.37 KiB). The PR quotes the total after.

</frozen-after-approval>

## Implementation Notes

Oneshot: about 80 mechanical lines. Each item is drawn from `deferred-work.md` or a spec-gh-175…185 triage log, and no design choice is left open. No GitHub review comments exist on PRs #187–#212, so the triage logs are the only record of review findings.

- `ui/input.tsx`: `md:text-sm` gone from the default. The `touch` line is left byte-identical, so every field Input's merged class string is unchanged (twMerge already dropped `md:text-sm` against `md:text-base`). `prospects/Toolbar.tsx` loses its `md:text-base` patch.
- **`OUTCOME_BADGE` went to a new `admin/outcome-badge.ts`, not `status.ts`.** The first build put it in `status.ts` and the entry chunk grew 379.37 → 379.79 KiB: StopRow imports `status.ts`, so Rollup puts that module in the entry, together with every export the admin chunk uses. The new module keeps it in `AdminApp-*` (checked by grep in `dist/`). RecentVisits' private `BADGE` string was byte-identical to `BADGE_SHAPE`, which was already in the entry chunk, so it now imports that.
- `routes/admin.ts`: `capExport` + `csvResponse` sit above the prospects export; both exports use them; docs/api.md › CSV exports names them. Discard validates with `visitIdParamSchema`.
- DashboardScreen: `ScreenHeader` with its `<p>` subtitle and `PeriodToggle` as `actions`. `cn` resolves `items-baseline`+`items-end` to `items-end`, as the old div had; the wrapper is now `<header>` (no landmark inside a `<section>`).
- `deferred-work.md`: 10 `closed_by` lines, additions only — 5 closed here, 4 by earlier stories (#178, #180, #181, #178–#184), 1 PARTLY (ScreenState; Visites ledger is #207/#208).
- Tests: 79 files, 1,893 pass (1,890 before; the +3 are palette/safe-area per-file scans picking up the new module). No test file edited.
- Precache: 939.28 KiB → 939.26 KiB, 25 entries; entry `index-*.js` 379.37 KiB → 379.37 KiB (re-measured after the review patches).
- Review patches: `ScreenHeader` now wraps a string `subtitle` in the muted lede `<p>`, so Visites, Doublons, À rattacher and the dashboard pass the copy string (Scripts keeps its own `<p>` for `max-w-2xl`); `OUTCOME_BADGE` reads `follow_up`/`converted` from `STATUS_BADGE`; `ui/input.tsx` says why `touch` still repeats `text-base`.
- Epic Done-when evidence, for the PR: DW1 — `git diff 0c7c883^ HEAD` over admin and worker tests removes one `expect`, the approved dashboard Visites KPI exception. DW3 — `worker/admin.test.ts` (q, dueBefore, from/to), `worker/export.test.ts` (export filters), `worker/dashboard.test.ts` › "The Visites strip's flyers, agents and due-soon figures (GH #177)", all on miniflare D1. DW4 — `docs/design.md` sections at :441, :500, :547, :641, :704 (provider/circle rules :718-:800), :856, :951.

## Review Triage Log

Pass 1 (lenses: quick, duplication-map). Counts: high 0 · medium 0 · low 5 (3 patched, 1 deferred, 1 surfaced) · rejected-low 4 · false 1.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | quick, dup | `OUTCOME_BADGE` is in `outcome-badge.ts`, not `status.ts` as the frozen Approach says | low | surfaced to the owner: measured +0.42 KiB in the precached entry chunk from `status.ts` (StopRow imports it). The frozen block is left as written; the Implementation Notes and the PR explain the change |
| 2 | quick | PR-body criteria not in the diff; backlog `done` before merge, boxes unticked | false | The PR body is written at hand-off. 014 and 015 flipped to `done` in their own PRs with their boxes left unticked, the same way (spec-gh-185 row 18) |
| 3 | dup | `OUTCOME_BADGE.follow_up`/`converted` repeat `STATUS_BADGE`'s strings | low | patch: read from `STATUS_BADGE`. The import stays one-way (admin → `status.ts`), so it moves nothing into the entry chunk; entry still 379.37 KiB |
| 4 | dup | Subtitle `<p className="text-muted-foreground mt-0.5">` ×5, the dashboard copy new here; `ScreenHeader`'s comment claims default styling it lacks | low | patch: a string subtitle renders that `<p>`; four callers pass the string; comment rewritten. The `ScreenHeader.test.tsx` assertions still hold unedited |
| 5 | dup | `touch` repeats `text-base` with its reason only in the spec | low | patch: one-line comment at `ui/input.tsx` |
| 6 | dup | `ui/textarea.tsx` keeps `md:text-sm`; two field callers patch it | low | defer: pre-existing, field-only consumers; #213 and `deferred-work.md` |
| 7 | dup | Outcome badge and « Flyer remis » markup byte-identical in OrphansScreen and RecentVisits | low | reject: two sites each; an `OutcomeBadge` component is new API, more than a sweep's simple correction |
| 8 | dup | `capExport` hardcodes `EXPORT_ROWS`; duplicates scan and `.limit(+1)` repeat the idea | low | reject: the third site answers JSON with its own limit, and `capExport`'s comment ties the `+1` to it |
| 9 | dup | `STATUS_EDGE[OUTCOME_TO_STATUS[…]]` ×3 | low | reject: pre-existing one-line lookup; OrphansScreen documents sharing the map on purpose |
| 10 | dup | `STATUS_BADGE` markup ×3 | low | reject: pre-existing; a component needs its own admin file (`status.ts` must stay React-free for StopRow) |

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- expected: green; no assertion line changed in any test file
- `pnpm build && pnpm check:precache` -- expected: ≤ 1,000 KiB; `OUTCOME_BADGE` absent from the `index-*.js` entry chunk (field imports `admin/status.ts` via `StopRow`)
