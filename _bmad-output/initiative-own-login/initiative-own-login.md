---
tracker_id: "2"
remote: "https://github.com/FixByteStudio/captain-prospectus/milestone/2"
tracker_status: backlog
type: initiative
title: "Agents and admins sign in through our own login"
parent: none
covers: [CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-6, CAP-7, CAP-8, CAP-9, CAP-10, CAP-11, CAP-12, CAP-13, CAP-14]
after: []
assignee: ""
risk: high
---

# Agents and admins sign in through our own login

## Description

Cloudflare Access is replaced by a login the Worker owns: users in D1, one revocable session per device, one-time codes for agents, generated passphrases for admins, and a break-glass path for the owner, all decided in ADR-0029. The spec owns the capabilities, constraints and non-goals; this initiative delivers them through the three-phase cutover in its `cutover.md`, without locking anyone out.

## Outcome

The owner adds, enrols and removes an agent without a deploy, and nobody leaves the app to sign in; the spec's success signal, with Access gone, is the measure.

## Done when

1. With Access deleted, an admin creates an agent on the Agents page, gives them a code, and the agent signs in on the installed PWA. They appear in the assign menu and their position is stored at the next sync, with no deploy in between.
2. Deactivating that agent gets a 401 on the phone's next request. The phone opens `/login` and every unsent visit stays in the outbox.
3. No step of the cutover locked out an active user: each phase shipped while the previous phase's deployed Worker still worked.
4. `jose`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS` and `AGENT_EMAILS` are gone from code, config and CI, and every follow-up doc in `cutover.md` describes the new login.
5. Auth stays inside the free tier: no new paid service or binding, and `docs/free-tier-budget.md` records the added D1 reads and writes and the exposed request quota.

## Boundaries

Follows the cutover's expand/contract line: epic-own-login ships phase 1 (our login beside an Access fallback), epic-access-removed covers phases 2 and 3 (agents enrol, Access goes). Not passkeys, TOTP, chosen passwords, emailed codes, user deletion or the rate-limiting binding; see the spec's Non-goals. Tracer path: break-glass gives the owner a D1 session on `/login`, and the Worker accepts it ahead of the Access JWT.

- Touch point: Cloudflare dashboard — the Access application and its tokens (deleted), and a free WAF rate-limiting rule on `/api/auth/*` if one exists; owner: epic-access-removed (hitl)
- Touch point: CI secrets and vars — `AUTH_PEPPER`, `BREAK_GLASS`, `OWNER_EMAIL` set by the owner; owner: epic-own-login (hitl)
- Touch point: UX run `EXPERIENCE.md` (ux-captain-prospectus-2026-09-24) — its three-row À traiter rule; its owner updates it, epic-own-login raises the request
- Touch point: GH #209 (admin session-expired dialog) — stays its own issue; epic-own-login only sends a 401 to `/login`

## References

- spec — _bmad-output/specs/spec-own-login/SPEC.md, section Capabilities
- constraint — the same spec, sections Constraints and Non-goals
- data — _bmad-output/specs/spec-own-login/auth-data.md
- cutover — _bmad-output/specs/spec-own-login/cutover.md
- adr — docs/adr/0029-own-login-instead-of-cloudflare-access.md

## Notes

- Decision (2026-10-07): two epics split at the cutover's owner step: epic-own-login (phase 1), epic-access-removed (phases 2–3). User's choice over one or three epics.
- Decision (2026-10-07): each epic's Done when includes its production deploy, because phase 2 needs phase 1 live. This differs from the dashboard initiative, where deploys sat outside the epics.
- Decision (2026-10-07): GH #209 stays separate; CAP-12 covers the 401 → `/login` path only.
- Decision (2026-10-07): no platform-baseline epic; scaffold, CI and environments exist since M0.
- Decision (2026-10-07): the JWT fallback lives in one place in `src/worker/auth.ts`, owned by epic-own-login, so phase 3 deletes it without touching anything else. epic-access-removed waits on it.
- Waits on nothing external except ADR-0029 acceptance (still "proposed"), which epic-own-login's tracer records.
