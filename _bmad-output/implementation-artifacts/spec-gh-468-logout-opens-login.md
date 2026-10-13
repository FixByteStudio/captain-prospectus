---
title: 'Se déconnecter ends the session and opens /login'
type: 'chore'
created: '2026-10-13'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: '736278c1b8c66e516e2da34ca9ebc241117316ce'
context:
  - '{project-root}/docs/domains/identity-access.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** "Se déconnecter" still probes `/api/me` and can navigate to Access's `/cdn-cgi/access/logout`, and `vite.config.ts` still exempts `/cdn-cgi/` from the SPA fallback, though Access is being removed (GH #468, CAP-12, CAP-14; ADR-0034).

**Approach:** `AccountMenu` posts `/api/auth/logout` and opens `/login`; a post that never reached the server still stays put with the generic toast. Delete `access-logout.ts` and its test, drop the `/cdn-cgi/` denylist entry and its `config.test.ts` assertion, and update the logout paragraphs of `docs/design.md` and `docs/domains/identity-access.md`.

Verify: `TopBar.test.tsx` shows Se déconnecter posts `/api/auth/logout` and opens `/login` without asking `/api/me`, a post that never reached the server still stays put, and a grep of `src/client`, `vite.config.ts` and `config.test.ts` finds no `access-logout` or `cdn-cgi`.

</frozen-after-approval>

## Implementation Notes

Oneshot: about 60 changed lines across 7 files, one concern. Out of scope (other stories of epic-access-removed): the `?reconnect=1` marker and `reconnect-marker.ts`, the `apiFetch` opaque-redirect branch, `/login`'s `/api/me` probe, the JWT fallback in `src/worker/auth.ts` (its `/cdn-cgi/access/certs` URL is the Worker side, not this story's grep surface).

## Spec Change Log

## Review Triage Log

- low (rejected): the deleted "Access redirect on the POST" test left `access_redirect` through `AccountMenu` uncovered. The branch lives in `apiFetch` and is another story's removal; a test for it here would have to be deleted again.
- low (rejected): ADR-0029 and ADR-0034 still list the Access logout link and `/cdn-cgi/` entry as planned removals. They are decision records of the plan, not status; this story carries it out.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: all pass
- `grep -rn "access-logout\|cdn-cgi" src/client vite.config.ts config.test.ts` -- expected: no output
