---
tracker_id: "309"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/309"
tracker_status: backlog
id: 12
type: story
title: "A 401 sends both clients to /login without losing work"
parent: epic-own-login
covers: [CAP-12, CAP-5]
after: [7]
risk: high
refined: true
---

# A 401 sends both clients to /login without losing work

## Description

Sends a user to `/login` when the Worker answers 401, in both apps, without touching the outbox. It also makes Se déconnecter end the device's session. Access still fronts the hostname in phase 1, so its redirect keeps today's path. This story changes:
- **A Worker 401 on the field side.** A 401 from `/api/me` at launch drops the cached round and the `unconfirmed` flags as today, then opens `/login`. A 401 during a sync keeps the session-expired strip. Its button now opens `/login` by a router navigation, through the leave guard, so a visit being typed is never lost. The outbox is never cleared by either path.
- **A Worker 401 on the admin side.** The admin app opens `/login`.
- **An Access redirect stays as today.** In both apps it keeps the `?reconnect=1` navigation and the session-expired screens. The client tells it apart from a Worker 401, because only a network navigation can get past Access.
- **Se déconnecter** calls `POST /api/auth/logout`. If the Worker still identifies the device afterwards (the Access JWT), it continues to the Access logout as today. Otherwise it opens `/login`.
- **`/login` with a live identity.** It asks `/api/me` once. If an identity answers, it goes straight to that role's landing. A 401, an Access redirect, or no network leaves the form in place.

The sync payload and `clientVersion` do not change. The French strings stay in the copy modules. docs/design.md (the avatar menu's logout sentence and the session-expired strip) and the 401 lines of docs/domains/identity-access.md change in the same PR.

Not here: removing the `?reconnect=1` marker, the `/cdn-cgi/` denylist entry and the Access logout link (epic-access-removed, phase 3). Also not here: the `/login` outbox line and the 426 update prompt on `/login` (entry 19).

## Acceptance Criteria

Verify: On pnpm dev with DEV_USER_EMAIL unset:
- An agent queues two visits offline, the admin revokes that device's session, and the phone reconnects. At launch it lands on `/login`, and both visits are still in the outbox.
- With a visit form open, a 401 during sync shows the strip. Its button asks the leave guard before it opens `/login`.
- After signing in with a new code, both visits sync.
- An admin whose session is revoked lands on `/login` on their next request.
- Se déconnecter ends the session and opens `/login`. The session's row is gone.
- A signed-in device that opens `/login` goes to its landing.
- The PR quotes the precache total against 1,000 KiB.

Tests show:
- A Worker 401 and an Access redirect take different paths. The Access redirect still produces the `?reconnect=1` navigation.
- No 401 path deletes an outbox row.
- Logout continues to the Access logout only when `/api/me` still answers after it.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, sections CAP-12 and CAP-5
- cutover — _bmad-output/specs/spec-own-login/cutover.md, sections Phases and Code touchpoints today
- design — docs/design.md, sections The login page, Layout (avatar menu) and the sync strip's Session expired row
- domain — docs/domains/identity-access.md, the session-expiry and 401 rules

## Notes

- Decision (2026-10-09): the Access paths (`?reconnect=1`, the `/cdn-cgi/` denylist, the Access logout link) stay until phase 3. Access fronts the hostname until phase 2, the Worker falls back to its JWT, and `/login` comes from the precache, so without them an agent whose Access cookie expires could not get back in. That line of CAP-12 moves to epic-access-removed.
- Decision (2026-10-09): at launch a 401 jumps to `/login`. During a sync it shows the strip, whose button opens `/login`, so a draft is never dropped by a jump.
- Decision (2026-10-09): the `/login` outbox line and the 426 update prompt are left out of this story and go to entry 19.
- Decision (2026-10-09): logout decides whether to continue to Access by asking `/api/me`, so the wire contract does not change.
- The earlier `Unknown` in the epic's Notes lists App.tsx, SyncIndicator, sync-view, leave-guard, theme.ts, AdminLayout and OfflineBanner. In AdminLayout and OfflineBanner, "reconnect" means the network coming back, which is unrelated. theme.ts names the marker only in a comment.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
