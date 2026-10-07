---
tracker_id: "307"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/307"
tracker_status: backlog
id: 10
type: story
title: "Each device's session can be seen and revoked"
parent: epic-own-login
covers: [CAP-5, CAP-1]
after: [9]
risk: medium
---

# Each device's session can be seen and revoked

## Description

Adds the parsed User-Agent device label (never the raw string), sliding expiry on entry 2's expires_at with last_seen_at written at most once an hour, and the admin routes and Agents page panel listing each user's sessions with label, enrolment date and last seen and revoking one.

## Acceptance Criteria

Verify: Worker tests show one revoked session gets 401 while the user's other session works, last_seen_at and expires_at are not rewritten within the hour, and no sessions column holds the raw User-Agent; on pnpm dev the Agents page lists two browsers by label and revokes one.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
