---
tracker_id: "307"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/307"
tracker_status: backlog
id: 10
type: story
title: "Each device's session can be seen and revoked"
parent: epic-own-login
covers: [CAP-5, CAP-1]
after: [9]
risk: high
refined: true
---

# Each device's session can be seen and revoked

## Description

Lets an admin see every device a user is signed in on and sign out any one of them, and makes a session that is used stay alive. It adds:
- **Two sessions columns, as an expand-only migration.** `id` is a random public id, set at login and backfilled for existing rows, with a unique index. `device_label` is nullable. The token hash never leaves the Worker.
- **The device label**, parsed from the User-Agent at login for all three login paths (code, passphrase, break-glass). It holds the device family and the browser, such as "iPhone · Safari", and is null when neither is recognised. The raw User-Agent is never stored or logged. The parser is pure code with no new dependency.
- **Sliding expiry.** When a session is used and its last_seen_at is an hour old or more, one conditional UPDATE sets last_seen_at to now and expires_at to now plus the current role's lifetime (30 days for an admin, 90 for an agent). The same response re-sends the session cookie with the same token and a fresh Max-Age, so the cookie never expires before its row. Within the hour, nothing is written and no cookie is sent.
- **A `devices` array on each GET /api/admin/users row**, as an additive field. Each item has id, label, createdAt, lastSeenAt and current, for unexpired sessions only. current is true for the session making the request.
- **DELETE /api/admin/sessions/:id**, which deletes one session and answers 204. An unknown id gets 404. That device gets 401 on its next request, and the user's other sessions keep working.
- **The device lines on the Agents page**, per design.md: the chevron that expands a row, one line per device with its label, "Inscrit le" and "Vu le", Révoquer with no confirmation and the toast "Appareil déconnecté.", "Cet appareil" in place of Révoquer on the current device, "Appareil inconnu" for a null label, "Aucun appareil inscrit." for none, and the layout below 768px.

docs/api.md, docs/data-model.md and the session lines in docs/domains/identity-access.md change in the same PR. The French strings go in the admin copy module.

Not here: the free-tier figures for the added writes (entry 16), the nightly sweep of expired sessions (entry 13), and what a phone does with the 401 (entry 12).

## Acceptance Criteria

Verify: On pnpm dev:
- An admin signed in on two browsers expands their own row and sees two devices by label. The one the page is open on reads "Cet appareil".
- Révoquer on the other device shows the toast, the line goes, and that browser's next request gets 401.
- A user with no session reads "Aucun appareil inscrit."
- Below 768px, a device line wraps its dates under the label, with Révoquer on the right.
- The PR quotes the precache total against 1,000 KiB.

Worker tests show:
- A revoked session gets 401, and the user's other session still works. An unknown id gets 404.
- A request within the hour writes nothing and sends no cookie. A request after the hour moves last_seen_at and expires_at and re-sends the cookie with a fresh Max-Age.
- The new lifetime follows the user's current role.
- Each login path stores the parsed label, and an unknown User-Agent stores null.
- No sessions column and no log line holds the raw User-Agent, and no response holds a token hash.
- `devices` lists unexpired sessions only and marks the caller's as current.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, section CAP-5
- data — _bmad-output/specs/spec-own-login/auth-data.md, sections Tables and Session cookie
- design — docs/design.md, section Agents (row expansion, device lines, below 768px)
- api — docs/api.md, /api/admin/users rows

## Notes

- Decision (2026-10-09): sessions get a random public `id`, backfilled by the migration, so revoking never sends a token hash over the wire.
- Decision (2026-10-09): the hourly slide re-sends the cookie with a fresh Max-Age. Otherwise the cookie set at login would expire 30 or 90 days later however often the device is used.
- Decision (2026-10-09): devices come in GET /api/admin/users as an additive `devices` array, with no per-row request. The roster is small.
- Decision (2026-10-09): one story, server and UI together, as in entries 8 and 9.
- Decision (2026-10-09): the server lets an admin revoke their own current session; only the UI hides it, as design.md says.
- Decision (2026-10-09): risk is high, since this changes the identity middleware and adds a migration. The migration-guard and security-reviewer agents review the PR before merge.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
