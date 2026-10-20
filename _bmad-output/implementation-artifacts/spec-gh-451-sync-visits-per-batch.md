---
title: 'Server accepts at most SYNC_VISITS_PER_BATCH (50) visits per sync (GH #451)'
type: 'bugfix'
created: '2026-10-18'
status: 'done'
baseline_commit: '310dd56fdffbd7a10883d1aa41c970c8f3046516'
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

**Problem:** The server still accepts `SYNC_VISITS_PER_REQUEST` (200) visits per sync, kept only for builds older than #404. docs/free-tier-budget.md « Sync through the session » (PR #563) measured a 200-visit sync at up to 11.1 ms warm and 22–27 ms cold, over the 10 ms Workers Free CPU budget (INVARIANT 13).

**Approach:** The data stage is disposable (CLAUDE.md), so no compatibility window: the server's visit cap becomes `SYNC_VISITS_PER_BATCH` (50), `SYNC_VISITS_PER_REQUEST` is deleted so the limit has one home, and `CLIENT_VERSION` and `MIN_CLIENT_VERSION` both rise 2 → 3 in this change so a pre-change build gets 426 and updates with its outbox intact (INVARIANT 5). Follow the sync-contract-change skill; update docs/api.md, field-operations and the budget doc's 200-visit wording. A test proves a 51-visit request is refused and a 50-visit one accepted. Closes #451.

</frozen-after-approval>

## Implementation Notes

Oneshot: ~80 lines, mostly mechanical renames, tests and doc wording.

Plan:
- `src/shared/constants.ts` — delete `SYNC_VISITS_PER_REQUEST`; rewrite the comment on `SYNC_VISITS_PER_BATCH` (one limit, phone sends it, server accepts it, GH #404/#451); `CLIENT_VERSION = MIN_CLIENT_VERSION = 3`.
- `src/shared/schemas.ts` — sync `visits` `maxLength(SYNC_VISITS_PER_BATCH)`.
- `src/shared/constants.test.ts` — payload-fits test at `SYNC_VISITS_PER_BATCH`; delete the "sync visit limits" describe (one constant now).
- `src/worker/sync.test.ts` — accept test at 50, refuse test at 51 (400, nothing stored); add a 426 test for the previous version (`CLIENT_VERSION - 1`); "derives a full batch" at 50. The 150-distinct-prospects test (#30) can no longer be built from visits (51+ is a 400): drop it; the `chunk()` stays in the route.
- `src/worker/routes/agent.ts:170`, `src/worker/routes/status.ts:39` — comments name `SYNC_VISITS_PER_BATCH`.
- `src/client/field/sync.test.ts:364` — comment no longer contrasts two limits.
- `scripts/measure-sync-cpu.mjs` — the 200-seeded baseline stays (keeps runs comparable with the budget tables); rename the mirror constant to a literal `SEEDED = 200` with why; default `SIZES` drops 100 and 200 (the server now refuses them).
- The sibling #30 test for >100 distinct script ids is dropped for the same reason (51+ visits is a 400); its `chunk()` stays too.
- `docs/security.md` body-cap figures recomputed at 50 visits (614 KiB legitimate max incl. tournées/stops; ~4.9 MiB schema-valid worst case).
- Build precache: 938.43 KiB of the 1,000 KiB ceiling.
- Docs: `docs/api.md` payload caps, `docs/domains/field-operations.md` Bounded payload, `docs/free-tier-budget.md` 200-visit wording.

## Review Triage Log

Quick lens (sonnet), 8 findings:
- medium, patched — field-operations protocol example still sent `clientVersion: 2`; now 3.
- medium, patched — `docs/security.md` body-cap figures were for 200 visits (and predated tournées); recomputed at 50.
- medium, patched (same root as above) — api.md's ~5 MiB vs security.md's 19.7 MiB.
- low, patched — agent.ts chunk comment told history rather than why; reworded.
- low, rejected — dropped #30 tests leave `chunk()` uncovered; unreachable at a 50 cap, recorded above.
- low, rejected — stale deferred-work entry for #451; workflow forbids editing old entries, #451 closes on merge.
- false — script can't reproduce the 200-visit rows: by design, the server now refuses 200; budget doc says so.
- low, rejected — no 426 test for the old version at exactly 50 visits; the version check precedes validation and `clientVersion: 0` already covers below-minimum.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: clean
- `pnpm test` -- expected: all pass, incl. 50 accepted / 51 refused / previous version 426
- `pnpm lint` -- expected: clean
- `pnpm build` -- expected: succeeds
