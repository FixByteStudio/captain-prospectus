---
tracker_id: "592"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/592"
tracker_status: done
id: 4
type: story
title: "Remove the admin field side and its links"
parent: epic-admins-leave-the-field
covers: [R5, R6]
after: [3]
risk: medium
---

# Remove the admin field side and its links

## Description

Removes adminAccess, the adminOnline prop chain, the avatar card's Tableau de bord, the / redirect to the field, the role checks left in src/client and backlog 010's pinned tests, so an admin on /, /login or the installed PWA lands on /admin, or on story 3's Hors ligne screen when offline; delivers the client part of R5.

## Acceptance Criteria

Verify: A grep for adminAccess, adminOnline and role !== "admin" in src/worker/routes/agent.ts and src/client finds nothing, tests cover the admin landing from /, /login and offline, and the PR quotes the precache total against 1,000 KiB.

## References

- parent — _bmad-output/initiative-admin-field-separated/epic-admins-leave-the-field/epic-admins-leave-the-field.md

## Notes

- Open question: What an agent identity read from the cache that records role admin should see once the field fallback is gone (the ADR says Hors ligne; invariant 10 says a cached role proves nothing).

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
