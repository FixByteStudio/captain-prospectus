---
title: 'KPI sparklines (GH #111)'
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
baseline_commit: 'ca7a50390a826e121cb9ebc558f985eb7a5bde59'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The four KPI cards on Tableau de bord stop at the delta chip. The admin sees a period total but not its shape, not what Prospects ouverts is made of, and not how far Taux de conversion has come.

**Approach:** `GET /api/admin/dashboard` gains additively a daily series for Visites and Convertis, aligned with `visitsByDay`, and the Nouveau / Assigné / À relancer split of Prospects ouverts. Each KPI card gains its bottom row as in `key-a1-dashboard.html`: a 32px sparkline on Visites and Convertis (shadcn Chart / Recharts, admin chunk only), a 6px stacked mini-bar with its caption on Prospects ouverts, and a 6px gold progress bar with "{n} convertis sur {m} prospects visités" on Taux de conversion.

**Decisions (2026-09-26, user):**
- Sparkline colour follows the delta chip's tone (`deltaTone`): `success` up, `destructive` down, `muted-foreground` flat or "—".
- Prospects ouverts' icon tile becomes Lucide `Building`, as in the mockup; `docs/design.md` follows.
- Taux de conversion with no visited prospect (rate `null`): empty gold track and the caption "Aucun prospect visité sur la période".
- The spec is kept whole despite running past 1,600 tokens.

## Boundaries & Constraints

**Always:** A daily series has `period` entries, oldest first, on the same Brussels days as `visitsByDay` (reuse `periodOffsets`/`periodDates` and the day expression from #110), and it sums to its KPI's `value`. A prospect counts in Convertis' series once, on the Brussels day of its first conversion event in the period (a visit or a manual change, keyed `coalesce(merged_into, id)`), so the series sums to `converted.value` by construction. The Prospects ouverts split has the same filter as `openProspects` and sums to it. SQL uses bound parameters and one statement per figure, well under 100 parameters (invariant 7). The contract change is additive and in zod/mini. Colours come from tokens only (`status-new`, `status-assigned`, `warn`, `primary`, `secondary`). The sparkline and mini-bar are decorative (`aria-hidden`), since the figure carries the value. The mini-bar's counts get a visually hidden sentence. French strings live only in `copy.ts`. Recharts stays only in `AdminApp-*` and `check:precache` passes. `docs/api.md` and `docs/design.md` are updated in the same change.

**Never:** No tooltip, axis, dot or animation on a sparkline. No clickable card (story 10). No pipeline or agent panel (story 8). No schema change or migration. No new dependency. No change to the field route's bundle.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sums | seed, period 7 / 30 / 90 | Σ `visits.byDay` = `visits.value`; Σ `converted.byDay` = `converted.value`; Σ open split = `openProspects` | — |
| Length | period 7 / 30 / 90 | both series have 7 / 30 / 90 entries | — |
| Converted twice | one prospect: `converted` visits on day 1 and day 4 | 1 on day 1, 0 on day 4 | — |
| Visit then manual | a `converted` visit on day 2 and a manual convert still in force on day 5 (same key) | 1 on day 2 only | — |
| Merged | an absorbed prospect converts on day 0, its survivor on day 3 | 1 on day 0 (one key) | — |
| Previous period | conversion at `from − 1` | in no entry | — |
| DST | a conversion at 23:30 Brussels on the 25 h / 23 h day | counted on that Brussels date | — |
| Empty | no visits | flat sparkline on the baseline; bar track only; no crash | — |
| Rate null / > 1 | nothing visited / manual conversions exceed visited | empty track and "Aucun prospect visité sur la période" / bar capped at 100 % | — |
| Open split zero | no open prospects | the track shows, with no segments | — |

</frozen-after-approval>

## Code Map

- `src/worker/routes/admin.ts:201` -- the dashboard route. `visits.byDay` is summed in TS from `visitsByDay`'s rows, with no new query. Two more statements go in the `Promise.all`:
  - The open split: `select status, count(*) … where merged_into is null and status in OPEN_STATUSES group by status`. `openProspects` becomes its sum, which drops the old count query.
  - Convertis per day: the current-period half of `conversionCounts`' union, `select key, min(at) … group by key`, then the #110 day expression over `min(at)`, `group by day`.
  Filling a dense array is shared with `visitsByDay`: extract a small `dayIndex` SQL fragment and a `denseDays` helper, and keep the #110 behaviour unchanged.
- `src/shared/schemas.ts:504` -- `visits.byDay: z.array(countSchema)`, `converted.byDay: z.array(countSchema)` and `openProspectsByStatus: z.object({ new, assigned, follow_up })`. They are additive: `openProspects` stays a number.
- `src/worker/dashboard.test.ts` -- a new `describe("KPI series")` with one test per matrix row, `it.each(DASHBOARD_PERIODS)` for the sums and lengths. Reuse `seedProspect`, `seedVisits`, `dashboard` and `brusselsPeriod`, and the fake-timers DST setup from #110's tests.
- `src/client/admin/dashboard/KpiCard.tsx` -- a `footer?: ReactNode` slot below the delta row (`mt-2.5`). The skeleton gains a 32px block.
- `src/client/admin/dashboard/KpiSparkline.tsx` (new) -- `ChartContainer` (from `src/client/ui/chart.tsx`) with a `LineChart`. It has `h-8 w-full`, `Line type="linear" dot={false} strokeWidth={2} isAnimationActive={false}` and no axes or tooltip, and the Y domain runs from 0 to the maximum. The colour is a raw `:root` token var, not `--color-*` (see `outcome-series.ts`'s comment).
- `src/client/admin/dashboard/OpenProspectsBar.tsx` (new) -- a flex bar, `h-1.5 gap-0.5 rounded-full overflow-hidden`, with segments `flex-grow: n` in `bg-status-new`, `bg-status-assigned` and `bg-warn`. The caption joins `STATUS_LABELS` with " · " in meta muted, plus an sr-only sentence with the counts.
- `src/client/admin/dashboard/ConversionBar.tsx` (new, or inline in DashboardScreen) -- `ui/progress.tsx` with `className="bg-secondary h-1.5"`, the same idiom as `DailyProgress.tsx`, an `aria-label`, and `value = min(rate, 1) × 100`. The caption comes from `copy.dashboard.conversionCaption(n, m)`.
- `src/client/admin/dashboard/DashboardScreen.tsx:101` -- passes the footers.
- `src/client/copy.ts:124` -- `conversionCaption`, `openSplit` (the sr sentence) and the progress bar's label. Reuse the status labels at `copy.ts:715`.
- `src/client/admin/dashboard/DashboardScreen.test.tsx`, `src/client/admin/AdminApp.test.tsx` -- the stubs gain the new fields. Assert the caption and the sr sentence. The SVG is not asserted, because Recharts draws nothing at 0 width.
- `docs/api.md:107` -- define the two series and the split. `docs/design.md:284` -- add the card's bottom row to the KPI card entry.

## Tasks & Acceptance

**Execution:**
- [x] `src/shared/schemas.ts` -- the additive fields
- [x] `src/worker/routes/admin.ts`, `src/worker/dashboard.test.ts` -- the two statements, the TS sum, and a test per matrix row
- [x] `src/client/admin/dashboard/*`, `src/client/copy.ts` -- the footer slot, the sparkline, the mini-bar, the progress bar and the skeleton
- [x] `DashboardScreen.test.tsx`, `AdminApp.test.tsx` -- the stubs and the assertions
- [x] `docs/api.md`, `docs/design.md` -- the Definition of Done

**Acceptance Criteria:**
- Given the #108 seed in `pnpm dev`, when `/admin` opens at 1280, 820 and 390 px in light and dark, then the four cards match `key-a1-dashboard.html`: a sparkline 32px tall in the chip's tone, the mini-bar and its caption, the gold bar and its caption, and the icon tiles.
- Given `pnpm build && pnpm check:precache`, then it passes, Recharts is only in `AdminApp-*`, and the PR quotes the precache total against 1,000 KiB, with the entry chunk unchanged except for copy.

## Implementation Notes

- Implemented directly by the orchestrator in the `feat/111-kpi-sparklines` worktree; the spec lives in the main checkout's untracked `_bmad-output`.
- Worker: `periodDays(from, to, period)` returns the dates plus a `dayOf(t)` SQL fragment, the #110 day expression factored out. `visitsByDay` and the new `convertedByDay` both use it. `openProspects` is now the sum of the `group by status` split, which replaces the old count. `visits.byDay` is summed in TS from `visitsByDay`.
- Existing tests that compared `visits`/`converted` with `toEqual` now use `toMatchObject`, because of the additive `byDay`.
- Client: `KpiCard` gains a `footer` slot (`mt-2.5 min-h-8`). `KpiSparkline` is a Recharts `LineChart` in `ChartContainer` whose colour comes from `deltaTone` → `--success`/`--destructive`/`--muted-foreground`, with Y from 0 to max(max, 1). `OpenProspectsBar` shows segments only for counts above 0, and the `secondary` track only when all three are 0. `ConversionBar` reuses `ui/progress`, with the value capped at 100.
- The vendored `Progress` never forwards `value` to Radix, so it has no `aria-valuenow`. This is pre-existing and tracked in #147. The tests read the indicator's transform instead, as `DailyProgress.test.tsx` does.
- Sizes, baseline ca7a503 → branch: precache 883.65 → 884.09 KiB of 1,000 (schemas +0.29, CSS +0.15). Entry `index-*.js` unchanged at 378.94 KiB. `AdminApp` 699.18 → 718.70 kB min (205.62 → 210.28 kB gzip, +4.66 kB for `LineChart`).
- Seeded `pnpm dev` on port 5311: the series sum to their figures at 7/30/90 (130/9, 522/37, 1191/68; open 29/41/65 = 135). Screenshots via headless Chromium over CDP at 1280 (7/30/90) light and dark, and at 820 and 390 at 30 in both themes. The line tone follows the chip (Convertis at 7 days is −18,2 % and red), and there is no horizontal scroll at 390.
- Verification (before review): typecheck and lint clean, 61 files / 1432 tests pass, build exit 0, `check:precache` exit 0.

- After review patches: 1434 tests pass, lint and typecheck clean, build exit 0, `check:precache` exit 0 at 884.17 KiB (+0.52 over baseline). `copy.ts` now imports `format.ts`, so Rollup moved both from the entry chunk (378.94 → 377.40 KiB) into the shared `schemas` chunk (134.05 → 135.95 KiB); both are precached.
- Owner change after PR #153 opened (2026-09-26): sparklines scale to the period's own min–max, filling the row as in the mockup, and the bars keep a zero baseline. A flat series sits at mid-height (`sparklineDomain` gives it ±1). This supersedes the Code Map's "Y domain from 0". Unit test: `KpiSparkline.test.tsx`; `docs/design.md` updated. 1439 tests pass, and precache is unchanged at 884.17 KiB.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: 0 high, 0 medium, 7 low, 6 false, 0 maybe-false. 0 intent_gap, 0 bad_spec, 6 patched, 2 deferred, 9 rejected.

- `low` / **patch**: edge-case-hunter, blind-hunter. The captions interpolated raw numbers, so 1 000 open prospects read "1000" under a figure of "1 000". Fix: `copy.ts` formats with `formatCount`, which has no imports so there is no cycle. The test now expects "1 000 nouveaux".
- `low` / **patch**: blind-hunter. `openProspects` summed the split's three keys, so a status added to `OPEN_STATUSES` would drop out of the figure without a trace. Fix: sum every returned row.
- `low` / **patch**: verification-gap, blind-hunter. The flat or "—" sparkline tone was never asserted. Fix: the chip-tone `it.each` checks `--color-value` for up, down, null and a delta that rounds to 0.
- `low` / **patch**: verification-gap, blind-hunter. The singular branches of the captions, and a rate of 0 with a visit, were untested. Fix: a new test covers "1 converti sur 1 prospect visité" and "1 nouveau, 2 assignés, 1 284 à relancer".
- `low` / **patch**: blind-hunter. `docs/design.md` gave only the plural caption. Fix: it now says "(singular for 0 and 1)".
- `low` / **patch**: blind-hunter. `SPARKLINE_TOKEN` was exported with no user, and the test header had an unwrapped line. Fix: made it module-private and rewrapped the line.
- `low` / **defer**: verification-gap. No client test observes which series each sparkline draws, because Recharts draws nothing at happy-dom's 0 width. The server series is pinned, and the seeded screenshots show each card's own shape.
- `low` / **defer** (pre-existing, #147): blind-hunter. The gold `Progress` exposes a progressbar with no `aria-valuenow`. The vendored component never forwards `value`, and the caption carries the figures.
- **rejected** (`low`, unlikely; the fix means a transactional batch): edge-case-hunter. A sync landing between `conversionCounts` and `convertedByDay` could make one poll's series miss its figure by one. The next poll corrects it, and #110's `visits`/`visitsByDay` pair has the same property.
- **rejected** (`low`; drift is caught by the sum test at 7/30/90, and a shared builder adds surface): blind-hunter. `convertedByDay` repeats `conversionCounts`' union and predicate. The CPU budget is story 9's to measure (the epic's plan).
- **rejected** (`false`; the intent asks for a daily series for Visites, and the frozen Approach names it): blind-hunter. `visits.byDay` duplicates `visitsByDay`.
- **rejected** (`false`; `visitsByDay` has the same unconstrained array, and the Worker is the only producer, tested for length at 7/30/90): blind-hunter. The schema does not enforce length or sums.
- **rejected** (`false`; the new `describe` asserts `byDay` exactly per matrix row, as the verification-gap lens confirmed): blind-hunter. The `toMatchObject` loosening weakens tests.
- **rejected** (`false`; the stub is a test fixture the AdminApp test never reads for series): blind-hunter. `byDay: []` in `AdminApp.test.tsx`.
- **rejected** (`low`, cosmetic): blind-hunter. A class selector for the empty track in the test.
- **rejected** (`false`; the user's decision in the frozen block): blind-hunter. The `Building` icon is out of scope.
- **rejected** (`false`; the spec's Code Map sets a Y domain from 0, a deliberate choice so a quiet period reads low): intent-alignment D2. The mockup's polyline is min–max scaled. Surfaced to the user in the summary.
- descriptive, no action: intent-alignment 1, 2 and the rest of 3.

## Design Notes

**Why Convertis' series is keyed on the first event.** Convertis counts a prospect once per period. If the series counted it on every day it converted, its sum would exceed the card's figure, and the story's test forbids that. `min(at)` per key gives each prospect exactly one day.

**Why a plain flex bar for Prospects ouverts.** Three proportional segments with 2px gaps is the mockup's own markup. A Recharts bar would add nothing but weight to the card.

## Verification

**Commands:**
- `pnpm test` -- expected: all projects pass
- `pnpm typecheck` and `pnpm lint` -- expected: clean
- `pnpm build && pnpm check:precache` -- expected: exit 0, with the total and `AdminApp-*` quoted

**Manual checks:**
- `pnpm db:seed:local` then `pnpm dev`: `/admin` at 1280, 820 and 390 px, light and dark, at 7, 30 and 90 jours, against the mockup.
