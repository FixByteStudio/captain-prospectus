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
refined: true
---

# Local dev signs in as any seeded user, and Worker tests stub a D1 session

## Description

DEV_USER_EMAIL already works on local hosts only, with its role from ADMIN_EMAILS. This story makes it take the role from the users row instead:
- requireIdentity checks, in order: a D1 session, then DEV_USER_EMAIL on localhost, 127.0.0.1 or [::1], then the Access JWT.
- DEV_USER_EMAIL with no users row, or an inactive one, gets 401.
- The dev seed route inserts users rows for admin@example.com (admin) and agent@example.com (agent). Running it twice inserts nothing new.
- Every Worker test file gets those two users rows before its tests run, since all of them sign in through DEV_USER_EMAIL.
- A Worker test helper inserts a sessions row, hashed under the test AUTH_PEPPER, and returns its cookie. Later entries use it.

The roster readers (assign menu, dashboard agent rows, position gate) still read ADMIN_EMAILS and AGENT_EMAILS until entry 6.

## Acceptance Criteria

Verify: Worker tests show DEV_USER_EMAIL signs in with the seeded row's role on localhost, 127.0.0.1 and [::1], gets 401 with no row or an inactive row, has no effect on any other host, and loses to a session when both are present; a test using the session helper is signed in as that helper's user. On a fresh local database, pnpm dev then pnpm db:seed:local, then a reload, opens the app as the seeded admin.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, section CAP-9
- data — _bmad-output/specs/spec-own-login/auth-data.md
- cutover — _bmad-output/specs/spec-own-login/cutover.md, section Code touchpoints today

## Notes

- Decision (2026-10-07): DEV_USER_EMAIL with no users row or an inactive one gets 401, as a deactivated user does.
- Decision (2026-10-07): a session wins over DEV_USER_EMAIL, so /login and logout can be tried locally without editing .dev.vars.
- Decision (2026-10-07): [::1] stays a local host beside localhost and 127.0.0.1; the spec's "only" excludes other hosts, not loopback.
- Decision (2026-10-07): the Access JWT test helper from entry 2 stays until epic-access-removed; no older JWT stubs exist.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
