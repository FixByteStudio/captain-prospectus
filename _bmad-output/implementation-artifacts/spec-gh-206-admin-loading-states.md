---
title: 'Admin Prospects and Visites loading and error states match EXPERIENCE.md'
type: 'bugfix'
created: '2026-09-28'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: '5fb3c0e1bc629ad452bd69a7018f71a66a1de72a'
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** EXPERIENCE.md › State Patterns asks every admin screen for a skeleton of 6–8 table rows while loading and an inline Alert with « Réessayer » on a failed load. Prospects shows only 3 skeleton rows (#206); the Visites ledger shows a text line while loading (#207) and a bare red line on failure, with no Alert or retry (#208).

**Approach:** Prospects' skeleton renders 6 row-height skeletons. The Visites ledger goes through the existing `ScreenState` (GH #175): a 6-row skeleton in a `Surface` while nothing is held, the shared destructive Alert with `copy.errors.retry` on failure, and rows already held kept under the Alert. `useVisitsFeed` additionally returns `isFetching` and `refetch` so the retry works. No new component, no new copy keys: the existing `copy.visits.loading` / `copy.visits.loadFailed` are reused. The dashboard's Dernières visites card is out of scope.

</frozen-after-approval>

## Implementation Notes

Oneshot: two screens, about 60 lines, all following a primitive that already exists. The retry button's worth on a 15 s-polling feed was left to the owner in #208; the invocation asks for the shared retry Alert, so it is in.

Files: `ProspectsScreen.tsx` (6 skeleton rows), `visits/VisitsLedger.tsx` (through `ScreenState`), `queries.ts` (`useVisitsFeed` also returns `isFetching`, `refetch`), tests in `ProspectsScreen.test.tsx` and `VisitsScreen.test.tsx`; all three new tests fail on the baseline. The empty copy is suppressed under a failed first load, so the Alert stands alone.

## Review Triage Log

Quick lens, pass 1: 0 high, 0 medium, 1 low, 1 maybe-false, no false findings.
- low, deferred: the empty copy can flash for one render between the skeleton and the first rows, because `isPending` turns false before the effect in `useVisitsFeed` takes in the answer (`queries.ts:411`). The baseline had the same gap. The fix changes the hook's pending semantics, which goes beyond this story. Filed as #223.
- maybe-false, deferred: the offline pattern (panels keep their values, no Alert) is not built. The gap is app-wide and predates this change. Covered by #209.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm test` -- expected: all pass, including new ledger loading / failure tests in `VisitsScreen.test.tsx` and the Prospects skeleton row count
- `pnpm lint` -- expected: clean
