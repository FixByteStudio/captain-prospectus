---
tracker_id: "305"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/305"
tracker_status: backlog
id: 8
type: story
title: "An agent enrols a device with a one-time code"
parent: epic-own-login
covers: [CAP-2, CAP-4, CAP-7, CAP-1, CAP-3]
after: [7]
risk: high
refined: true
---

# An agent enrols a device with a one-time code

## Description

Lets an admin hand any active user a one-time code, and lets that user type it on /login to get a session. It adds:
- **login_codes**, as an expand-only migration: the code's HMAC under AUTH_PEPPER, the user, expires_at 15 minutes after creation, and a used marker. A code is never stored or logged in clear.
- **The shared normaliser** for codes and passphrases. It ignores case, spaces and hyphens, and reads I and L as 1 and O as 0. Entry 9 applies it to passphrases.
- **The admin route that generates a code** for an active user, own row included. It deletes the user's unused codes first and answers the code and its expiresAt. A deactivated user gets 409 user_inactive, and an unknown email gets 404.
- **Deleting unused codes on deactivation**, in the same batch as the sessions in entry 5's PATCH.
- **kind code on POST /api/auth/login.** It opens a session with the role from users and is counted by entry 4's throttle. A code that is wrong, expired, used, superseded or belongs to a deactivated user gets 401. Two requests with the same code sign in once.
- **/login with the code form by default**, and the ghost buttons Accès administrateur and Retour au code that swap it with the existing admin form. The client keeps the code as typed.
- **The lockout Alert from a 429**, with the button disabled until Retry-After passes, per design.md.
- **Générer un code** in the Agents row menu, first item on every active row, and the code Dialog per design.md. The expiry shows in Brussels time from the server's expiresAt.

docs/api.md and docs/data-model.md change in the same PR. The French strings go in copy/field (login) and the admin copy module (dialog).

Not here: the passphrase for other admins, and applying the normaliser to it (entry 9). The outbox line on /login and the 426 update prompt are not here either.

## Acceptance Criteria

Verify: On pnpm dev:
- An admin generates a code for a new agent. The agent types it in a second browser in lowercase with a space and lands on the round. The Agents row turns Inscrit.
- An admin generates a code on their own row, and it opens /admin in a third browser.
- Accès administrateur and Retour au code swap the forms, and break-glass still signs in.
- After 10 failures, /login shows the lockout Alert with the button disabled. It re-enables on its own at the stated time.
- The PR quotes the precache total against 1,000 KiB.

Worker tests show:
- A used, an expired, a superseded and a deactivated user's code each get 401.
- Two concurrent logins with one code give one session.
- A code for a deactivated user gets 409 user_inactive.
- Deactivating a user deletes their unused code.
- No log line and no column holds a code in clear.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, sections CAP-2, CAP-3, CAP-4, CAP-7
- data — _bmad-output/specs/spec-own-login/auth-data.md, sections Tables and Login request
- design — docs/design.md, sections The login page and Agents (row menu, code Dialog)
- api — docs/api.md, /api/auth/login and /api/admin/users rows

## Notes

- Decision (2026-10-08): the Accès administrateur / Retour au code swap moves here from entry 9, so break-glass stays reachable once the code form becomes the default.
- Decision (2026-10-08): Générer un code works on every active row, the admin's own included. That delivers CAP-3's own-device code here, and entry 9 no longer carries it.
- Decision (2026-10-08): the generate route answers 409 user_inactive for a deactivated user, and 404 for an unknown email as PATCH does.
- Decision (2026-10-08): risk is high (auth and a migration). The security-reviewer agent reviews the PR before merge.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
