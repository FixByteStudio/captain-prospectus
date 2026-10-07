---
tracker_id: "301"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/301"
tracker_status: backlog
id: 4
type: story
title: "Logins are throttled per IP and cross-site writes are refused"
parent: epic-own-login
covers: [CAP-7, CAP-8]
after: [3]
risk: medium
---

# Logins are throttled per IP and cross-site writes are refused

## Description

Adds the login_attempts table and the 10-failures-per-15-minutes lock with 429 and Retry-After (break-glass and passphrase failures share it), and a middleware refusing any non-GET /api request whose Origin is missing or foreign with 403.

## Acceptance Criteria

Verify: Worker tests show the 11th failed login from one IP gets 429 with Retry-After even with a valid credential, a POST with a valid session and a foreign or missing Origin gets 403 while the field sync POST still passes, and no log line carries the IP's credential.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Notes

- Open question: Which header carries the client IP in local dev, in tests, and behind Access in production (CF-Connecting-IP expected); entry 18 rechecks it on production.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
