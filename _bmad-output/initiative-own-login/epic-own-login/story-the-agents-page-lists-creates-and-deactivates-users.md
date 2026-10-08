---
tracker_id: "304"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/304"
tracker_status: backlog
id: 7
type: story
title: "The Agents page lists, creates and deactivates users"
parent: epic-own-login
covers: [CAP-1]
after: [1, 6]
risk: low
refined: true
---

# The Agents page lists, creates and deactivates users

## Description

Builds /admin/agents per design.md "Agents" on the /api/admin/users routes from entry 5. It adds the nav entry (second in Pilotage, Lucide Users) and:
- **The list of active users.** Each row shows name, email, role, the Inscrit or Pas encore inscrit badge, and the Appareils count from sessions. Your own row says "Vous".
- **The add dialog.** A 409 email_taken shows design.md's sentence.
- **The role change.** Demoting yourself opens the round.
- **The deactivation dialog.** It reads the list again when it opens, to state openProspects.
- **The Désactivés list**, with Réactiver.
- **The last active admin's row.** Passer agent and Désactiver are disabled, with design.md's sentence under them; a 409 last_admin shows the same sentence as a toast.
- **The layout below 768px**, and the loading and failure states through ScreenState.

After you deactivate your own row, the page opens /login. Every French string lives in the admin copy module.

Not here: the row menu has no "Générer un code" until entry 8 and no "Nouvelle phrase de passe" until entry 9. The device rows and Révoquer come in entry 10. Entry 11 adds the À traiter row the deactivation dialog points to.

## Acceptance Criteria

Verify: On pnpm dev as an admin:
- Creating an agent shows them as Pas encore inscrit and in the assign menu.
- Adding the same email again shows the email_taken sentence.
- Deactivating them states the open prospect count, moves them to Désactivés and removes them from the menu. Réactiver brings them back as Pas encore inscrit.
- On the last active admin's row, Passer agent and Désactiver are disabled.
- Deactivating your own row, with another admin active, lands on /login.
- The page works at 375px wide.
- The admin chunk fetched while signed out holds no user data.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- design — docs/design.md, section Agents
- api — docs/api.md, /api/admin/users rows
- spec — _bmad-output/specs/spec-own-login/SPEC.md, section CAP-1

## Notes

- Decision (2026-10-08): the code and passphrase items are absent from the row menu until entries 8 and 9 add them; no disabled placeholders.
- Decision (2026-10-08): deactivating your own row opens /login on success, since entry 12's 401 handling is not built yet.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
