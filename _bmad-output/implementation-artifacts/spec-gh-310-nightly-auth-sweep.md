---
title: "The nightly sweep clears expired auth rows"
type: 'feature'
created: '2026-10-09'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: '0f4334f4160db2ec65c5de6649fe3f1da63f5335'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `login_codes`, `sessions` and `login_attempts` rows nothing can use any more stay for ever (GH #310, CAP-10, ADR-0029 decision 11).

**Approach:** The daily retention run deletes, each table bounded to one batch and in its own try/catch: codes with `expires_at <= now`, sessions with `expires_at <= now`, attempts whose window has ended (`window_start + 15 min <= now`). The log line adds the three counts and nothing identifying. `docs/data-model.md` and `docs/free-tier-budget.md` change in the same PR.

Not here: how sessions slide or codes are spent; any index.

</frozen-after-approval>

## Implementation Notes

- New `src/worker/auth-sweep.ts` (`sweepAuthRows`), called from `runRetention` like `sweepAgentPositions`; `SweepResult` gains the three counts; `describeSweep` prints them.
- `AUTH_SWEEP_BATCH = 500` in `src/shared/constants.ts`, beside `MAP_CACHE_EVICT_BATCH`.
- Live means `expires_at > now` everywhere (`auth.ts`, `routes/auth.ts`), so expired is its exact complement, `<=`.
- Tests in `src/worker/retention.test.ts` cover the five ACs.

## Review Triage Log

- Scan-cost wording contradicted the flood note (docs, auth-sweep.ts header): low, patched.
- Auth counts not logged if the redaction step later throws: low, rejected. Same as the existing position count; the sweep is idempotent and the error is logged.
- Stale handler comment in index.ts, deployment.md, security.md: low, deferred to a found-in-passing view; outside the two docs the story names.
- Throttle test straddling a 15-minute boundary: low, rejected (odds are negligible).
