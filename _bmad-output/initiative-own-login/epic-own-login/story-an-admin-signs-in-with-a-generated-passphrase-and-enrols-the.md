---
tracker_id: "306"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/306"
tracker_status: backlog
id: 9
type: story
title: "An admin signs in with a generated passphrase and enrols their own devices"
parent: epic-own-login
covers: [CAP-3, CAP-4]
after: [8]
risk: medium
---

# An admin signs in with a generated passphrase and enrols their own devices

## Description

Adds passphrase_hash, the route that generates or regenerates an admin's 20-character passphrase shown once, kind passphrase for any admin on POST /api/auth/login with one error for a wrong email or passphrase, the Accès administrateur switch on /login, and the admin's own code from a signed-in device, reusing entry 8's normaliser and code route.

## Acceptance Criteria

Verify: On pnpm dev, an admin regenerates their passphrase, the old one gets 401, the new one typed with hyphens and an O for 0 signs in from a second browser through the switch, a wrong email and a wrong passphrase get the same error, and a code the admin makes for themselves enrols a third browser.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
