---
tracker_id: "302"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/302"
tracker_status: backlog
id: 5
type: story
title: "Admins manage users through the API"
parent: epic-own-login
covers: [CAP-1]
after: [4]
risk: medium
---

# Admins manage users through the API

## Description

Adds the shared zod/mini contracts and, in a new identity route module that entries 8–10 extend, the admin routes to list, create, change the role of and deactivate users: deactivation deletes their sessions (entry 8 adds codes), the last active admin is protected, and the response gives the count of prospects left assigned.

## Acceptance Criteria

Verify: Worker tests show a created user is listed at once, a deactivated one gets 401 on the next request with their sessions gone, and the last active admin cannot be demoted or deactivated.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
