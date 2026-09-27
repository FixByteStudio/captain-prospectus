---
title: 'Convertis and Taux de conversion (GH #109)'
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
baseline_commit: 'cc1295cfa4b93bc2a39cd715433fd319490866ba'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tableau de bord shows only Prospects ouverts and Visites. The admin cannot see how many prospects converted in the period, or what share of the prospects visited converted, which is the figure CAP-2 is about.

**Approach:** `GET /api/admin/dashboard` gains `converted` (Convertis, with its previous period and delta) and `conversionRate` (Taux de conversion) additively, and the screen gains their two KPI cards. A prospect converted in a period when it has a visit with outcome `converted` in the period, or its status is `converted` with `status_set_at` in the period (a manual change). It counts once however many times that happens. The rate is Convertis ÷ distinct prospects with a visit in the period.

**Decisions (2026-09-26, user):**
- A merged prospect resolves to its survivor: every visit and manual change is keyed by `coalesce(merged_into, id)`, so one place counts once in Convertis and in the rate's denominator. One hop only; a chain A→B→C counts A under B.
- A conversion is an event: a prospect converted in the period and reopened later in it still counts, and a past period never shrinks.
- Taux de conversion's delta is in percentage points, `value − previous`, shown "+1,2 pt" as in the mockup, and `null` when either rate is `null`. It is the one documented exception to the Delta rule.
- The spec is kept whole despite running past 1,600 tokens.

## Boundaries & Constraints

**Always:** Reuse `brusselsPeriod` and `deltaOf` from `src/shared/period.ts`, and the boundary `[from, to)` / `[previousFrom, from)` story 3 defined. Convertis' delta follows the general rule (`null` when previous is 0). Visits count by clamped `visited_at`; quarantined visits are out. Every figure is computed in SQL in the Worker, with bound parameters. The contract change is additive, in zod/mini. French strings only in `copy.ts`. Update `docs/api.md` › The dashboard, `docs/design.md` › Tableau de bord and the glossary in the same change.

**Never:** No sparkline, no gold progress bar, no "N convertis sur M prospects visités" caption (story 7). No clickable card (story 10). No chart, pipeline or agent table (stories 6, 8). No schema change, migration, new column or npm dependency. No polling.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| By visit | one `converted` visit at `from` | `converted.value` 1 | — |
| Manually | status `converted`, `status_set_at` in the period, no visit | `converted.value` 1; not in the rate's denominator | — |
| Twice | two `converted` visits, or one plus a manual change, in the period | counted once | — |
| Boundaries | conversion at `from − 1` / at `to` | previous period / neither | — |
| Manual, overridden | `status_set_at` in the period, a later visit made it `follow_up` | not counted manually (only the latest manual change is stored) | — |
| Previous empty | no conversion in the previous period | `converted.delta: null`, card "—" | — |
| No visits | nothing visited in the period | `conversionRate.value: null`, card "—" | — |
| Rate | 2 converted of 8 visited prospects | `conversionRate.value` 0.25, card "25,0 %" | — |
| Rate delta | 0.25 now, 0.20 before / previous `null` | `delta` 0.05, chip "+5,0 pt" / `null`, "—" | — |
| Merged | absorbed A → survivor B, both converted by visit in the period, both visited | `converted.value` 1, `visitedProspects.value` 1 | — |
| Reopened | `converted` visit, then a later `follow_up` visit, both in the period | still counted | — |

</frozen-after-approval>

## Code Map

- `src/shared/schemas.ts:503` `dashboardResponseSchema` -- add `converted: { value, previous, delta }` (same shape as `visits`) and `conversionRate: { value, previous, delta, visitedProspects: { value, previous } }`, where the rates are `z.nullable(z.number().check(z.nonnegative()))` ratios (0.106 = 10,6 %), `null` when no prospect was visited. `visitedProspects` is the denominator, for story 7's caption.
- `src/worker/routes/admin.ts:198` -- extend the `Promise.all` with one statement over both periods: the visits range `[previousFrom, to)` joined to `prospects` (served by `visits_visited_idx`), `UNION ALL` the manual branch `status = 'converted' AND status_set_at` in range (served by `prospects_status_idx`). Each event row carries the prospect key, whether it is current, and whether it is a visit. `count(distinct case …)` gives converted and visited for each period. Compute the rates and deltas in TS. Keep the existing two statements untouched.
- `src/shared/period.ts` -- reuse `deltaOf`; add `rateOf(n, d)` (`null` when `d` is 0) only if the worker and tests both need it.
- `src/worker/dashboard.test.ts` -- extend `seedProspect` with `statusSetAt` and `seedVisits` with an outcome. Reuse `call`, `dashboard` and `beforeEach`.
- `src/client/format.ts` -- `formatPercent(ratio | null)` → "10,6 %" or "—", and `formatPoints(delta | null)` → "+1,2 pt", "−0,4 pt", "0,0 pt" or "—". Reuse `tenth`, `tenths` and U+2212 / U+00A0 as `formatDelta` does; tone comes from `deltaTone`.
- `src/client/admin/dashboard/KpiCard.tsx` -- `value` becomes a preformatted figure or accepts a `format` prop; the delta chip accepts a formatter. Keep the card shell and skeleton unchanged.
- `src/client/admin/dashboard/DashboardScreen.tsx` -- Convertis (Lucide `BadgeCheck`) and Taux de conversion (Lucide `Percent`) after Visites, 4 cards and 4 skeletons.
- `src/client/admin/dashboard/DashboardScreen.test.tsx:25` -- the stub response gains the new fields.
- `src/client/copy.ts:132` -- `dashboard.converted: "Convertis"`, `dashboard.conversionRate: "Taux de conversion"`.
- `docs/api.md:24,121` -- the response shape in the route row; Convertis and Taux de conversion definitions under The dashboard, including the manual-change limitation.
- `docs/design.md:284` -- icons for the new cards, the rate's figure and delta, "only Prospects ouverts and Visites exist so far" updated.
- `docs/glossary.md` -- "Conversion rate | Taux de conversion".

## Tasks & Acceptance

**Execution:**
- [x] `src/shared/schemas.ts` -- the two additive fields
- [x] `src/worker/routes/admin.ts`, `src/worker/dashboard.test.ts` -- the statement and a test per matrix row, each for 7, 30 and 90 where the period matters
- [x] `src/client/format.ts`, `format.test.ts` -- the percent and rate-delta formatters, rounding and sign (points round like `formatDelta`, one decimal)
- [x] `src/client/admin/dashboard/*`, `src/client/copy.ts` -- the two cards; the DOM test asserts both figures, "—" for a `null` rate, and the rate delta's chip
- [x] `docs/api.md`, `docs/design.md`, `docs/glossary.md` -- DoD

**Acceptance Criteria:**
- Given the #108 seed, when `/admin` opens in `pnpm dev` at 7, 30 and 90 jours, then Convertis and Taux de conversion are non-zero with a numeric delta, and the four cards sit 4 across at 1280 px, 2 × 2 at 820 px and stacked at 390 px, in light and dark.
- Given `pnpm build && pnpm check:precache`, then it passes; quote the total against 1,000 KiB (last quoted 686.84 KiB).

## Implementation Notes

- The conversion statement is raw `db.all(sql…)` over Drizzle column refs (all values bound, 8 parameters). Local `EXPLAIN QUERY PLAN` on the seeded DB: `visits_visited_idx` range, prospects PK join, `prospects_status_idx` for the manual branch.
- `rateOf` stays local to `admin.ts` (the tests assert literal ratios, so `period.ts` did not need it). `formatDelta` and `formatPoints` share one private `signedTenths` helper.
- `KpiCard.value` is now a preformatted string; `deltaFormat` defaults to `formatDelta`. `AdminApp.test.tsx`'s stub response also gained the new fields (typecheck).
- Review fix: the manual branch also requires `last_visit_at IS NULL OR last_visit_at <= status_set_at` (the complement of `visitWins` in `status.ts`), since a winning visit sets `status` without touching `status_set_at`; without it an earlier manual change was counted as a phantom manual conversion.
- Precache: 695.74 KiB of 1,000 KiB (`pnpm build && pnpm check:precache`, exit 0).
- Seeded `pnpm dev` (#108 seed): 7 j Convertis 9 (−18,2 %), 13,0 % (−3,9 pt); 30 j 37 (+146,7 %), 35,9 % (+15,7 pt); 90 j 68 (+36,0 %), 42,0 % (−10,7 pt). Grid 4 across at 1280, 2 × 2 at 820, 1 column at 390, checked light and dark.
- Orchestrator verification after review pass 1: 55 files / 1253 tests, typecheck and lint clean, build exits 0. `check:precache` 695.74 KiB of 1,000 against 695.50 KiB on `main` at the baseline (+0.24 KiB, all in the entry chunk: 372.85 → 373.00 KiB, from the copy strings and formatters). Re-checked in seeded `pnpm dev` after the patch: the seed re-run inserts 0 rows, the figures are unchanged, and the cards were checked at 1280 (light, dark), 820 (dark) and 390 (light, dark) with no horizontal scroll.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: 0 high, 1 medium, 7 low, 8 false, 0 maybe-false. 8 patched, 0 deferred, 8 rejected.

- `medium` / **patch**: edge-case-hunter, blind-hunter, verification-gap (other) and intent-alignment 3.2. The manual branch counts a visit's conversion as a manual one. `deriveProspectStatus` (`status.ts:47`) sets `status = converted` from a visit newer than `status_set_at` and leaves `status_set_at` alone. So an admin's `follow_up` at T1 (previous period) followed by a `converted` visit at T2 (current period) counts a phantom conversion at T1, which inflates `converted.previous` and both deltas. Fix: the manual branch also requires the manual status to still be the one in force, `last_visit_at IS NULL OR last_visit_at <= status_set_at` (the complement of `visitWins`); add a test, and correct the api.md limitation.
- `low` / **patch**: verification-gap. No test reaches the manual branch with a non-null `merged_into`, so dropping merged rows or keying that branch on `id` passes. Fix: a test with an absorbed prospect converted by hand plus a converted visit on its survivor, expecting 1.
- `low` / **patch**: blind-hunter and intent-alignment 3.4. The ticket's AC asks for "twice" and "merged" for 7, 30 and 90 days, and they run at 30 only. Fix: `it.each(DASHBOARD_PERIODS)`.
- `low` / **patch**: blind-hunter. The boundary test has no manual conversion at `previousFrom` or `to − 1`, so flipping `>=`/`<` on `status_set_at` passes. Fix: add both.
- `low` / **patch**: verification-gap. The seed test (`dev.test.ts:283`) checks Convertis with its own visits-only helper and never reads `figures.converted` or `figures.conversionRate`. Fix: assert the endpoint's figures per period (value, previous, rate delta not null); keep the helper for the per-agent check.
- `low` / **patch**: verification-gap. Nothing pins the new statement's plan; `indexes.test.ts` guards only the single-table count. Fix: a plan case for the join + `UNION ALL` shape, asserting `visits_visited_idx` and `prospects_status_idx` and no `SCAN visits` / `SCAN prospects`.
- `low` / **patch**: verification-gap. `KpiCard` now takes a formatted string, and every screen fixture is under 1,000, so dropping `formatCount` at a call site passes. Fix: one fixture ≥ 1,000 asserted with its separator.
- `low` / **patch**: blind-hunter. `docs/data-model.md:144` says `prospects(status)` serves only the admin list; it now also serves Convertis' manual branch. Fix: one line.
- **rejected** (`false`; the frozen matrix row "Manual, overridden" accepts it): edge-case-hunter and intent-alignment 3.1. A manual conversion later overridden by hand or by a visit drops out, and a later merge collapses two keys, so a past period can shrink.
- **rejected** (`false`; the frozen Approach and "Manually" row define it): blind-hunter and intent-alignment 3.3. The rate can pass 100 % because a manual-only conversion is outside the denominator. Story 7's progress bar has to clamp it; raised in the summary.
- **rejected** (`false`; Decision 1 says one hop): blind-hunter. A merge chain A→B→C counts A under B.
- **rejected** (`false`; the frozen Approach counts "a visit with outcome `converted` in the period"): blind-hunter. A late-syncing converted visit dated before an admin's manual status counts, though ADR-0025 keeps the status.
- **rejected** (`false`; story 7's caption is its planned consumer, the Code Map says so): blind-hunter. `visitedProspects` is unread by the client.
- **rejected** (`low`; the dashboard does not poll yet, and story 9 owns the CPU and cost measurement of the finished query): blind-hunter. No D1 row-read estimate for the new statement.
- **rejected** (`low`, unlikely, and the fix adds a copy string and an aria path to the shared chip): blind-hunter. "pt" may be read letter by letter by a screen reader; the mockup and design.md use "pt".
- **rejected** (`false`; pre-existing, and #107's triage rejected the same claim: exact `toEqual` checks fail on a wrong type): verification-gap (other). `dashboardResponseSchema` is never parsed.
- descriptive, no action: intent-alignment 1, 2, 3.5 and 3.6.

## Design Notes

**Why the manual branch reads current status.** `status_set_at` stores only the latest manual change, so a manual conversion that a later visit or edit overrode cannot be seen. Reading `status = 'converted'` keeps a manual `follow_up` set in the period from counting. No column is added (G1 decided "no new column").

**Why a manual-only conversion stays out of the denominator.** The rate's denominator is "distinct prospects visited", so a prospect converted by hand with no visit in the period raises the numerator only. The rate can in theory exceed 100 %; `api.md` says so.

## Verification

**Commands:**
- `pnpm test` -- expected: all projects pass
- `pnpm typecheck` -- expected: clean
- `pnpm lint` -- expected: clean
- `pnpm build && pnpm check:precache` -- expected: exit 0; total quoted

**Manual checks:**
- `pnpm dev` with `pnpm db:seed:local`: `/admin` at 1280, 820 and 390 px in light and dark, for 7, 30 and 90 jours.
