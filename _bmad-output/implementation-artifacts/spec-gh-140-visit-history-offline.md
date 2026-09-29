---
title: 'Visites précédentes: no « Première visite » offline for a visited prospect'
type: 'bugfix'
created: '2026-09-29'
status: 'done'
baseline_commit: 'fa262bf08b8450d87fa0ee8ed6dff9e2a667a774'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Offline, with no cached `visitHistory` rows for a prospect, `VisitHistory` renders « Première visite à cet endroit. » even when the prospect was visited before, so an agent is told a door was never knocked when it was. `copy.visit.historyOffline` exists but nothing renders it (GH #140).

**Approach:** When the cached history is empty but the cached prospect's `lastVisitAt` is not null, the history was never fetched on this device: render `copy.visit.historyOffline` instead of `noPreviousVisits`, in both slots (under step 1 below 768px, and in `VisitSidePane` from 768px). Field route: native controls rule (ADR-0015) holds; the PR quotes the precache total against its 1,000 KiB ceiling.

</frozen-after-approval>

## Tasks & Acceptance

**Execution:**
- [x] `src/client/field/VisitHistory.tsx` -- take `lastVisitAt: number | null`; the empty state is `noPreviousVisits` when null, `historyOffline` otherwise.
- [x] `src/client/field/VisitSidePane.tsx`, `src/client/field/VisitScreen.tsx` -- pass `prospect?.lastVisitAt ?? null` to both slots.
- [x] `src/client/field/VisitScreen.test.tsx` -- regression tests for the phone slot and the tablet pane.

**Acceptance Criteria:**
- Given a prospect with `lastVisitAt` set and no cached history, when the visit form opens with the history fetch failing, then « Les visites précédentes s'afficheront au retour du réseau. » shows and « Première visite » does not, in both layouts.
- Given a prospect with `lastVisitAt: null` and no cached history, then « Première visite à cet endroit. » still shows.

## Implementation Notes

Oneshot: three components and one test file, ~40 lines. `lastVisitAt` is only set by visits the server accepted, so a non-null value with an empty cache means the history was never pulled here. A field prospect still in the outbox has no cached `Prospect`, so it stays a first visit, which is correct. No new element, no new copy string, no doc change: `field-operations.md` already says offline shows what is cached.

The first draft of the diff was written before the workflow was re-invoked; it was checked against this spec rather than rewritten.

## Spec Change Log

## Review Triage Log

Quick pass: 5 findings. 2 patched (medium, low), 1 rejected (low), 2 deferred (medium).
- medium, patched: the "phone" test ran at happy-dom's 1024px, so the phone slot was untested. It now calls `asPhone()` and asserts there is no pane. It fails on the baseline.
- low, patched: the pane test did not assert that « Première visite » is absent. It now does.
- low, rejected: no phone-layout test for `lastVisitAt: null`. Both slots render the same `VisitHistory`, whose branch is covered by the existing pane tests; one more test adds little.
- medium, deferred: online fetch failure shows the offline copy. Real, but it predates this change (it used to say « Première visite »), and the fix needs the fetch state plus new copy. Recorded in deferred-work.md.
- medium, deferred: the empty state flashes before Dexie answers. Predates this change. Recorded in deferred-work.md.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm lint` -- expected: clean
- `pnpm test` -- expected: all pass; the two #140 tests fail on the baseline
- `pnpm build` -- expected: precache total under 1,000 KiB
