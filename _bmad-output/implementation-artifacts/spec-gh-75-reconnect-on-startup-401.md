---
title: 'A 401 at startup offers "Se reconnecter" through Access (GH #75)'
type: 'bugfix'
created: '2026-09-28'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: 'd7b13c219d3d8c91dc2a4486e695524336929561'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When `/api/me` answers 401 at startup, `App.tsx`'s `if (error)` frame shows the session-expired message with no action. A reload or relaunch is served from precache (`navigateFallback`), asks `/api/me` again, gets 401 again, and the agent is stuck (GH #75).

**Approach:** When the identity error is a revocation (`resolveIdentity`'s `revoked: true`), the error frame's empty state gets a "Se reconnecter" button. It navigates to `reconnectUrl(window.location.href)`, the same marker navigation the sync strip uses (#65), so the service worker's `navigateFallbackDenylist` lets it reach Access. Like the strip, it does nothing while the browser reports no network. The other identity errors (offline first run, malformed body) keep their action-less empty state.

</frozen-after-approval>

## Implementation Notes

Oneshot: about 60 lines across `App.tsx`, its test, and one paragraph of `identity-access.md`. Reuses `reconnectUrl` and `copy.sync.reconnect`; no new copy, no contract change.

Worked in worktree `../captain-prospectus-75` on `fix/75-reconnect-on-startup-401`: the shared checkout had uncommitted changes from another session.

## Review Triage Log

Quick lens, 3 findings:
- low, patched: `App.tsx:264` — the marker-stripping effect's comment named only SyncStrip as the navigating caller; now names the identity-error frame too.
- low, rejected: no test that a malformed `/api/me` body shows no button. It reaches `App` through the same `revoked: false` branch the offline-first-run test already pins; a new case would test `resolveIdentity`, which `identity.test.ts` covers.
- real, pre-existing, not caused here: `api.ts:27` inlines the French 401 message outside `copy.ts` (invariant 15). Already tracked as GH #101; no new issue.
