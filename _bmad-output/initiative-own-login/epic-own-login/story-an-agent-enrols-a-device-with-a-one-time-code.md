---
tracker_id: "305"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/305"
tracker_status: backlog
id: 8
type: story
title: "An agent enrols a device with a one-time code"
parent: epic-own-login
covers: [CAP-2, CAP-4, CAP-7, CAP-1]
after: [7]
risk: medium
---

# An agent enrols a device with a one-time code

## Description

Adds login_codes, the shared code and passphrase normaliser (case, spaces, hyphens; I/L → 1, O → 0), the admin route that generates a user's 8-character Crockford code (deleting their unused ones), deletion of unused codes on deactivation in entry 5's route, kind code on POST /api/auth/login (failures counted by entry 4), the code field as /login's default, the lockout message from a 429 with the button disabled until Retry-After, and the Générer un code panel on entry 7's Agents page.

## Acceptance Criteria

Verify: On pnpm dev, a code typed in a second browser with spaces and lowercase signs in the right agent; Worker tests show a used, an expired (15 min), a superseded and a deactivated user's code each get 401; and /login shows the lockout message with the button disabled after a 429.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
