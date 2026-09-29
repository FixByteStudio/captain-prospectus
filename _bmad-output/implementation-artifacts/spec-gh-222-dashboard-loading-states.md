---
title: 'Dashboard Dernières visites and live feed loading states match EXPERIENCE.md'
type: 'bugfix'
created: '2026-09-29'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: '215004c8458e424f21f7b4c9bc399c6e143aa2c2'
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The dashboard's Dernières visites card shows « Chargement des visites… » as a text line while loading and a bare red `loadFailed` line on failure, with no skeleton, Alert or « Réessayer » (#222). Separately, `useVisitsFeed` turns `isPending` false one render before its effect takes in the first answer, so the empty copy can flash between the skeleton and the rows (#223).

**Approach:** Route the card's body through `ScreenState`, following the pattern #224 merged for the Visites ledger: row skeletons while nothing is held, the shared destructive Alert with `copy.errors.retry` on failure, and rows already held kept under the Alert. `useVisitsFeed` keeps `isPending` true until its effect has taken in this mount's first answer, tracked in state rather than the `seeded` ref. Admin-only; reuse the admin primitives, and put any new string in `src/client/copy/admin.ts`. One PR closes both issues.

</frozen-after-approval>

## Implementation Notes

Oneshot: two source files and one test file, about 100 lines, all following `ScreenState` and #224. The code was written and PR #226 opened before this workflow ran, from the same invocation; this spec records it after the fact, and the review below runs on that commit.

- `dashboard/RecentVisits.tsx`: the body goes through `ScreenState` inside a padded wrapper (`empty:hidden`, so no gap when it renders nothing). The full-bleed table stays outside it, guarded by `shown.length > 0`, so held rows sit under the Alert. The skeleton has 5 row-height lines, one per row the card shows. EXPERIENCE.md asks for "6–8 table rows", but also for skeletons "shaped like the content", and this card never shows more than 5. It passes `loading={copy.visits.loading}`, as `VisitsLedger` does: the dashboard's status region speaks only for the dashboard's query (see Review Triage Log).
- `queries.ts`: a `taken` state is set in the effect together with the first `setVisits`, and `isPending` is `!taken && !query.isError`. This covers the old `query.isPending || !fresh` case too, because `taken` cannot be true before a fresh answer has been folded in.
- No new copy: `copy.visits.loadFailed`, `copy.visits.empty` and `copy.errors.retry` are reused.
- Tests in `DashboardScreen.test.tsx`: skeleton count, Alert + « Réessayer » refetch, and a `MutationObserver` test that the empty copy is never added between the skeleton and the rows (fails without the `queries.ts` change). "says the feed failed without touching the rest" now expects exactly one Alert, the card's own.
- Removed #223's entry from `deferred-work.md`.

## Review Triage Log

Quick lens, pass 1: 0 high, 1 medium, 0 low, 0 false, 0 maybe-false.
- medium, patched: the card omitted `loading`, so a feed still pending after the dashboard answered or failed announced nothing: `DashboardScreen.tsx:74-76` speaks only for the dashboard query, and the skeleton is `aria-hidden`. The first draft's reason for leaving it out was wrong: `role="status"` is a polite live region, and the two regions cover different queries. Now passes `loading={copy.visits.loading}`, and the skeleton test asserts the sr-only text.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm lint` -- expected: clean
- `pnpm test` -- expected: all pass, including the new Dernières visites tests
- `pnpm build` -- expected: succeeds
