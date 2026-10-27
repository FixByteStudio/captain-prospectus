---
title: 'Recoverable state when a field lazy screen fails to load (#654)'
type: 'bugfix'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'none'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
baseline_commit: '3af9dffd4de1ef7be3bab6579e542fc318642f43'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Carte, Carnet, Visit and Add prospect are `lazy` under a bare `Suspense` in `src/client/App.tsx`. A rejected `import()` (a stale hash after a deploy; `lazy` caches the rejection) throws past the page.

**Approach:** Generalise the retry pattern of `AdminChunkBoundary` (#562) into a shared chunk boundary taking a recovery render, and wrap each field screen in it. The field recovery is an inline state in the content area, under the field band and tabs, in field wording, native `<button>`, strings in `copy/field`. The owner may reword it.

</frozen-after-approval>

## Implementation Notes

Oneshot: under ~100 lines, one concern. Wording is mine (issue leaves it to the owner); flagged in the PR.

Review skipped (small, self-checked: typecheck, lint, 3145 tests, build green).
