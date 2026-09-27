---
title: 'À traiter, Dernières visites and the CPU budget (GH #113)'
type: 'feature'
created: '2026-09-26'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: []
baseline_commit: '183965110cff190af4e65ff2b2a8eee6df8d3cae'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tableau de bord's 3:2 row has an empty right half, the full-width Dernières visites row is missing, and nobody has shown that the finished aggregate query fits Workers Free's 10 ms CPU (invariant 13).

**Approach:** `GET /api/admin/dashboard` gains `followUpsDue`, additively: live `follow_up` prospects whose `next_visit_at` is before Brussels midnight tomorrow (`to`). The screen fills the right half with À traiter — Relances dues from that field, Visites à rattacher and Doublons from the queries the sidebar already runs — and adds Dernières visites under it: the 5 newest rows of the existing 15 s visits feed. Then measure the endpoint's CPU on the 180-day seed and record it, with each statement's query plan, in the PR and `docs/free-tier-budget.md`.

**Decisions (2026-09-26, user):**
1. The spec is kept whole despite running past 1,600 tokens.
2. CPU is measured with a committed, dependency-free script that profiles the dev Worker's isolate over the inspector (CDP), 50 requests per period on the 180-day seed.
   *Amended 2026-09-26, user:* the inspector proved unusable (workerd samples a request ~18 times and books D1 waits to arbitrary frames: ~28 ms reported). The committed script instead runs the production-bundled Worker in Node's V8 against a copy of the seeded D1 through a `node:sqlite` shim, D1's own CPU taken out; its JSON is byte-identical to the dev Worker's.

## Boundaries & Constraints

**Always:** Relances dues is a snapshot (ignores the period), live only (`merged_into IS NULL`), and a null `next_visit_at` is not due. One statement, a handful of bound parameters (invariant 7). The contract stays additive, in zod/mini, and `docs/api.md` defines the field. À rattacher is `visits.length + remaining` from `useOrphans()`; Doublons is `pairs.length` from `useDuplicates()`; no new request. At 0, or while its query is loading or failed, a row's count is muted and its button disabled. Dernières visites reuses `useVisitsFeed()` (same cache entry as Visites) and its `arrived` ids: the wash and one polite `role="status"` sentence per poll count only arrivals among the 5 shown. Badges follow design.md › Badges with a 4px outcome edge in the outcome's colour (`SERIES_TOKEN`'s tokens). Colours from tokens only; French strings in `copy.ts`. `check:precache` passes and the PR quotes the total and the entry chunk.

**Never:** No polling of `/api/admin/dashboard` (a 15 s aggregate would burn the D1 daily read quota). No schema change, migration or new dependency. No change to the visits feed's API (the prospect's type and address from the mockup's meta line stay out). No filtered Prospects link: Relances dues' Voir opens `/admin/prospects` unfiltered, and story 10 (#114) adds the filter. No field-route change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Due today | follow_up, `next_visit_at = to − 1` | counted | — |
| Due tomorrow | follow_up, `next_visit_at = to` | not counted | — |
| Overdue | follow_up, `next_visit_at` 40 days ago | counted, at every period | — |
| Brussels boundary | now = 23:30 and 00:30 Brussels, incl. a DST-change day | the midnight that flips "today" is Brussels', not UTC's | — |
| Not due | merged, other status, or null `next_visit_at` | not counted | — |
| Empty queues | 0 due, 0 orphans, 0 pairs | three muted 0s, three disabled buttons | — |
| Queue query fails | orphans request 500 | that row muted and disabled, rest renders | no Alert: the sidebar hides its badge the same way |
| New visit | a poll brings 1 visit | it tops the list with a wash; one announcement "1 nouvelle visite" | — |
| Opening page | first answer holds 500 visits | 5 rows, no wash, no announcement | — |
| No visits | feed empty | "Aucune visite reçue…" | feed error → inline `copy.visits.loadFailed` |

</frozen-after-approval>

## Code Map

- `src/worker/routes/admin.ts:203` -- add to the `Promise.all`: `select count(*) from prospects where merged_into is null and status = 'follow_up' and next_visit_at < ${to}` (on `prospects_status_idx`); return `followUpsDue`.
- `src/shared/schemas.ts:590` -- `followUpsDue: countSchema` in `dashboardResponseSchema`, with a doc comment.
- `src/worker/dashboard.test.ts` -- new `describe("À traiter (GH #113)")`: one test per matrix row 1–5, reusing `seedProspect` (give it an optional `nextVisitAt`) and `vi.useFakeTimers({ toFake: ["Date"] })` as at line 482.
- `src/client/admin/dashboard/TodoPanel.tsx` (new) -- À traiter `Card`: three rows (40px `secondary` icon tile — Lucide `Clock`, `Link`, `Copy` — label, meta line, `tabular-nums` count, `Button variant="secondary"` as `Link`): Voir → `/admin/prospects`, Rattacher → `/admin/a-rattacher`, Fusionner → `/admin/doublons`. Plus a skeleton.
- `src/client/admin/dashboard/RecentVisits.tsx` (new) -- Dernières visites `Card` with `ui/table` like `AgentActivityTable.tsx`: Heure (`formatDateTime(receivedAt)`), Prospect, Résultat (Badge), Flyer (badge when `flyerGiven`), Agent; "Tout voir" → `/admin/visites`; `overflow-x-auto` at 390 px; empty, loading and error states; the sr-only live sentence.
- `src/client/admin/dashboard/outcome-series.ts` -- add `OUTCOME_BADGE` (text + `tint-*` classes per design.md's table) and `OUTCOME_EDGE` (`shadow-[inset_4px_0_0_0_var(--color-…)]`, as `admin/status.ts:15`).
- `src/client/admin/dashboard/DashboardScreen.tsx:180` -- TodoPanel in `lg:col-span-2` beside the table; RecentVisits in a full-width row below. TodoPanel's Relances dues follows the dashboard's placeholder/opacity; the queue counts and RecentVisits do not (their own queries).
- `src/client/copy.ts:125` -- `dashboard.todo` (title, three labels, three metas, three buttons, `pairs(n)`) and `dashboard.recent` (title, `seeAll`, five heads, empty, `arrived(n)`).
- `DashboardScreen.test.tsx`, `AdminApp.test.tsx` -- stubs gain `followUpsDue` and the feed; assert the three counts, disabled at 0, 5 rows max, and the announcement.
- `scripts/measure-dashboard-cpu.mjs` (new, no dependency) -- connects to the dev Worker's inspector (CDP over Node's built-in `WebSocket`), wraps N calls per period in `Profiler.start/stop`, and prints per-request CPU (profile samples minus idle ÷ N). D1 runs in its own workerd service, so its time is excluded, as in production.
- `docs/api.md:24,107`, `docs/design.md:272`, `docs/free-tier-budget.md:8` -- the field, both panels, and the measured CPU with the date and seed.

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/schemas.ts`, `src/worker/routes/admin.ts`, `src/worker/dashboard.test.ts` -- `followUpsDue` and matrix rows 1–5
- [ ] `outcome-series.ts`, `TodoPanel.tsx`, `RecentVisits.tsx`, `DashboardScreen.tsx`, `copy.ts` -- both panels, skeletons, grid
- [ ] `DashboardScreen.test.tsx`, `AdminApp.test.tsx` -- matrix rows 6–10
- [ ] `scripts/measure-dashboard-cpu.mjs` -- measure 7/30/90 on the seed; `EXPLAIN QUERY PLAN` every dashboard statement against the local D1
- [ ] `docs/api.md`, `docs/design.md`, `docs/free-tier-budget.md` -- Definition of Done

**Acceptance Criteria:**
- Given `pnpm db:seed:local` and `pnpm dev`, when the measure script runs 50 requests per period, then median and max CPU per request are recorded and under 10 ms, and every range read on `visits` uses `visits_visited_idx`.
- Given `/admin` open in `pnpm dev`, when a visit is synced through `/api/agent/sync`, then it shows in Dernières visites within 15 s with a wash and one announcement.
- Given `/admin` at 1280, 820 and 390 px in light and dark, then both panels match `key-a1-dashboard.html` with no horizontal page scroll.
- Given `pnpm build && pnpm check:precache`, then it passes and the PR quotes the total against 1,000 KiB and the entry chunk.

## Implementation Notes

- Implemented directly in the `feat/113-a-traiter-cpu` worktree (no implementation subagent). The spec lives in the main checkout's untracked `_bmad-output`.
- Worker: one count joins the dashboard's `Promise.all` (`followUpsDue`, `next_visit_at < to`). Tests: matrix rows 1–5 at 7/30/90, and the Brussels boundary at 23:30/00:30 on both 2026 DST days.
- Client: `TodoPanel` (queues from `useOrphans`/`useDuplicates`; orphans = `visits.length + remaining`; "—" and disabled while loading or failed) and `RecentVisits` (`useVisitsFeed`, first 5, wash and announcement only for arrivals shown). The row edge reuses `STATUS_EDGE` (the mockup's row edge is the outcome's consequence); `OUTCOME_BADGE` follows the mockup (ink + 4px outcome edge for the three neutral outcomes; Personne sur place on `secondary`, no new tint token).
- Screen tests: the fetch stub now routes by path and the screen renders in a `MemoryRouter` (links).
- CPU (see decision 2's amendment): warm 0.46–0.55 ms median, 2.51 ms worst over 200 requests a period; cold first request 7.7–9.9 ms, ~4 ms of which any first route pays. Earlier attempts: inspector profile (unusable), workerd process CPU via `/proc` (8–11 ms, but includes local SQLite and the dev proxy: an upper bound too loose to settle it).
- Plans (`EXPLAIN=1`): every `visits` range read uses `visits_visited_idx`; the largest statement binds 11 parameters; Relances dues uses `prospects_status_idx`.
- `pnpm dev` on the seed: 13 Relances dues, 2 à rattacher, 1 paire. A visit synced through `/api/agent/sync` showed on top 10.7 s later with the wash and one "1 nouvelle visite". 1280 light/dark, 820, 375: no page scroll.
- Precache 892.82 → 894.60 KiB of 1,000 (CSS +1.27, `schemas-*` +0.52); entry `index-*.js` unchanged at 379.85 KiB.
- Found in passing: at 1280 the Activité par agent table overflows its 3:2 card by 12 px (575 vs 587), a sideways scroll hiding part of Prospects ouverts — the grid is #112's, unchanged here.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped, not a refactor). Verdicts: 0 high, 2 medium, 11 low, 3 false, 1 maybe-false. 0 intent_gap, 0 bad_spec, 9 patched, 3 deferred, rest rejected.

- `medium` / **patch**: edge-case-hunter. Returning to Tableau de bord from Visites seeded the list from the shared cache's last *delta* page, so the `since=0` refetch washed and announced every row. Pre-existing on a Visites remount too, but this story made it hit the landing page and it breaks matrix row "Opening page". Fix: `useVisitsFeed` skips answers older than its mount and reports pending until its own first answer; test primes the cache and asserts no wash (fails without the fix). Checked in `pnpm dev`: Visites → Tableau de bord after a poll, 0 washed rows.
- `medium` / **defer** (#159): blind-hunter, edge-case-hunter, verification-gap, intent-alignment. À traiter counts `visits.length + remaining` (the frozen boundary) while the sidebar badge counts the page only, so past 200 orphans they differ. The sidebar formula is pre-existing. This change's docs and comments claimed they "never disagree": patched to say what each counts.
- `low` / **patch**: edge-case-hunter. A failed poll with rows held was silent. Fix: `loadFailed` shows whenever the feed errs, as on Visites; test added.
- `low` / **patch**: blind-hunter. The wash could not fade (transition only on new rows). Fix: the transition is on every row. Same pre-existing bug on Visites filed as #162.
- `low` / **patch**: verification-gap. "Counting only rows shown" was unpinned. Fix: test with one arrival above and two below the fifth row.
- `low` / **patch**: blind-hunter. Test name claimed failure coverage. Fix: renamed.
- `low` / **patch**: blind-hunter, edge-case-hunter. `EXPLAIN=1` exited inside `try`, leaking the temp copy of the seed. Fix: if/else; checked no `dashboard-cpu-*` remains.
- `low` / **patch**: blind-hunter, edge-case-hunter, intent-alignment. The doc's cold figure was not reproducible by the script. Fix: the script times the fresh module's first request, prints it and gates on it; docs updated with three runs (7.9–8.2 ms).
- `low` / **patch**: blind-hunter. "Bundled as for production" overstated (`configFile: false`), and Node 24 went unstated. Fix: header reworded.
- `low` / **patch**: blind-hunter. Shadowed `worker`. Fix: `workerMs`/`sqlMs`.
- `low` / **patch**: intent-alignment D1. The plans were in the PR only, not in `free-tier-budget.md` as the intent says. Fix: a plans bullet there; api.md's cost note dated "as of GH #113".
- `low` / **defer** (#160): blind-hunter. Identical consecutive announcements are not re-read; same pattern on Visites, pre-existing.
- `low` / **defer**: verification-gap. No automated CPU check; it needs the seeded local D1 and hardware timing, so the documented "re-measure" is the control.
- **rejected** (`low`): blind-hunter. Doublons ignores `truncated` (needs > `DUPLICATES_SCAN_LIMIT` rows; the sidebar does the same; fix adds a branch and copy).
- **rejected** (`low`): blind-hunter. À traiter's queue counts dim on a period switch and hide when the dashboard fails; brief and cosmetic, and the fix restructures the grid.
- **rejected** (`low`): blind-hunter. Relances dues stale across midnight in an idle tab; the figures do not poll by design (Never), and any mutation or reload refreshes.
- **rejected** (`low`): edge-case-hunter. Script env robustness (RUNS=0, missing dir, several `.sqlite`, a quote in `tmpdir`): a developer tool, unlikely inputs.
- **rejected** (`low`): edge-case-hunter, intent-alignment. 200 runs rather than 50: a superset of the AC's run size.
- **rejected** (`false`): intent-alignment. Plans with placeholders bound to null: D1 runs no ANALYZE, so SQLite's plan depends on the statement's shape, not the values.
- **rejected** (`false`): intent-alignment. "Byte-identical" unchecked by committed code: verified once by diffing the shim's three answers against `pnpm dev`'s (Implementation Notes); a claim about the method, not a runtime guard.
- **rejected** (`false`): blind-hunter. api.md's cost claims "unenforced": dated and pointed at the script that re-checks them.
- **rejected** (`maybe-false` → `low`): intent-alignment. The 15 s interval is exercised only via `refetchQueries` in tests; `pnpm dev` showed a synced visit 10.7 s later.

## Design Notes

**Why `next_visit_at < to` rather than a date compare.** `to` is Brussels midnight tomorrow from `brusselsPeriod`, the one home of the day boundary, so "today or earlier" costs one bound parameter and cannot disagree with the other figures.

**Why a CPU profile, not a timer.** Workers freeze `Date.now()` and `performance.now()` between I/O, and neither wrangler nor the Vite plugin enforces the CPU limit. The inspector's CPU profile counts the isolate's own work — zod, `Intl`, row mapping, JSON — which is what the 10 ms meters.

## Verification

**Commands:**
- `pnpm test` -- expected: all projects pass
- `pnpm typecheck` and `pnpm lint` -- expected: clean
- `pnpm build && pnpm check:precache` -- expected: exit 0
- `node scripts/measure-dashboard-cpu.mjs` (with `pnpm dev` running on the seed) -- expected: max < 10 ms per period

**Manual checks:**
- `/admin` at 1280/820/390, light and dark; sync a visit and watch Dernières visites.
