---
title: 'Docs pass: found-in-passing drift #660 #659 #658 #557 #646'
type: 'chore'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: [quick]
review_loop_iteration: 0
context: []
baseline_commit: 986916bd5d256c97909d9e6c44fee794cc2b6ddc
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Five docs or comments still describe what ADR-0034, ADR-0037 and the shipped code have since replaced (#660, #659, #658, #557, #646).

**Approach:** One docs-only PR rewords each to match the shipped code. No behaviour change, no code edit beyond a comment if one is still wrong.

</frozen-after-approval>

## Implementation Notes

Oneshot: five independent wording fixes, each a line or two.
Investigation found #646 already fixed: `src/client/field/sync.ts:43` and `docs/domains/identity-access.md:84` both name the cross-origin check and `requireAgent`. Nothing to edit; the PR description says so.

## Verification

**Commands:**
- `pnpm lint` -- expected: passes

## Review Triage Log

- low, deferred to #671: `mockups/key-f1-tournee.html:45` still names the admin's fourth tab (outside #658's listed lines).
- low, rejected: `.memlog.md:37` and `review-rubric.md:41` are historical logs, not specs.
- low, rejected: DESIGN.md `updated:` date left alone, since the frontmatter is not part of the fix.
- false: `pnpm lint` was run by the author and passes.
