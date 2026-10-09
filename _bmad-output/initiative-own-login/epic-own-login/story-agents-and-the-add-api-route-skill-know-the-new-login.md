---
tracker_id: "312"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/312"
tracker_status: backlog
id: 15
type: story
title: "Agents and the add-api-route skill know the new login"
parent: epic-own-login
covers: [CAP-14]
after: [4]
risk: low
refined: true
---

# Agents and the add-api-route skill know the new login

## Description

Brings the api-engineer and security-reviewer agents and the add-api-route skill in line with our own login, so the next route an agent writes or reviews follows it. It changes instructions only, no code:
- **security-reviewer** reviews against docs/security.md and ADR-0029, not ADR-0006. Its identity check reads: identity comes from the D1 session, or the verified Access JWT as the phase-1 fallback, and never from `Cf-Access-Authenticated-User-Email` or a client claim. `DEV_USER_EMAIL` is honoured on localhost only and needs an active `users` row. It gains checks for:
  - no route exempted from the Origin check on non-GET `/api` requests;
  - nothing mounted before the identity gate except `/api/auth/*` and `/api/dev/*`;
  - codes, passphrases, session tokens and IPs stored only as HMACs under `AUTH_PEPPER`;
  - no log line carrying an email, code, passphrase, token, hash, IP or User-Agent;
  - every sign-in refusal giving the same 401, and any new login path behind the login throttle.
- **api-engineer**'s "never" line says to read identity only from `c.get("identity")`, which the gate sets from the session or the verified JWT, and never from a header.
- **add-api-route**:
  - Step 2 says the Origin check covers every non-GET route on its own and a route never opts out.
  - Step 6 says a test signs in with `testSession` (test/session.ts) for the role it needs, and calls the Worker through `workerFetch` (test/worker-fetch.ts), which sets `Origin`. The existing `DEV_USER_EMAIL` switch stays valid for older tests.

Not here: the release-checklist line "App loads … through Access", which is still true while Access fronts the hostname and belongs to epic-access-removed. Moving the Worker tests' JWT stubs is also epic-access-removed's.

## Acceptance Criteria

Verify:
- A grep of .claude/agents and .claude/skills finds no instruction to rely on Access identity, trust a `Cf-Access-*` header, or cite ADR-0006 as the current login. The phase-1 fallback can be named only as a fallback.
- Every file, helper and check the three files name exists on `main` (`testSession`, `workerFetch`, src/worker/origin.ts, `requireAdmin`, the login throttle).
- `pnpm lint` passes.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- spec — _bmad-output/specs/spec-own-login/cutover.md, section Follow-ups
- adr — docs/adr/0029-own-login-instead-of-cloudflare-access.md
- security — docs/security.md, section Threat model
- domain — docs/domains/identity-access.md

## Notes

- Decision (2026-10-09): new Worker tests sign in with `testSession`. `DEV_USER_EMAIL` stays a supported switch, since CAP-9 keeps it for local dev and older tests use it.
- Decision (2026-10-09): release-checklist stays as it is. Its Access line describes phase 1 correctly, and epic-access-removed changes it.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
