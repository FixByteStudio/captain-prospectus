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
---

# The Agents page lists, creates and deactivates users

## Description

Builds the admin Agents page per entry 1 on entry 5's routes: the list with role and Inscrit / Pas encore inscrit, the create form, the role change, and the deactivation dialog stating how many prospects stay assigned, with its nav entry.

## Acceptance Criteria

Verify: On pnpm dev as an admin, creating an agent shows them as Pas encore inscrit and in the assign menu, deactivating them shows the prospect count and removes them from the menu, and the admin chunk fetched signed out holds no user data.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
