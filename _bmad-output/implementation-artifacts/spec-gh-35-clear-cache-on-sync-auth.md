---
title: 'A sync refused by auth clears the cached round (GH #35)'
type: 'bugfix'
created: '2026-09-28'
status: 'done'
baseline_commit: 'c5ec4651614fcfea4f6dfc854712c39c0f5b3506'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/docs/domains/identity-access.md'
  - '{project-root}/docs/security.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `clearAgentCache` runs only from the mount-time `/api/me` effect in `App.tsx`, so a PWA resumed from the app switcher after the agent's access was revoked keeps the whole cached round (names, addresses, phones, every agent's notes) readable, even though its syncs come back `auth`.

**Approach:** When `runSync` gets an auth refusal (401, 403 or an Access login redirect — every response it already maps to `status: "auth"`), it calls `clearAgentCache` before returning. The outbox is untouched (INVARIANT 5); `clearAgentCache` already leaves it alone. A network failure (`offline`) clears nothing.

**Decision (made at build time, flagged in the PR):** clear on every `auth` result, not on 401 only. The client cannot tell a revoked session from an expired one — both reach the phone as the same refusal — and `docs/security.md` lists session expiry itself as a stolen-phone mitigation, which it only is if expiry drops the cache. The cost is an online agent with an expired session sees an empty round until "Se reconnecter", which they are online to do.

</frozen-after-approval>

## Code Map

- `src/client/field/sync.ts` -- `runSync` auth branch (`opaqueredirect || 401 || 403`); header comment states INVARIANT 5.
- `src/client/field/db.ts` -- `clearAgentCache`: clears `prospects`, `visitHistory`, `sentVisits`, `meta.identity`; never the outbox. Reuse as is.
- `src/client/field/sync.test.ts` -- "failures must never clear the outbox" block; add the cache-clearing cases beside it.
- `docs/domains/identity-access.md` § Offline and session expiry, `docs/security.md` "Stolen phone" row -- update to say a refused sync clears the cache too.

## Implementation Notes

Oneshot: one branch in `runSync`, tests and two doc lines — well under 100 lines. Put the clear in `runSync` rather than `useSync.tsx` (the issue's suggestion) so it is covered by the existing DOM-free `sync.test.ts` harness and runs on every caller.

Review follow-up: `VisitScreen` keeps the last prospect name/type it showed (per route `id`), so a clear under an open form does not turn a half-typed visit into "not found" (INVARIANT 5). Files: `sync.ts`, `sync.test.ts`, `VisitScreen.tsx`, `VisitScreen.test.tsx`, `docs/domains/identity-access.md`, `docs/security.md`.

## Review Triage Log

Pass 1 (quick): high 1, medium 0, low 3, false 0, maybe-false 0 (+1 deferred).
- high / patch — an open visit form turned into "not found" when the heartbeat's refused sync cleared `prospects`; the draft is in memory only, so the visit was lost. Fixed in `VisitScreen.tsx` + regression test (fails without the fix).
- low / patch — `SyncStatus` `auth` doc comment still said "keep everything". Updated.
- low / patch — `identity-access.md` session-expiry line omitted 403 and the cache drop. Updated.
- low / patch — new sync tests did not prove `clearAgentCache` itself was reached. `sentVisits` added to the seed and asserted.
- low / defer — `meta.identity` not restored when `auth` is followed by `ok` without a remount; the fix is not a one-liner and the path is rare. Logged in deferred-work.md.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm test` -- expected: all pass, incl. new auth-clears-cache cases
- `pnpm lint` -- expected: clean
- `pnpm build` -- expected: success
