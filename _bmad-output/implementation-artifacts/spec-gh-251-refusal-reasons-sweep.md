---
title: 'Refactor sweep (GH #251)'
type: 'refactor'
created: '2026-10-05'
status: 'done'
baseline_commit: 'bf25d5083c169018d0ed03da947ce68b8963d343' # merge-base of refactor/251-refusal-reasons-sweep and origin/main (epic #59 retro F2)
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick', 'duplication-map']
review_loop_iteration: 0
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic #246 (A refusal carries its reason) is merged through stories 1 to 4, and its build records left a few small debts. `visitsReasonQuerySchema` in `src/shared/schemas.ts` is `z.enum(REFUSAL_REASONS)`, the same schema as `refusalReasonSchema` two hundred lines above it, with its own type `VisitsReasonFilter`. Two comments carry a mangled wrap from the edits that touched them (`schemas.ts`, `VisitsLedger.tsx`). `ProspectsScreen.setOutOfTarget` hand-rolls the `delete next.x` that `dropFilter` already does. `docs/domains/prospecting.md` still says the prospects export has no download button, which story 4's review deferred as #256 and which Prospects has had since its rebuild.

**Approach:** Fix each one without changing a route, a stored value, a wire shape or an assertion in any test. Drop `visitsReasonQuerySchema` and `VisitsReasonFilter` for `refusalReasonSchema` and `RefusalReason` at their five uses. Reflow the two comments. Let `setOutOfTarget` call `dropFilter` for the off case. Rewrite the export paragraph in `prospecting.md` to describe the button. Mark the `deferred-work.md` entry for #256 `closed_by`. The PR lists every deferred or rejected finding of stories 1 to 4 as taken, already closed or not taken, with its reason. Not taken: any behaviour change, any migration, the `OUT_OF_TARGET_FLAGGED` SQL shape, the step-2 three-way choice in `StepIndicator`/`VisitScreen` (rejected as one rule in #248's review), and `ui/textarea.tsx` (#213, not this epic). The precache before this change is 932.53 KiB (25 entries). The PR quotes the total after.

</frozen-after-approval>

## Implementation Notes

Oneshot: about 40 mechanical lines. Every item comes from the four stories' Review Triage Logs, the `deferred-work.md` tail, or a read of the epic's production diff (`0f40d0f..bf25d50`). No design choice is left open.

- `shared/schemas.ts`: `visitsReasonQuerySchema` and `VisitsReasonFilter` are gone; the feed and export queries use `refusalReasonSchema`, and the feed's doc comment says what `reason` means. `VisitsScreen`, `queries.ts` and `routes/admin.ts` use `RefusalReason`. Old specs (#249) still name the removed schema; they are build records and stay as written.
- `ProspectsScreen.setOutOfTarget`: the off case calls `dropFilter`. `VisitsLedger` and `prospecting.md` comments and Export paragraph reflowed or corrected; #256's entry in `deferred-work.md` has `closed_by`.
- Verification: `pnpm lint`, `typecheck`, `test` (83 files, 2,089 tests, none edited), `build` and `check:precache` green. Precache 25 entries, 932.53 KiB before and after.
- Epic Done-when evidence: DW1 `src/client/field/VisitScreen.test.tsx` (offline Pas intéressé with a reason) and `src/worker/sync.test.ts`; DW2 `src/worker/sync.test.ts` (no `refusalReason` stores null); DW3 `src/worker/admin.test.ts` and `src/worker/export.test.ts` (same reason filter, `refusal_reason` column); DW4 `src/worker/admin.test.ts` and `src/client/admin/ProspectsScreen.test.tsx` (flag, PATCH clears it, assign, merge and import do not); DW5 the commands above.
- Review ran inline in this session, not in subagents (the session does not spawn agents unasked): the diff is 24 lines added and 33 removed, and both lenses were applied by reading the touched files in full.

## Review Triage Log

Pass 1 (lenses: quick, duplication-map, inline). Counts: high 0 · medium 0 · low 3 (0 patched, 0 deferred, 3 rejected) · false 0.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | dup | `STATUS_EDGE`-style nested ternaries choosing step 2's kind in `StepIndicator` and at its `VisitScreen` call site | low | reject: #248 review row 13 judged it one rule with one mapping; a lookup table adds API for three values |
| 2 | dup | `OUT_OF_TARGET_FLAGGED` is `exists(select … where id = (select …))`, which a single join could express | low | reject: SQL shape change in a sweep that promises none; #250 review row 7 rejected it with its index reasoning |
| 3 | dup | Code comments cite `refusal-reasons.md` and `when-step.md`, which live under `_bmad-output/specs/`, not `docs/` | low | reject: the `when-step.md` citations predate this epic and follow one convention; moving the rules into `docs/` is a doc decision, not a sweep |

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- expected: green; no assertion line changed in any test file
- `pnpm build && pnpm check:precache` -- expected: ≤ 1,000 KiB, unchanged at 932.53 KiB
