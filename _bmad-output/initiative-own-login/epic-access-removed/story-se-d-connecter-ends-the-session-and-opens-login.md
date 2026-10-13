---
tracker_id: "468"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/468"
tracker_status: backlog
id: 2
type: story
title: "Se déconnecter ends the session and opens /login"
parent: epic-access-removed
covers: [CAP-12, CAP-14]
risk: low
---

# Se déconnecter ends the session and opens /login

## Description

Deletes access-logout.ts and its test, AccountMenu's /api/me probe and its navigation to Access, and the /cdn-cgi/ entry of navigateFallbackDenylist with its config.test.ts assertion, so Se déconnecter posts the logout and opens /login, and updates the logout paragraphs of design.md and identity-access.md.

## Acceptance Criteria

Verify: TopBar.test.tsx shows Se déconnecter posts /api/auth/logout and opens /login without asking /api/me, a post that never reached the server still stays put, and a grep of src/client, vite.config.ts and config.test.ts finds no access-logout or cdn-cgi.

## References

- parent — _bmad-output/initiative-own-login/epic-access-removed/epic-access-removed.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
