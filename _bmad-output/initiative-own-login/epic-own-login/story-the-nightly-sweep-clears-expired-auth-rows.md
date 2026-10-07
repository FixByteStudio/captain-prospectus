---
tracker_id: "310"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/310"
tracker_status: backlog
id: 13
type: story
title: "The nightly sweep clears expired auth rows"
parent: epic-own-login
covers: [CAP-10]
after: [8]
risk: low
---

# The nightly sweep clears expired auth rows

## Description

Extends the ADR-0023 retention cron to delete expired login_codes, sessions past entry 2's expires_at, and login_attempts rows older than their window, with counts only in its log line.

## Acceptance Criteria

Verify: retention.test.ts shows expired rows of all three tables deleted and live ones kept, and the log line carries counts and no email or token.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
