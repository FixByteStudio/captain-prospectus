---
title: 'Chunk the sync route''s inArray lookups (GH #30)'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
baseline_commit: 'e2397a46f59cc56511c9f8c7b92b8d753f9ae684'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `POST /api/agent/sync` resolves the prospects a batch references with a single
`inArray(prospects.id, referenced)` — one bound parameter per distinct id, up to
`SYNC_VISITS_PER_REQUEST` (200) of them. That breaches D1's 100-parameter ceiling
(INVARIANT 7) and 500s the whole request. Because a 500 correctly leaves the outbox intact
(INVARIANT 5), the phone rebuilds the identical payload for ever and never drains: an agent
who visits more than 100 distinct prospects before syncing is stuck permanently.

**Approach:** Chunk the route's `inArray` selects with the existing `chunk()` helper, the way
its inserts already are, unioning the results into the same maps. Restore the byte-size test
to its natural shape and add a regression test that syncs visits to 150 distinct prospects.

</frozen-after-approval>

## Implementation Notes

Oneshot: three call sites in one file plus test changes, well under 100 lines, no new
contract and no schema change.

Sites, all in `src/worker/routes/agent.ts`:

- `:121-129` — `inArray(prospects.dedupeKey, keys)`. Sits at exactly 100 today because
  `syncRequestSchema` caps prospects at `SYNC_PROSPECTS_PER_REQUEST`; chunk it so raising
  that cap cannot silently break it.
- `:171-179` — `inArray(prospects.id, referenced)`. The reported break: up to 200.
- `:217-226` — `inArray(scripts.id, referencedScripts)`. Same statement shape, same route,
  same ceiling — distinct script ids come straight off the payload, so a client can send 200.
  Same concern as the reported two, fixed here rather than filed separately.

`chunk(xs, 1)` is the right call: one bound parameter per id, not per row, and no other
clause in these three statements binds. Note the helper's second argument is
*columns per row*, not a batch size — `chunk(xs, D1_MAX_BOUND_PARAMS)` would batch one id
per statement. `admin.ts:519` passes 2 because its `SET` clause binds too; these do not.

Reuse, do not re-invent: `chunk` from `src/shared/chunk.ts`, already imported. The loops
mirror `admin.ts:274-282` and `:614-621` — accumulate into the map declared outside the loop.

Tests in `src/worker/sync.test.ts`: worker tests run on a real D1 in workerd, so the limit is
genuinely enforced and these fail before the fix. Add a bulk `seedProspects(ids)` helper
(chunked insert) rather than 150 sequential `seedProspect` calls, and drop the workaround
comment at `:249-252` that points at this bug as unfixed.

## Verification

**Commands:**
- `pnpm test` -- expected: all projects pass; the new 150-prospect test fails on `main` and passes here
- `pnpm typecheck` -- expected: clean
- `pnpm lint` -- expected: clean

## Review Triage Log

Quick lens, 3 findings — 2 patched, 1 deferred.

- `low` / **patched** — `sync.test.ts`: the new `seedProspects` duplicated `seedProspect`'s
  18-field row literal, so a new NOT NULL column would have to be added in both. Verified: the
  two literals differed only in `Date.now()` vs a hoisted `now`. `seedProspect` now delegates
  to the bulk helper, which handles a one-element array.
- `low` / **patched** — `agent.ts:229-244`: the scripts lookup was chunked but untested, and
  nothing caps distinct `scriptId`s in a payload. Verified by running the suite against the
  unfixed route: only the two prospect-count tests went red. Added "resolves more distinct
  script ids than D1 can bind" — 150 ids, the known one first so a lookup keeping only the
  last chunk fails too. Confirmed it 500s without the fix.
- `medium` / **deferred** (GH #102, `deferred-work.md`) — status derivation runs one statement
  pair per touched prospect, unmeasured against the free-tier budget. Real but pre-existing;
  CLAUDE.md "Stay in scope" puts it in its own issue. The reviewer also suggested softening
  the roadmap's "closing #30": left as written, because #30 is the bound-parameter breach and
  that is closed and covered by a test.
