---
title: 'Visites dans le temps (GH #110)'
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
baseline_commit: 'b78cb0d057823a2bff8576efec67b700559ad750'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tableau de bord shows four KPIs but not how visits and their outcomes spread over the period, so the admin cannot see which days the field was busy or how results trend.

**Approach:** `GET /api/admin/dashboard` gains `visitsByDay` additively: one entry per Brussels calendar day of the period, oldest first, each with a count per outcome. The screen gains the "Visites dans le temps" card beside the KPIs row, drawn with shadcn Chart (Recharts, vendored into `src/client/ui/chart.tsx`, admin chunk only) as a stacked bar per day with the rules of DESIGN.md › Components › Charts.

**Decisions (2026-09-26, user):**
- A segment prints its count only when it is ≥ 22 px tall **and** wide enough for its digits (~14 px): 7 days shows counts, 30 and 90 days read from the tooltip and the visually hidden table. The 1px separator is never dropped.
- Review pass 1 (2026-09-26, user): the rule wins over the stated outcome. The width floor is per count, `max(14, digits × 7 + 4)` px, so 30 days prints the counts that fit at wide screens and 90 days none; the tooltip and the table carry every count.
- The spec is kept whole despite running past 1,600 tokens.

## Boundaries & Constraints

**Always:** Reuse `brusselsPeriod` and the `[from, to)` bound from `src/shared/period.ts`; a day is a Brussels calendar day, so a DST day is 23 h or 25 h. Visits count by clamped `visited_at`, quarantined ones out, merged prospects' visits in (same as `visits`). Counts are computed in SQL with bound parameters, one statement, few parameters (invariant 7). The contract change is additive, zod/mini. Series order is `OUTCOMES` order, Personne sur place at the bottom, Converti at the top. Colours come from the `outcome-*`, `warn` and `success` tokens; label ink is `primary-foreground` on no-contact and `card` on the other four in light, `primary-foreground` on all five in dark. A 1px `card` stroke on each edge a segment shares with a non-empty neighbour. The tooltip lists all five series, zeros included. The legend sits above the plot and has no click handler. A visually hidden table gives each day's counts. French strings only in `copy.ts`. Recharts only in `AdminApp-*`; `check:precache` passes. Docs updated in the same change (`docs/api.md`, `docs/design.md`).

**Never:** No per-chart period switch, no legend toggle, no sparklines (story 7), no pipeline or agent panel (story 8), no clickable bars (story 10). No schema change or migration. No new dependency besides `recharts` (and a peer it needs). No hardcoded colour.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Shape | period 7 / 30 / 90 | `visitsByDay` has exactly 7 / 30 / 90 entries, first `date` = Brussels date of `from`, last = today | — |
| Per outcome | day 0: 2 no_contact, 1 converted; day 3: 1 follow_up | those counts at those indexes, every other count 0 | — |
| Day bounds | visits at a day's midnight and at next midnight − 1 | both on that day | — |
| Period bounds | visit at `from − 1` / at `to` | in no entry | — |
| DST | period spanning the last Sunday of March or October; visit at 23:30 Brussels on the 25 h / 23 h day | counted on that Brussels date | — |
| Totals | any seed | sum over days and outcomes = `visits.value` | — |
| Label | segment 22 px tall and ≥ 14 px wide / 21 px tall / 22 px tall but 5 px wide | printed / not / not | — |
| Empty | no visits in the period | all-zero bars, axis still shows the days | — |

</frozen-after-approval>

## Code Map

- `src/shared/period.ts` -- add a helper that returns, for `[from, to)`, the Brussels offset before and after its (at most one — clocks change 5–7 months apart, a period is ≤ 90 days) DST change and the instant of that change, plus the period's `YYYY-MM-DD` dates. Reuse `offsetAt`/`wallClock`; dates by `Date.UTC(y, m − 1, d + i)` arithmetic, not one Intl call per day (invariant 13). Tests in `period.test.ts`.
- `src/worker/routes/admin.ts:199` -- one more statement in the `Promise.all`: `select day, outcome, count(*) from visits where visited_at in [from, to) group by day, outcome`, where `day = (visited_at + case when visited_at >= changeAt then after else before end) / 86400000 − firstDay` (integer division on Brussels wall-clock ms). Fill a dense array in TS. `visits_visited_idx` serves the range.
- `src/shared/schemas.ts:504` -- `visitsByDay: z.array(z.object({ date: <YYYY-MM-DD>, counts: z.record(outcomeSchema, countSchema) }))`; zod 4's enum-keyed record is exhaustive.
- `src/worker/dashboard.test.ts` -- new `describe` for `visitsByDay`; reuse `seedProspect`, `seedVisits(…, outcome)`, `dashboard`, `brusselsPeriod`; `it.each(DASHBOARD_PERIODS)`.
- `src/client/ui/chart.tsx` -- new, shadcn Chart (Recharts 3 variant) vendored as shipped; any English strings it ships go to `copy.ts`.
- `src/client/admin/dashboard/VisitsChart.tsx` -- new card: title, `ChartContainer` + `BarChart` with five stacked `Bar`s, custom `shape` (fill + separator line), `LabelList` content gated on height, `ChartTooltip` with every series, `ChartLegend verticalAlign="top"`, sr-only table (`src/client/ui/table.tsx`), and a skeleton. Pure helpers (label visibility, which edge gets the stroke) exported and unit-tested.
- `src/client/admin/dashboard/DashboardScreen.tsx` -- the chart row under the KPIs: `lg:col-span-2` of a 3-column grid, leaving the pipeline's third for story 8.
- `src/client/admin/dashboard/DashboardScreen.test.tsx`, `src/client/admin/AdminApp.test.tsx` -- stub responses gain `visitsByDay`; assert the summary table's cells. Recharts draws nothing at 0 width in happy-dom, so the DOM test reads the table, not the SVG.
- `src/client/format.ts` -- a day-label formatter from `YYYY-MM-DD` (UTC zone, so the date never shifts).
- `src/client/copy.ts` -- `dashboard.visitsChart` title, the five series labels (reuse existing outcome labels if `copy.ts` already has them), the table caption and headers.
- `src/client/styles/palette.test.ts` -- DESIGN.md rule 7: each segment label ink ≥ 4.5:1 on its series, both themes.
- `scripts/check-precache.mjs:51` -- already lists `recharts`; add Recharts' own runtime deps (`@reduxjs/toolkit`, `react-redux`, `victory-vendor`, `immer`) only if the map shows them as separate packages. No other change.
- `docs/api.md:24,107` -- the field in the route row and its definition; `docs/design.md:272` -- the chart under Tableau de bord.

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/period.ts`, `period.test.ts` -- offset/transition and dates helper, DST cases in March and October
- [ ] `src/shared/schemas.ts` -- additive `visitsByDay`
- [ ] `src/worker/routes/admin.ts`, `src/worker/dashboard.test.ts` -- the statement and one test per matrix row, 7/30/90
- [ ] `package.json`, `src/client/ui/chart.tsx` -- `pnpm add recharts`, vendor shadcn Chart
- [ ] `src/client/admin/dashboard/VisitsChart.tsx` (+ `.test.tsx`), `DashboardScreen.tsx`, `copy.ts`, `format.ts` -- the card
- [ ] `src/client/styles/palette.test.ts` -- rule 7
- [ ] `docs/api.md`, `docs/design.md` -- DoD

**Acceptance Criteria:**
- Given the #108 seed in `pnpm dev`, when `/admin` opens at 7, 30 and 90 jours, then the chart matches `key-a1-outcome-chart.html` in light and dark: order, colours, separators, counts in tall segments, legend above, tooltip with five rows.
- Given `pnpm build && pnpm check:precache`, then it passes, Recharts is only in `AdminApp-*`, and the precache total is quoted against 1,000 KiB (last 695.74 KiB) with the entry chunk unchanged.
- Given the PR, then it states Recharts' size (added gzip to `AdminApp-*`), maintenance and why the platform can't do it.

## Implementation Notes

- Implemented directly by the orchestrator in the `feat/110-visits-chart` worktree (the spec lives in the main checkout's untracked `_bmad-output`).
- `period.ts`: `periodOffsets(from, to)` bisects to the hour between two Brussels midnights; `periodDates(from, days)` uses one Intl call plus `Date.UTC` arithmetic. `DAY_MS` exported.
- Worker: D1 binds JS numbers as REAL, so the day expression is `cast(... / DAY_MS as integer) − firstDay`; without the cast every row fell off the dense array. 7 bound parameters. Plan pinned in `indexes.test.ts` (`visits_visited_idx`, no `SCAN visits`). DST rows run under `vi.useFakeTimers({ toFake: ["Date"] })` at 3 April and 30 October 2026.
- Schema: `visitsByDay: [{ date: z.iso.date(), counts: z.record(outcomeSchema, count) }]`.
- `chart.tsx` vendored from shadcn `new-york-v4` registry (Recharts 3 variant) with three changes: dark selector `[data-theme="dark"]`, fr-FR `formatCount` for tooltip values, no `font-mono` (design.md forbids monospace). No English UI strings in it.
- Colours: `@theme inline` never declares `--color-*` at runtime, so the chart config points at the raw `:root` tokens (`var(--outcome-no-contact)`, `var(--warn)`, `var(--success)`); caught in the seeded browser check (series rendered black).
- Recharts 3 lists stacked series top-down in the legend; `itemSorter` restores `OUTCOMES` order. Tooltip widened (`min-w-48`) so "Personne sur place" does not touch its count.
- Dependencies: `recharts@^3.10.1`, and `react-is@^19.3.0` because pnpm resolved Recharts' `react-is` peer to 17.0.2, which does not recognise React 19 elements.
- `check-precache.mjs` ADMIN_ONLY gains Recharts' chart-only deps (`victory-vendor`, `@reduxjs/*`, `react-redux`, `redux`, `decimal.js-light`); the chunk map shows all Recharts deps only in `AdminApp-*`.
- Sizes (baseline b78cb0d → this branch): `AdminApp` 475.17 → 853.48 kB min (141.23 → 250.68 kB gzip, +109.45 kB gzip); entry 386.23 → 386.64 kB; precache 700.03 → 704.60 KiB of 1,000 (+4.57 KiB: CSS +3.91 KiB — Tailwind's single stylesheet gains shadcn Chart's `[&_.recharts-*]` selectors (~1.9 kB) and the chart's utilities — entry +0.40 KiB copy/formatters, schemas +0.26 KiB).
- Seeded `pnpm dev` (#108 seed, port 5310): checked 1280 light/dark at 7/30/90, 820 dark 30, 390 light 7 and dark 90, no horizontal scroll; order, colours, separators, counts, legend above, five-row tooltip with zeros match `key-a1-outcome-chart.html`. At 90 days no counts print (width floor), as decided.
- Verification: typecheck clean, lint clean, 58 files / 1338 tests pass, build exits 0, `check:precache` exit 0.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: 0 high, 2 medium, 6 low, 9 false, 1 maybe-false. 1 intent_gap (resolved by the user without revert), 6 patched, 2 deferred, 10 rejected.

- `medium` / **intent_gap → resolved**: intent-alignment 3.2, edge-case-hunter (digits). At 1280 px a 30-day bar is ~16 px, so counts print at 30 days, against the decision's "30 and 90 days read from the tooltip"; and a fixed 14 px floor lets a 3-digit count spill. Asked the user: the rule wins, digit-aware (`max(14, digits × 7 + 4)`). Decision recorded in the frozen block; `showsCount` takes the count; tests and design.md follow. No revert: the answer kept the rest of the code as it was.
- `medium` / **patch**: blind-hunter, verification-gap. Rule 7 in `palette.test.ts` proved a hand copy of the chart's ink map, so a changed `INK`/`TOKEN` passed. Fix: `outcome-series.ts` holds `SERIES_TOKEN`/`SERIES_INK`; the chart and rule 7 both read it; the segment test covers all four card-ink series.
- `low` / **patch**: verification-gap. The merged/quarantined test never read `visitsByDay`. Fix: assert day 0 is `interested: 2`.
- `low` / **patch**: blind-hunter. Comments cited `docs/design.md › Charts`, `› Colours` and `EXPERIENCE.md`, none in the repo. Fix: point at `docs/design.md › Tableau de bord`.
- `low` / **patch**: blind-hunter. `periodDates` had no autumn case. Fix: 24–26 October 2026.
- `low` / **patch**: blind-hunter. The DOM fixture skipped 31 October. Fix: `Date.UTC` arithmetic.
- `low` / **defer**: verification-gap. The tooltip header, legend order and tick format are wired but untested; Recharts draws nothing at happy-dom's 0 width and the repo has no pattern for it. Checked by hand in the seeded browser.
- `maybe-false` (would be `low`… recorded as defer since pre-existing) / **defer**: edge-case-hunter. The dashboard tests compute `brusselsPeriod(Date.now())` apart from the server's `Date.now()`, so a run across Brussels midnight could flake; the pattern predates this story (#107).
- **rejected** (`false`; the seeded screenshot shows the tooltip in stack order, Personne sur place first): edge-case-hunter, blind-hunter. Tooltip order.
- **rejected** (`false`; `period` and `[from, to)` both come from `brusselsPeriod(now, period)`): blind-hunter. Day count can disagree with the range.
- **rejected** (`false`; outcomes are zod-validated on every insert path): edge-case-hunter. A row whose outcome is not in `OUTCOMES`.
- **rejected** (`false`; DESIGN.md's grid puts the chart under the KPIs, 2:1 with the pipeline): intent-alignment 3.1, edge-case-hunter. Placement "beside".
- **rejected** (`false`; a chart title is not a domain term): blind-hunter. Glossary entry.
- **rejected** (`false`; the generic ones are left out on purpose, commented): blind-hunter. `eventemitter3`/`reselect` missing from ADMIN_ONLY.
- **rejected** (`false`; the PR description states size, maintenance, workerd and why): blind-hunter. Dependency justification; `react-is` is pinned to React's major.
- **rejected** (`low`, unlikely: two agents never log 1,000 visits a day): blind-hunter. Y axis width 32 clipping 4-digit ticks.
- **rejected** (`low`; #109's triage accepted the same pattern, and a shared builder adds surface): blind-hunter. Plan test copies the SQL.
- **rejected** (`low`; keyboard users keep Recharts' tooltip path, the table serves screen readers): blind-hunter. Double exposure to assistive tech.
- descriptive, no action: intent-alignment 1, 2, 3.4–3.6.

## Design Notes

**Why an offset switch, not 90 bound day edges.** A `case` over each day's midnight costs one parameter per day, and 90 + the rest crosses invariant 7's 100. Brussels offsets are whole hours and change at most once in a period, so `(visited_at + offset) / 86 400 000` is the Brussels day number with a single switch point.

**Separator.** Recharts' `stroke` outlines all four sides. A custom `shape` draws the fill, then a 1px `card` line on the top edge when a non-empty series sits above it in the same day — the mockup's `border-top` on every segment but the topmost.

## Verification

**Commands:**
- `pnpm test` -- expected: all projects pass
- `pnpm typecheck` -- expected: clean
- `pnpm lint` -- expected: clean
- `pnpm build && pnpm check:precache` -- expected: exit 0; total and `AdminApp-*` size quoted

**Manual checks:**
- `pnpm dev` with `pnpm db:seed:local`: `/admin` at 1280, 820 and 390 px in light and dark for 7, 30 and 90 jours, compared with the mockup.
