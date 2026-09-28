---
title: 'Cap how many answers a visit carries (GH #32)'
type: 'bugfix'
created: '2026-09-28'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: '433e0a299f3c5aa4c42c550f56a80ea6e2339625'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `answersSchema` (`src/shared/schemas.ts:169`) bounds each answer's key and value but not the number of entries, so one schema-valid visit can carry unlimited answers. `docs/security.md` claims "array size caps" as a mitigation for oversized payloads, and every other collection in the contract has one.

**Approach:** Cap the record at the script's own question ceiling (50), shared as one named constant with `scriptCreateSchema`, and correct the comments and docs that say the count is unbounded. The change tightens the wire contract but ships without a `CLIENT_VERSION` bump, because no build has ever been able to put more than 50 keys in `answers` (see Implementation Notes).

</frozen-after-approval>

## Implementation Notes

Oneshot: about 60 lines across one schema, one constant, one test file and four comment/doc sites.

**Why this is not a breaking change in practice.** The 50-question cap on `scriptCreateSchema` has existed since the scaffold commit (`3de3bc0`, as `.max(50)`, then `z.maxLength(50)` in `ffc8f17`). On the client, `draft.answers` starts as `{}`, and only `ScriptQuestions` `onChange` writes to it, keyed by the rendered questions of a single script. Drafts are not persisted to Dexie. Every outbox row was built by that code, so no outbox and no stored visit can hold more than 50 keys. Invariant 9 exists so that a phone's queued visit is never rejected, and that cannot happen here. The production check the issue suggests (`select max(json_array_length(...))` over `visits.answers`) needs `--remote`, which agents must not run. The PR offers it to the owner as an optional pre-merge check.

**What the cap does not buy.** The issue hoped that an entry cap would let `MAX_REQUEST_BYTES` be tightened. It does not. The 19.7 MiB worst case quoted in `constants.ts` and `sync.ts` is already exactly 50 answers × 2000 characters × 200 visits, and a real 50-text-question script can legitimately produce it. The byte cap and the client-side trim both stay as they are. Only their wording changes: the reason is now "50 long answers per visit is still schema-valid", not "the count is unbounded".

## Tasks & Acceptance

- [ ] `src/shared/constants.ts` -- add `SCRIPT_QUESTIONS_MAX = 50` with a one-line why; reword the `MAX_REQUEST_BYTES` comment so it no longer claims the count is unbounded
- [ ] `src/shared/schemas.ts` -- `scriptCreateSchema` uses the constant; `answersSchema` gets a `z.refine` on `Object.keys(r).length <= SCRIPT_QUESTIONS_MAX` (zod/mini, invariant 6)
- [ ] `src/shared/schemas.test.ts` (or the nearest existing schema test) -- 50 answers accepted, 51 refused, and `syncRequestSchema` refuses a visit with 51
- [ ] `src/client/field/sync.ts` -- reword the `serializeWithinCap` comment the same way
- [ ] `docs/api.md`, `docs/security.md` -- one line each: answers are capped at 50 per visit

**Acceptance Criteria:**
- Given a visit whose `answers` has 50 keys, when it is parsed by `visitSchema`, then it succeeds.
- Given a visit whose `answers` has 51 keys, when it is posted to `/api/agent/sync`, then the request gets a validation 400 and nothing is inserted.
- Given the existing byte-budget tests, when they run, then they still pass unchanged.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: all pass

**Files changed:** `src/shared/constants.ts` (`SCRIPT_QUESTIONS_MAX`, reworded the `MAX_REQUEST_BYTES` why), `src/shared/schemas.ts` (the `answersSchema` refine; `scriptCreateSchema` uses the constant), `src/client/field/sync.ts` (comment), `src/worker/sync.test.ts` (51 answers get a 400 and nothing is inserted; 50 are accepted), `docs/api.md`, `docs/security.md`, `docs/domains/scripts.md` (the rule's home). The schema cases are tested at the route instead of in a new `schemas.test.ts`: none exists, and the route test drives the same schema end to end.

## Review Triage Log

Quick lens, 4 findings: 2 medium (patched), 2 rejected.
- medium, patch: `docs/security.md` still said the count was unbounded. Reworded.
- medium, patch: the new constant cited `docs/domains/scripts.md`, which did not state the 50-question rule. Added it under Rules.
- low, rejected: there is no direct `visitSchema` test for 50 and 51 answers. The route test in `sync.test.ts` covers both through `syncRequestSchema`, which contains `visitSchema`.
- false: the `visit-draft.ts:183` mapping ignores the count issue's `["answers"]` path. That state is unreachable, because `draft.answers` is written only by `ScriptQuestions` for the rendered questions of one script, which has at most 50.
