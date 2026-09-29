---
title: 'Vendored Progress forwards value to the Radix root (#147)'
type: 'bugfix'
created: '2026-09-29'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: 'b0b983293f729bf4de4aef06b946dbcc9db5b2ee'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `src/client/ui/progress.tsx` destructures `value` and never passes it to `ProgressPrimitive.Root`, so every bar renders `data-state="indeterminate"` with no `aria-valuenow`; only the indicator's transform uses the value (GH #147).

**Approach:** Forward `value` to the Radix root in the vendored component (ADR-0014), add a DOM test proving `aria-valuenow` / `data-state` follow the value, and check every caller (`DailyProgress`, `ConversionBar`, `MapStep`, `PreviewStep`) still renders correctly — including the two tests whose comments work around the bug.

</frozen-after-approval>

## Tasks & Acceptance

**Acceptance Criteria:**
- Given `<Progress value={40} />`, when rendered, then the root has `aria-valuenow="40"`, `data-state="loading"`, and the indicator's transform is `translateX(-60%)`.
- Given `<Progress value={100} />`, then `data-state="complete"`; given no `value`, then `data-state="indeterminate"` and no `aria-valuenow`.
- Every current caller passes a value in `[0, 100]`, so Radix never falls back to indeterminate for an out-of-range value.

## Implementation Notes

Oneshot: a one-line fix in a vendored component plus one test file and two test-comment updates — well under 100 lines.

Callers checked: `DailyProgress` (`percent` from `dailyProgress` — rounded, but **not** bounded by 100: see the review triage log), `ConversionBar` (`Math.min(rate, 1) * 100`, or 0 when null), `MapStep` / `PreviewStep` (`Math.round(done / total * 100)`, 0 when `total === 0`). `ConversionBar`, `MapStep` and `PreviewStep` stay in `[0, 100]` (the import loop's `done` never exceeds `rows.length`). The two import bars now announce the running percentage; the visible `copy.import.running(done, total)` line next to them still says the counts.

`DailyProgress.test.tsx` and `DashboardScreen.test.tsx` carried comments explaining why they asserted the transform instead of `aria-valuenow` (#147); both now assert `aria-valuenow` as well, since the reason is gone.

## Review Triage Log

Quick lens, pass 1 — high 0 / medium 1 / low 0 / false 1 / deferred 1.

- **medium → patch.** `DailyProgress` can hand Radix `percent > 100`: `n` counts visits and `total` counts stops, so a second visit to one stop gives `n: 2, total: 1, percent: 200` (`progress.test.ts`, "does not grow the denominator…"). Now that `value` reaches the root, Radix logs `console.error` on every render and falls back to indeterminate. Fixed at the caller with `Math.min(progress.percent, 100)` (the same cap as `ConversionBar`), and a test asserts `aria-valuenow="100"`, `data-state="complete"` and no `console.error`. AC3 was wrong for this caller before the patch.
- **false.** `ConversionBar` passes a non-integer (e.g. 33.33…). That is a valid `aria-valuenow`, and Radix's default `aria-valuetext` rounds it to "33%". Nothing breaks.
- **defer → #231.** The `MapStep` and `PreviewStep` bars have no `aria-label`. This predates #147 and is outside this change.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm test` -- expected: all pass, including `src/client/ui/progress.test.tsx`
- `pnpm lint` -- expected: clean
- `pnpm build` -- expected: success
