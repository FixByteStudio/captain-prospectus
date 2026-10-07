---
tracker_id: "300"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/300"
tracker_status: backlog
id: 3
type: story
title: "Local dev signs in as any seeded user, and Worker tests stub a D1 session"
parent: epic-own-login
covers: [CAP-9]
after: [2]
risk: low
---

# Local dev signs in as any seeded user, and Worker tests stub a D1 session

## Description

Makes DEV_USER_EMAIL take its role from a seeded users row on localhost and 127.0.0.1 only, adds users rows to the local seed, and adds the Worker test helper that stubs a D1 session which later entries use; existing JWT stubs stay until epic-access-removed.

## Acceptance Criteria

Verify: Worker tests show DEV_USER_EMAIL signs in as the seeded role on localhost and 127.0.0.1 and has no effect on any other host, and pnpm db:seed:local followed by pnpm dev opens the app as the seeded admin.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
