---
title: 'Doc drift: 503 quota code, Indexes table, already-listed subsection'
type: 'chore'
created: '2026-09-29'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: '215004c8458e424f21f7b4c9bc399c6e143aa2c2'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Three docs drifted: `docs/api.md` names the D1 daily-limit 503 code `d1_limit` while the Worker sends `quota` (GH #131); a paragraph in `docs/data-model.md` splits the Indexes table so the rows after it render as text (GH #16); and `docs/design.md`'s « A place that looks already listed » subsection sits under The repair queue instead of The map import (GH #198).

**Approach:** Docs only, no code change. Make `api.md` say `quota` (the wire value stays, INVARIANT 9); move the data-model paragraph below the last table row; move the design.md subsection, unchanged, to the end of § The map import.

</frozen-after-approval>

## Implementation Notes

Oneshot: three mechanical doc edits, under 50 moved or changed lines, no code.

## Verification

**Commands:**
- `pnpm lint` -- expected: passes (format check covers the docs)

**Manual checks (if no CLI):**
- `grep -rn d1_limit docs/api.md` is empty; the Indexes table is contiguous; `#### A place that looks already listed` sits between § The map import and § The live feed.

## Review Triage Log

Quick lens, pass 1: 0 findings. The reviewer confirmed `quota` matches `src/worker/index.ts:85` and `src/worker/errors.test.ts:73`, the Indexes table is contiguous, and the design.md subsection moved verbatim with no inbound anchor broken. The one remaining `d1_limit` mention, `docs/backlog/008-d1-limit-detection-and-logs.md:72`, is a done task's record of the state at the time and stays.
