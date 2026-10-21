---
tracker_id: "611"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/611"
tracker_status: backlog
id: 3
type: story
title: "Utilisateurs offers codes only"
parent: epic-admin-code-login
covers: [R9, R11]
after: [2, 2.6]
risk: low
---

# Utilisateurs offers codes only

## Description

Removes the passphrase everywhere it is left after 2 — POST /api/admin/me/passphrase, newPassphrase, passphraseResponseSchema, useGeneratePassphrase, PassphraseDialog, Nouvelle phrase de passe in RowMenu, UsersTable, UsersList and the tabbed UsersScreen, the clear-on-deactivate branch, the copy, and one migration dropping users.passphrase_hash — and adds to CodeDialog, on an admin's row only, a line telling them to sign in through Accès administrateur with their email, which needs the user's role in UsersScreen's issued state; data-model.md, design.md › Utilisateurs, deployment.md and security.md follow.

## Acceptance Criteria

Verify: `grep -ri passphrase src` finds nothing, drizzle/ has exactly one new migration and it drops passphrase_hash, and UsersScreen.test.tsx shows the Accès administrateur line in the code dialog from the Administrateurs tab and not from the Agents tab.

## References

- parent — _bmad-output/initiative-admin-field-separated/epic-admin-code-login/epic-admin-code-login.md
- skill — .claude/skills/d1-migration/SKILL.md
- code — src/client/admin/users/UsersScreen.tsx
- code — src/client/admin/users/CodeDialog.tsx

## Notes

- Open question: Whether drizzle-kit emits a plain DROP COLUMN or rebuilds the users table; migration-guard reviews either.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
