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
refined: true
---

# Break-glass gives the owner a session on /login

## Description

Tracer bullet. The hitl step: the owner puts AUTH_PEPPER, BREAK_GLASS and OWNER_EMAIL in .dev.vars before the build is verified. The builder adds the three to .dev.vars.example, the Worker bindings and the test bindings.

It delivers:
- An expand migration for users and sessions. A session's expires_at is set at creation: 90 days for an agent, 30 for an admin. Entry 10 makes it slide and adds the device label; entry 13 sweeps it.
- HMAC-SHA-256 helpers under AUTH_PEPPER.
- POST /api/auth/login with kind passphrase, accepting only OWNER_EMAIL + BREAK_GLASS, compared with timingSafeEqual. It creates or reactivates the owner as an active admin and opens a session.
- The __Host- session cookie, and POST /api/auth/logout.
- requireIdentity looks up the session first and falls back to the Access JWT in one isolated function. A request with no session gets 401 when the Access vars are empty, instead of today's 500 "misconfigured".
- A Worker test helper that signs an Access JWT with a local key, so the JWT fallback is tested on a non-localhost host.
- A /login route outside the identity gate, showing the admin form of design.md's login page: e-mail, passphrase, and the 401, network and offline states. The code form and the Accès administrateur button come in entries 8 and 9.

Login throttling is not here; entry 4 adds it, and break-glass failures count toward it then.

## Acceptance Criteria

Verify: On pnpm dev in Chrome or Firefox, with DEV_USER_EMAIL unset and the Access vars empty, the owner types OWNER_EMAIL and BREAK_GLASS at /login, lands on /admin and stays signed in after a reload. Worker tests show a session wins over a JWT, logout deletes the session, a signed JWT still passes alone, a request with neither gets 401, a wrong email or BREAK_GLASS gets the same 401, and no log line carries the secret, a token or a hash.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, sections CAP-4, CAP-5, CAP-6, CAP-13, Constraints
- data — _bmad-output/specs/spec-own-login/auth-data.md
- adr — docs/adr/0029-own-login-instead-of-cloudflare-access.md
- design — docs/design.md, section The login page

## Notes

- Decision (2026-10-07): with no session and empty Access vars, a request gets 401, not 500; phase 3 removes those vars and entry 12 routes a 401 to /login.
- Decision (2026-10-07): this story adds the signed-JWT test helper; no Worker test signs a JWT today (tests sign in through DEV_USER_EMAIL).
- Decision (2026-10-07): /login shows only the admin form until entry 8 adds the default code form.
- Open question: how /login renders without /api/me answering. Two candidates: a /login branch in App before the identity effect, or an outer Routes where only the gated shell fetches /api/me. The builder decides in the plan.
- Open question: the session cookie's name; the builder picks it and records it in docs/data-model.md.
- Safari may refuse __Host- cookies on http://localhost; verify in Chrome or Firefox.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
