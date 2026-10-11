---
title: 'OWNER_EMAIL is described one way: a Worker secret'
type: 'bugfix'
created: '2026-10-11'
status: 'done'
baseline_commit: '09fb54d27cab59db75320642569d2fd3428ebec9'
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

**Problem:** `docs/deployment.md` step 6 sets `OWNER_EMAIL` with `wrangler secret put` and calls it a secret, while `docs/security.md` (threat table and Secrets section) calls it a variable kept out of `wrangler.jsonc` (#418). An owner who follows security.md and types it as a dashboard variable loses it on the next CI deploy, and break-glass answers 401.

**Approach:** Keep deployment.md's description, the one that works: `wrangler.jsonc` has `vars` and no `keep_vars`, so every `wrangler deploy` replaces dashboard variables, and only a secret survives. Make security.md say `OWNER_EMAIL` is a Worker secret (not sensitive, kept out of the repo) and leave how-to-set to deployment.md. ADR-0029 is history and stays as it is.

</frozen-after-approval>

## Tasks & Acceptance

**Execution:**
- [x] `docs/security.md` -- line 22 (Secret handling row) and line 60 (Secrets section): `OWNER_EMAIL` is a Worker secret like the other two -- one description across the docs

**Acceptance Criteria:**
- Given the docs on main, when an owner greps `OWNER_EMAIL`, then no doc outside ADR-0029 calls it a variable, and deployment.md stays the only place that says how to set it.

## Implementation Notes

Oneshot: two sentences in one doc. deployment.md is already right and not touched. `src/worker/types.ts` no longer describes the kind (trimmed in #48, it points at deployment.md). `config.test.ts:42` says "OWNER_EMAIL is not secret", meaning not sensitive, which still holds, so it stays. The threat-table row cited `src/worker/types.ts` as its source; since #48 that comment only points at deployment.md, so the row now links deployment.md directly.

## Verification

**Commands:**
- `grep -rn "OWNER_EMAIL" docs | grep -i variable` -- expected: only `docs/deployment.md:29` ("a variable typed into the dashboard does not" survive), no doc calling it a variable

## Review Triage Log

Quick review, pass 1: 3 medium/low patched, 3 rejected.

- medium, patch -- security.md Secrets bullet cited ADR-0029, which says "var", for the secret wording. Now cites deployment.md and notes the ADR still says var.
- medium, patch (same root cause) -- the bullet called OWNER_EMAIL "not sensitive" beside line 58's "non-sensitive vars" with no reason. Now says it is a secret so a CI deploy keeps it.
- low, patch -- threat-table row said "set by the owner or CI" and now links deployment.md, whose step 6 has only the owner running `wrangler secret put` (deploy.yml passes no such secret). Now "set by the owner".
- low, rejected -- `config.test.ts:39-40` still points at `src/worker/types.ts`; that comment forwards to deployment.md, so the chain lands in the right place.
- false -- `_bmad-output/specs/spec-own-login/auth-data.md:26` lists it as var: a planning artifact, history like ADR-0029.
- low, rejected -- threat-table row lacks "not sensitive": both passages agree it is a secret, which is what #418 is about.

