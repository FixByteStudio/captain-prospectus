---
title: 'Refactor sweep (access-removed epic)'
type: 'refactor'
created: '2026-10-13'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: []
review_loop_iteration: 0
baseline_commit: '0f4b4aa14416c554b08ac43e185c82d8d53915c7'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After the Access removal (GH #467-#472), comments and fixtures in the field client and two Worker tests still name Cloudflare Access, and one Worker test still sends `Cf-Access-Jwt-Assertion`, which the epic's done-when grep forbids (GH #473).

**Approach:** Cleanup only, no behaviour change. Reword each stale comment to the session it now means, and drop the forbidden header from the one test. Verify: lint, typecheck, test and build green, precache at or under 1,000 KiB.

</frozen-after-approval>

## Implementation Notes

- Oneshot: 12 changed lines in 9 files, comments and one test fixture. Baseline is the merge-base with `origin/main`, which equals HEAD.
- "The Access cookie may not match" is now "the session cookie" in `useSync.tsx` (two), `last-reading.ts`, `outbox-stamp.ts`, `sync.test.ts` and `VisitScreen.test.tsx`. `db.ts` `clearAgentCache` now says the session was revoked or the user deactivated, as `docs/security.md` "Stolen phone" does. `src/client/App.tsx` had no Access comment left (#467 and #470 reworded them).
- `src/worker/sync.test.ts`: "any agent past Access" is now "any signed-in agent".
- `src/client/field/identity.test.ts`: the 500 fixture message is the Worker's real one ("Sign-in is not configured on this Worker.").
- `src/worker/auth.test.ts`: the "Access JWT and no session" case sent `Cf-Access-Jwt-Assertion`, which the epic's done-when grep (`src`, `test`, ...) rejects. #467 kept it as a guard. It now sends `Cf-Access-Authenticated-User-Email` and a `CF_Authorization` cookie, which the Worker also ignores. Name and wording follow "Access token".
- Left alone: `docs/backlog/013-sync-identity-from-cache.md` (done backlog file, outside done-when 3); `last_reading` and other "Se reconnecter" strings (that is the sync strip's label, still true).
- Review: no subagent lens ran, because spawning subagents was not authorised. Own read of the diff: comments and one fixture only.
- Verification: `pnpm lint`, `typecheck`, `test`, `build` green; precache 25 entries, 983.59 KiB of 1,000. The done-when grep over `src test scripts package.json wrangler.jsonc vite.config.ts vitest.config.ts .dev.vars.example .github` prints nothing.

## Spec Change Log

## Review Triage Log

No lens ran. The one behavioural-looking change is the `auth.test.ts` case: it still asserts a 401 for an Access email header and for a `CF_Authorization` cookie, so the "Worker ignores Access" guard stays; only the JWT header is gone.
