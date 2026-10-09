---
title: "identity-access and security docs describe our own login"
type: 'chore'
created: '2026-10-09'
status: 'in-progress'
route: 'oneshot'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_commit: '59caaae1634bc693a0478bb77991fe6c07b24b5a'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `docs/domains/identity-access.md` and `docs/security.md` still describe Cloudflare Access as the login in a few places (stolen phone, "re-derives identity from the verified JWT", "who holds the Access cookie") and omit what entries 2–13 shipped without owning a doc line (admin-only permissions, the nightly auth sweep, leaked database, secret handling, log hygiene) (GH #311, CAP-14).

**Approach:** Docs only, two PRs, one per doc. PR 1 fixes identity-access.md; PR 2 fixes security.md. Every rule written matches the code on `main` and each security.md row names the code or test that enforces it, or says it does not and links an issue. Not here: api.md, data-model.md, deployment.md, free-tier-budget.md, the Access removal.

</frozen-after-approval>

## Implementation Notes

- Oneshot: about 60 lines of prose across two files, no code. Two PRs per the story's Notes, both cut from `origin/main`.
- Source of truth for the rules: `src/worker/session.ts` (lifetimes, HMAC), `src/worker/auth.ts`, `src/worker/auth-sweep.ts`, tests in `src/worker/auth.test.ts` and `users.test.ts`.

## Spec Change Log

## Review Triage Log
