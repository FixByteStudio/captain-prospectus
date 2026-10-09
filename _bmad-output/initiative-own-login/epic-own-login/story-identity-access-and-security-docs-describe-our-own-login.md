---
tracker_id: "311"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/311"
tracker_status: backlog
id: 14
type: story
title: "identity-access and security docs describe our own login"
parent: epic-own-login
covers: [CAP-14]
after: [10, 11, 12, 13]
risk: low
refined: true
---

# identity-access and security docs describe our own login

## Description

Brings docs/domains/identity-access.md and docs/security.md fully up to date with our own login. Entries 2–12 already updated both docs as they shipped: the identity order, codes, break-glass, passphrases, throttling, the Origin check, device sessions and 401 handling are in place. This story fixes the sentences that still describe Access as the login, and adds what no entry owned. It changes docs only, in two PRs, one per doc (the spec's follow-up rule).

**docs/domains/identity-access.md**
- The stolen-phone path: an admin revokes the device's session or deactivates the user, instead of removing the email from the Access policy.
- "The Worker re-derives identity from the verified JWT" and "who holds the Access cookie": these say the session first, with the Access JWT as the phase-1 fallback. The B-on-A's-phone example signs B in with a code.
- The Permissions table gains the admin-only actions: manage users, generate a code, revoke a device's session, and regenerate one's own passphrase.
- The nightly sweep of expired codes, sessions and `login_attempts` (entry 13), in one line linking data-model.md.

**docs/security.md**
- **Stolen phone** is rewritten: revoke the device or deactivate the user, the next request gets 401, the cached round goes, the outbox stays, and an unused session expires after 90 days (agent) or 30 days (admin).
- **Access bypass** is renamed for what it now covers: a request with no valid session. It keeps the phase-1 JWT fallback as one clause.
- New rows: **leaked database** (only HMACs of codes, passphrases, tokens and IPs are stored), **secret handling** (`AUTH_PEPPER`, `BREAK_GLASS`, `OWNER_EMAIL`; rotating the pepper voids every code, passphrase and session), and **log hygiene** (no code, passphrase, token, hash, IP or User-Agent in any log line).
- The Secrets section lists the three new secrets beside `GOOGLE_PLACES_KEY`, which is no longer "the one real secret". How to set them stays in docs/deployment.md (entry 16).

Not here: docs/api.md, docs/data-model.md, docs/deployment.md, docs/free-tier-budget.md, and the Access removal (epic-access-removed). No code changes.

## Acceptance Criteria

Verify: A reviewer reading both docs finds:
- No sentence describing Access as the login, other than the phase-1 JWT fallback.
- Each security.md row, new or rewritten, names the code or test that enforces it. A row the code does not fully honour says so and links an issue, as the threat model's header requires.
- Every rule matches the code on `main` at the time of the PR (session lifetimes, the 401 paths, what is hashed, what is logged).
- `pnpm lint` passes on both PRs.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, section CAP-14
- cutover — _bmad-output/specs/spec-own-login/cutover.md, section Follow-ups
- data — _bmad-output/specs/spec-own-login/auth-data.md
- adr — docs/adr/0029-own-login-instead-of-cloudflare-access.md

## Notes

- Decision (2026-10-09): the story only fixes what entries 2–12 left. The full rewrite in the original entry is no longer needed, because each entry updated identity-access.md and security.md in its own PR.
- Decision (2026-10-09): waits on entry 13 too, so the docs describe a sweep that exists.
- Decision (2026-10-09): the two docs still ship as two PRs, per the spec's follow-up rule and the epic's Decision of 2026-10-07.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
