---
tracker_id: "64"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/64"
tracker_status: done
id: 5
type: story
title: "Admin top bar"
parent: epic-shared-shell
covers: [CAP-1]
after: [4]
risk: medium
refined: true
---

# Admin top bar

## Description

Fills the top-bar slot with the breadcrumb, a ⌘K search that opens an empty palette, a disabled notifications bell, a theme toggle that persists, and an avatar menu with the email and Se déconnecter.

## Acceptance Criteria

Verify: The theme choice survives a reload, ⌘K opens and closes the palette with no request made, and Se déconnecter lands on /cdn-cgi/access/logout.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-shared-shell/epic-shared-shell.md

## Notes

- Decision (2026-09-24): `cmdk` is allowed for shadcn Command, as the spec's second dependency exception. It stays in the admin chunk, and the PR states its size and maintenance (CLAUDE.md).
- Decision (2026-09-24): while search has no back end, the open palette says "La recherche n'est pas encore disponible. Utilisez les filtres de la page Prospects." It goes in `copy.ts` (user's choice). It replaces the rejected "Aucun prospect ne porte ce nom.", which would be false for a prospect that exists.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
