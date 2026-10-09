---
tracker_id: "313"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/313"
tracker_status: backlog
id: 16
type: story
title: "deployment and free-tier-budget docs describe phase 1"
parent: epic-own-login
covers: [CAP-14, CAP-13]
after: [10]
risk: low
refined: true
---

# deployment and free-tier-budget docs describe phase 1

## Description

Gives the owner what they need to run phase 1 from docs/deployment.md alone, and puts the login's cost in docs/free-tier-budget.md. It changes docs only, in two PRs, one per doc (the spec's follow-up rule).

**docs/deployment.md**
- **A one-time setup step for the three secrets**, after the Access and vars steps. Each is set with `npx wrangler secret put`, so CI deploys keep it:
  - `AUTH_PEPPER`: a long random value (with a command to generate one). Changing it signs everyone out and voids every code and passphrase.
  - `BREAK_GLASS`: a long random value the owner also keeps offline.
  - `OWNER_EMAIL`: the owner's email. It is set as a secret, not a `wrangler.jsonc` var, because it never goes in the repo and a dashboard var does not survive a deploy.

  Without `AUTH_PEPPER`, the Worker skips sessions and sign-in answers 500, so Access alone keeps working.
- **A Cutover section.** It gives the three phases in one line each, linking ADR-0029. Then it lists the phase-1 steps in order: set the secrets, deploy through CI, sign in through break-glass at `/login`, generate the owner's own passphrase, create every user on the Agents page, and give each agent a code. It ends with the checks entry 18 runs: the owner's session survives a reload, the 11th bad login gets 429 with `Retry-After`, a cross-origin POST gets 403, and the retention log line shows the auth counts. Phases 2 and 3 say only that epic-access-removed documents them.
- **Mobile install**: until phase 2 the agent passes Access, then types the code an admin gives them at `/login`, then adds the app to the home screen.

**docs/free-tier-budget.md**
- **Reads**: the session lookup on every authenticated request, as rows read per request and per day at the table's request estimate, against 5 M.
- **Writes**: at most one slide per session an hour, plus what each sign-in writes (the session, the spent code, the attempt reservation), per day, against 100 k.
- **CPU**: one HMAC-SHA-256 per request with a session cookie, and the fixed work of a sign-in, against the 10 ms watch-out.
- **The exposed request quota**: anonymous `/api/auth/*` requests count against the 100,000 a day even when they get 429. This is recorded as a residual risk until the WAF question is answered before phase 3 (epic-access-removed).
- The table's "Checked" date moves to the day of the PR.

Not here: removing Access from the one-time setup, or the phase 2 and 3 steps (both epic-access-removed). Also not here: the retention paragraph, which entry 13 already wrote.

## Acceptance Criteria

Verify:
- Someone who has not read the code can set the three secrets and run phase 1 from docs/deployment.md alone. Every command and screen it names exists.
- Every figure in free-tier-budget.md follows from a constant or query on `main` (the slide interval, the lifetimes, the session lookup), and the doc says which.
- No sentence tells anyone to put a secret or `OWNER_EMAIL` in `wrangler.jsonc` or the repo.
- `pnpm lint` passes on both PRs.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, section Constraints (cost, request quota, WAF)
- cutover — _bmad-output/specs/spec-own-login/cutover.md, section Phases
- data — _bmad-output/specs/spec-own-login/auth-data.md, section Vars and secrets
- adr — docs/adr/0029-own-login-instead-of-cloudflare-access.md

## Notes

- Decision (2026-10-09): the phased cutover stays as written, even though production has never been deployed (deploy.yml is manual until M6). Whether the first deploy should skip Access is a separate question for entry 18 and epic-access-removed.
- Decision (2026-10-09): `OWNER_EMAIL` is set with `wrangler secret put`. This departs from auth-data.md, which calls it a var, because a dashboard var does not survive a deploy and the repo must not hold it.
- Decision (2026-10-09): deployment.md covers phase 1 only. Phases 2 and 3 get one line each pointing to epic-access-removed, which owns the Access-removal parts of this doc.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
