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
refined: true
---

# Logins are throttled per IP and cross-site writes are refused

## Description

Throttling:
- Adds the login_attempts table: the IP as an HMAC under AUTH_PEPPER, a 15-minute window, and a failure count.
- After 10 failed logins from one IP in a window, POST /api/auth/login gets 429 with Retry-After until the window ends.
- The lock is checked before the credential, so a valid credential is refused too.
- Every login refusal counts as a failure, including the 401 when OWNER_EMAIL or BREAK_GLASS is unset. A successful login does not reset the count. Later login kinds (entries 8 and 9) share the same counter.
- The IP comes from CF-Connecting-IP. Requests without it share one "unknown" bucket rather than going unthrottled.

Origin check:
- A middleware refuses with 403 any /api request other than GET or HEAD whose Origin is missing or differs from the request URL's origin.
- It covers /api/auth and /api/dev too. The seed scripts send their own origin.
- Worker tests send a default Origin through a shared helper. Browsers send Origin on every non-GET request, so the app and the field sync need no change.

The /login lockout message and disabled button come in entry 8.

## Acceptance Criteria

Verify: Worker tests show the 11th failed login from one IP within 15 minutes gets 429 with Retry-After even with a valid credential, while another IP still signs in; login_attempts holds no IP in clear; a POST with a valid session and a foreign or missing Origin gets 403 while the same request with the app's Origin passes, including the field sync POST; and no log line carries the IP or the credential. On pnpm dev, pnpm db:seed:local still seeds.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, sections CAP-7, CAP-8
- data — _bmad-output/specs/spec-own-login/auth-data.md

## Notes

- Decision (2026-10-07): login_attempts stores the IP as an HMAC under AUTH_PEPPER, never in clear; an IP is personal data and the hash still counts.
- Decision (2026-10-07): the Origin rule has no exempt route; the seed scripts and the Worker tests send an Origin instead.
- Decision (2026-10-07): a request without CF-Connecting-IP counts in one shared "unknown" bucket; entry 18 checks the header on production behind Access.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
