---
title: 'Tests reach the guarded-insert re-check'
type: 'chore'
created: '2026-10-09'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'none'
review_source: 'auto'
lenses_ran: []
review_loop_iteration: 0
baseline_commit: 31549725e54d32940a6cf53fae9aa53c513de505
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Replacing the guarded `INSERT … SELECT` of the passphrase login or the code generate route with a plain insert passed every test, because nothing could change a `users` row between the read and the write (deferred from #305 and #306).

**Approach:** A test-only D1 wrapper runs a callback just before the first statement whose SQL matches, and `workerFetch` takes per-request bindings so a test can hand it in. One test per route changes the row at that point and asserts the refusal.

</frozen-after-approval>

## Implementation Notes

Oneshot: test files only, no route change. Baseline is the merge-base with `origin/main`.

- `test/d1-hook.ts` (new): `beforeStatement(d1, match, before)` wraps prepare/bind/run/all/raw/first/batch with plain objects, so there is no Proxy over the workerd binding.
- `test/worker-fetch.ts`: optional third argument `bindings` merged over `env` for one request.
- `src/worker/auth.test.ts`: three cases (deactivated, demoted, new passphrase) between the read and the `sessions` insert.
- `src/worker/users.test.ts`: one case, user deactivated before the `login_codes` insert, expects 409 and no row.
- Checked by hand: swapping either guarded insert for a plain `.values()` insert fails the four new tests; with the guards in place `pnpm test`, `typecheck` and `lint` are green.
- Review lenses were not run: the change touches only tests and no subagent was authorised for this run.
