---
title: 'Trim the validation 400 to a capped list of {path, code}'
type: 'bugfix'
created: '2026-09-28'
status: 'done'
baseline_commit: 'dfb94c5304fd103618583a3d0fd3e96c585dfb25'
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

**Problem:** `validationFailed` (`src/worker/validate.ts`) returns zod's raw `issues` array. Probing zod 4 confirms it does not embed `input` by default, as issue #36 feared. The array is still unbounded, though: every bad `answers` entry yields an `invalid_union` issue that nests four sub-error arrays, and format issues carry the full regex `pattern`. So a malformed body near `MAX_REQUEST_BYTES` produces a 400 that grows with the request and is serialised inside the 10 ms CPU budget. No client reads `issues` (`errorSchema.issues` is `z.unknown()`, and no UI touches it).

**Approach:** Map each issue to `{path, code}` only, and cap the list at the first 20. A 400 still has the documented shape `{error: "validation", issues}`, and its size no longer depends on the size of the request. Then update `docs/api.md`, which owns the shape.

</frozen-after-approval>

## Tasks & Acceptance

**Execution:**
- [x] `src/worker/validate.ts` -- In `validationFailed`, map issues to `{path, code}` (path elements that are symbols become strings) and slice to `MAX_VALIDATION_ISSUES = 20`. Keep the function's signature so `routes/agent.ts:79` needs no change -- this is the single place a 400 is built.
- [x] `src/worker/validate.test.ts` (new) -- Unit-test the 400: each issue has only `path` and `code`, and a body with many bad `answers` entries is capped at 20 issues.
- [x] `docs/api.md` -- Line 3: say that `issues` is `[{path, code}]`, the first 20.

**Acceptance Criteria:**
- Given a sync body with 100 malformed `answers` entries, when it is posted, then the 400 has `error: "validation"` and exactly 20 issues, each with only the keys `path` and `code`.
- Given the existing worker tests that assert `error: "validation"`, when `pnpm test` runs, then they still pass.

## Implementation Notes

This takes the oneshot route: about 40 lines across three files, all changing one function and the doc line that describes it. Out of scope: the outbox re-sending a malformed payload for ever. That is INVARIANT 5 (never lose a visit) working as designed, and trimming the response does not change it. It also leaves the sync contract unbroken, because no client reads `issues`, so `clientVersion` is not bumped.

Files: `src/worker/validate.ts` (exports `MAX_VALIDATION_ISSUES`, maps to `{path, code}`, slices first), `src/worker/validate.test.ts` (new), `src/worker/sync.test.ts` (the real sync route, after review), `docs/api.md:3`. Surprise: zod 4 drops `input` from issues unless `reportInput` is set, and `@hono/zod-validator` calls a plain `safeParseAsync`. So the leak described in #36 never happened. What was really growing was the issue count and the nested union errors.

## Review Triage Log

- medium, patched: AC 1 was covered only through a stand-in Hono route, while the real sync route calls `validationFailed` from its own validator (`routes/agent.ts:79`). Added a sync-route case to `sync.test.ts` that posts 100 bad `answers`.
- false: "spec still in-progress, boxes unchecked". The finalize step sets them, so this was a process gap, not a defect.
- low, rejected: the cap trims serialisation, not zod's own validation work. A fix would need zod to abort early, which is not a simple correction, and the 400 is now bounded, which is what the Intent asks for.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: all pass
