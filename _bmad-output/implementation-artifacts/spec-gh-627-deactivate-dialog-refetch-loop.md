---
title: 'The Utilisateurs deactivate dialog refetches once, not in a loop'
type: 'bugfix'
created: '2026-10-25'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: [quick]
review_loop_iteration: 0
baseline_commit: 'fcb173f55df85c37371a34fa0f803be474c5ccb7'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `DeactivateDialog` lists `onClose` in its refetch effect's dependencies and `UsersScreen` passes a new inline arrow each render, so the effect re-runs and calls `GET /api/admin/users` again for as long as the dialog is open (issue #627: 4,096 GETs in 1.5 s under the test harness).

**Approach:** Keep `onClose` out of the effect's dependencies so the dialog refetches once when it opens, and add a test that counts the GETs after it opens.

</frozen-after-approval>

## Implementation Notes

Oneshot: a single-effect fix in one component plus one test, well under 100 lines. The fix lives in the dialog (latest `onClose` kept in a ref) rather than in `UsersScreen`, so no caller can reintroduce the loop with an inline callback.

Surprise: with the loop gone the test still saw 2 GETs, because the dialog's new `useUsers()` observer refetches on mount (stale) and `refetch()` then cancels it and refetches. `refetch({ cancelRefetch: false })` joins the in-flight fetch, giving the one GET the issue expects.

Files: `src/client/admin/users/DeactivateDialog.tsx`, `src/client/admin/users/UsersScreen.test.tsx`. baseline_commit is the merge-base with `origin/main` (fcb173f) at branch time and at commit time.

## Spec Change Log

## Review Triage Log

- low, rejected: `refetch({ cancelRefetch: false })` also joins a fetch started moments before the dialog opened (e.g. an invalidation), so the count can be that response. The window is milliseconds and `cancelRefetch: false` is what yields exactly one GET (a plain `refetch()` gave 2). Comment reworded to say "a fetch already in flight".
- low, rejected: `queries.ts:190` doc says the count is kept fresh by the dialog's `refetch()`; still true in effect, rewording would be churn outside this change.
- low, rejected: the test waits a fixed 300 ms. It fails on the old code (1,009 GETs) and on a plain `refetch()` (2 GETs); a late extra fetch would be caught on slow runs only, and the repo's other tests wait the same way.
