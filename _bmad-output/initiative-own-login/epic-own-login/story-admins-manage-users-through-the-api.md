---
tracker_id: "302"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/302"
tracker_status: backlog
id: 5
type: story
title: "Admins manage users through the API"
parent: epic-own-login
covers: [CAP-1]
after: [4]
risk: medium
refined: true
---

# Admins manage users through the API

## Description

Adds the shared zod/mini contracts and a new identity route module, which entries 8–10 extend, with admin routes to:
- **List users.** Each row has email, name, role, active, the count of live sessions (which gives "Inscrit" and Appareils), and the count of prospects assigned to the user in an open status. The Agents page reads the list again when the deactivation dialog opens.
- **Create a user.** Email, name and role are required, and the server trims and lowercases the email. An email that already has a user gets 409.
- **Change a user's role.** The change applies on the user's next request.
- **Deactivate a user.** It deletes their sessions (entry 8 adds unused codes). Deactivating your own row is allowed when another admin is active, and it ends your session.
- **Reactivate a user.** They return with no session, as "Pas encore inscrit".

Demoting or deactivating the last active admin gets its own error code, so the page can show its sentence. No user is ever deleted.

The Access JWT fallback refuses an email whose users row exists but is inactive. An email with no row keeps its role from the roster vars until epic-access-removed.

docs/api.md and docs/data-model.md change in the same PR (epic decision). The Agents page itself is entry 7.

## Acceptance Criteria

Verify: Worker tests show a created user is listed at once, and a duplicate email gets 409. A deactivated user gets 401 on the next request with a session and with a valid Access JWT alike, and their sessions are gone. A reactivated user is listed active with no session. The last active admin cannot be demoted or deactivated, and gets the distinct error. The prospect count includes open statuses only. Only an admin reaches the routes, and a POST without the app's Origin gets 403.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, section CAP-1
- data — _bmad-output/specs/spec-own-login/auth-data.md
- design — docs/design.md, section Agents

## Notes

- Decision (2026-10-07): the Access JWT fallback refuses an email whose users row is inactive; without it, a deactivated agent still holding an Access cookie keeps working in phase 1 and the epic's Done when 2 fails.
- Decision (2026-10-07): "prospects still assigned" counts open statuses only (new, assigned, follow_up); entry 11's "Prospects sans agent actif" row uses the same rule.
- Decision (2026-10-07): reactivation is in this story, since the Agents page's Désactivés list needs it.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
