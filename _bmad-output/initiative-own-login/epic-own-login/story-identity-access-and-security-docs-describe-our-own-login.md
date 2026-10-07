---
tracker_id: "311"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/311"
tracker_status: backlog
id: 14
type: story
title: "identity-access and security docs describe our own login"
parent: epic-own-login
covers: [CAP-14]
after: [10, 11, 12]
risk: low
---

# identity-access and security docs describe our own login

## Description

Rewrites docs/domains/identity-access.md (login, roles, 401 handling, unconfirmed-identity rules kept) and docs/security.md (Access-bypass, header-spoofing and stolen-phone rows; new CSRF, brute-force, secret-handling and log-hygiene rows), one PR each.

## Acceptance Criteria

Verify: A reviewer finds no sentence in either doc describing Access as the login outside the phase-1 fallback, and each new security.md row names the code that enforces it.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
