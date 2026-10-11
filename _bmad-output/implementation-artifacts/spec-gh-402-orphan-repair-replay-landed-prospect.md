---
title: 'A replayed orphan repair reports where the visit landed'
type: 'bugfix'
created: '2026-10-11'
status: 'done'
baseline_commit: '22e48d523603738ab70155a11c44808813ef4f23'
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

**Problem:** When `POST /api/admin/visits/orphaned/:id/repair` finds the visit already repaired (#402), it answers `{repaired: false, prospectId}` with the `prospectId` the request sent, while `docs/api.md` promises the returned `prospectId` is where the visit actually landed. A replay aimed at a different prospect, or at one merged away since, reports the wrong id.

**Approach:** In the replay branch of the repair route (`src/worker/routes/admin.ts`), select the visit's `prospect_id` alongside its id and return that instead of the request's `prospectId`. Extend the existing replay test in `src/worker/orphans.test.ts` to replay against a different prospect and assert the original landing id comes back.

</frozen-after-approval>

## Implementation Notes

Oneshot: a two-line route change plus one test assertion; no contract, schema or doc change, since `docs/api.md` already states the intended behaviour.

Files: `src/worker/routes/admin.ts` (replay branch selects `visits.prospectId`), `src/worker/orphans.test.ts` (replay aimed at another prospect). The new test fails against the baseline route and passes with the fix. Typecheck, the full suite (2663 tests), lint and build pass.

## Review Triage Log

Quick lens, iteration 0: 1 low (patched), 1 low (rejected).

- **low, rejected**: no test replays against a prospect merged away since the first repair. The fix reads `visits.prospect_id` whatever the request aims at, so that case runs the same path as the tested different-prospect case. A second test would add nothing.
- **low, patched**: the comment said "where the first repair put it", but the replay branch also catches a visit that reached `visits` through sync and was never quarantined. Reworded to "where the visit actually is".
