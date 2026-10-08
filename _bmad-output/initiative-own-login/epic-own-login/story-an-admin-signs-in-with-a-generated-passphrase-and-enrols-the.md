---
tracker_id: "306"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/306"
tracker_status: backlog
id: 9
type: story
title: "An admin signs in with a generated passphrase and enrols their own devices"
parent: epic-own-login
covers: [CAP-3, CAP-4]
after: [8]
risk: high
refined: true
---

# An admin signs in with a generated passphrase and enrols their own devices

## Description

Lets a signed-in admin generate their own passphrase, and lets any active admin sign in on /login with their email and that passphrase. It adds:
- **The route that generates the caller's passphrase.** It takes no email and acts only on the signed-in admin. It makes 20 Crockford base32 characters from crypto randomness, stores their HMAC under AUTH_PEPPER in the existing passphrase_hash column, and answers the passphrase once. Regenerating replaces the hash, so the old passphrase fails at once. The admin's sessions stay open. No route accepts a passphrase the admin chose.
- **kind passphrase for any active admin on POST /api/auth/login.** Break-glass is checked first and is unchanged. Otherwise the server normalises the passphrase with entry 8's normaliser and compares its HMAC to the user's passphrase_hash with timingSafeEqual. The user must be active and an admin, and the session takes its role from users. An unknown email, a user with no passphrase, a deactivated user, an agent and a wrong passphrase all get the same 401 after the same HMAC work. Entry 4's throttle counts every failure.
- **Clearing passphrase_hash** when entry 5's PATCH demotes an admin to agent or deactivates them, in the same statement as the change. A re-promoted or reactivated admin enrols with a code, then makes a new passphrase.
- **Nouvelle phrase de passe** in the Agents row menu, on the signed-in admin's own row only, after Générer un code. It opens the confirming AlertDialog, then the passphrase Dialog with Copier and Terminé, per design.md.

No migration: passphrase_hash already exists. docs/api.md, docs/data-model.md and the passphrase line in docs/domains/identity-access.md change in the same PR. The French strings go in the admin copy module; /login already has its own from entry 8.

Not here: the login form, the Accès administrateur swap and the admin's own code (entry 8), and the device list and revoking (entry 10).

## Acceptance Criteria

Verify: On pnpm dev:
- An admin opens the menu on their own row, confirms Remplacer, and sees the passphrase in five groups of four. Copier puts it on the clipboard.
- In a second browser, the passphrase typed in lowercase with hyphens and an O for a 0 signs in through Accès administrateur and opens /admin.
- After a second regeneration, the first passphrase gets the refused Alert, and the new one signs in.
- A wrong email and a wrong passphrase show the same Alert.
- Another user's row has no Nouvelle phrase de passe item.
- Break-glass still signs in.
- The PR quotes the precache total against 1,000 KiB.

Worker tests show:
- The route answers 20 Crockford characters and stores only their hash.
- A regenerated passphrase replaces the old one, and the old one gets 401.
- An unknown email, a user with no passphrase, a deactivated admin and an agent each get the same 401 body as a wrong passphrase.
- Demoting or deactivating an admin clears passphrase_hash.
- A passphrase login opens a session with the admin role and lifetime, and the throttle counts its failures.
- No log line and no column holds a passphrase in clear.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, sections CAP-3, CAP-4
- data — _bmad-output/specs/spec-own-login/auth-data.md, sections Tables and Login request
- design — docs/design.md, sections Agents (row menu, passphrase Dialog) and The login page (admin form, refused sign-in)
- api — docs/api.md, /api/auth/login and /api/admin/users rows

## Notes

- Decision (2026-10-08): the passphrase route acts on the caller only, with no email, so a passphrase is shown to its owner alone (design.md). Another admin enrols with a code, then makes their own.
- Decision (2026-10-08): demoting or deactivating an admin clears passphrase_hash, and login also requires an active admin.
- Decision (2026-10-08): regenerating does not sign out the admin's other devices; entry 10 revokes devices.
- Decision (2026-10-08): no migration, since passphrase_hash already exists. The description no longer says "adds passphrase_hash".
- Decision (2026-10-08): risk is high, since this changes the login path. The security-reviewer agent reviews the PR before merge.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
