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

Removes the passphrase everywhere it is left after 2 — POST /api/admin/me/passphrase, newPassphrase, passphraseResponseSchema, useGeneratePassphrase, PassphraseDialog, Nouvelle phrase de passe in RowMenu, UsersTable, UsersList and the tabbed UsersScreen, the clear-on-deactivate branch, the copy, and one migration dropping users.passphrase_hash; data-model.md, design.md › Utilisateurs, deployment.md and security.md follow.

## Acceptance Criteria

Verify: `grep -ri passphrase src` finds nothing, drizzle/ has exactly one new migration and it drops passphrase_hash, and UsersScreen.test.tsx shows your own row's menu on the Administrateurs tab holding Générer un code and Désactiver only. No line is added to CodeDialog (owner, 2026-10-22).

## References

- parent — _bmad-output/initiative-admin-field-separated/epic-admin-code-login/epic-admin-code-login.md
- skill — .claude/skills/d1-migration/SKILL.md
- code — src/client/admin/users/UsersScreen.tsx

## Notes

- Open question: Whether drizzle-kit emits a plain DROP COLUMN or rebuilds the users table; migration-guard reviews either.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
