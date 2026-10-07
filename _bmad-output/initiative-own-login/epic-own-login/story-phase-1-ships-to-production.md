---
tracker_id: "315"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/315"
tracker_status: backlog
id: 18
type: story
title: "Phase 1 ships to production"
parent: epic-own-login
covers: [CAP-13, CAP-6, CAP-2]
after: [17]
hitl: true
risk: high
---

# Phase 1 ships to production

## Description

The owner sets AUTH_PEPPER, BREAK_GLASS and OWNER_EMAIL, CI deploys, and the owner signs in through break-glass and creates every user, with Access still in front.

## Acceptance Criteria

Verify: On production, the owner's break-glass sign-in works, an agent enrols the installed iOS PWA with a code, the 11th bad login gets 429, a cross-origin POST gets 403, and the Agents page lists every user.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
