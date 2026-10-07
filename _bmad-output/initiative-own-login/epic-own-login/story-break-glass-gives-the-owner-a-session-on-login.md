---
tracker_id: "299"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/299"
tracker_status: backlog
id: 2
type: story
title: "Break-glass gives the owner a session on /login"
parent: epic-own-login
covers: [CAP-6, CAP-4, CAP-5, CAP-13]
after: [1]
hitl: true
risk: high
---

# Break-glass gives the owner a session on /login

## Description

Tracer bullet, after the owner (hitl) moves ADR-0029 to accepted and puts AUTH_PEPPER, BREAK_GLASS and OWNER_EMAIL in .dev.vars: expand migration for users and sessions (expires_at set at creation, 90 days for an agent and 30 for an admin, which entry 10 slides and entry 13 sweeps), HMAC-SHA-256 helpers under AUTH_PEPPER, POST /api/auth/login with kind passphrase limited to OWNER_EMAIL + BREAK_GLASS (timingSafeEqual, creates or reactivates the owner as an active admin), the __Host- session cookie, POST /api/auth/logout, requireIdentity looking up the session first and falling back to the Access JWT in one isolated function, and a /login route outside the identity gate with the passphrase form laid out per entry 1.

## Acceptance Criteria

Verify: On pnpm dev with DEV_USER_EMAIL unset and the Access vars empty, the owner types OWNER_EMAIL and BREAK_GLASS at /login, lands on /admin and stays signed in after a reload; Worker tests show a session wins over a JWT, the JWT path still passes, and no log line carries the secret, a token or a hash.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Notes

- Open question: How the field shell's identity gate in App.tsx lets /login render without /api/me answering; the builder decides it in the plan.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
