---
tracker_id: "296"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/296"
tracker_status: backlog
type: epic
title: "Everyone can sign in through our own login"
parent: initiative-own-login
covers: [CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-6, CAP-7, CAP-8, CAP-9, CAP-10, CAP-11, CAP-12, CAP-13, CAP-14]
after: []
assignee: ""
risk: high
---

# Everyone can sign in through our own login

## Description

Phase 1 of the cutover: the Worker gets users, sessions, codes, passphrases, break-glass, throttling and a CSRF guard. Admins get an Agents page. Every roster reader reads `users`. Both clients send a 401 to `/login`. Access still sits in front of the hostname, and the Worker falls back to its JWT when a request has no session. The spec is the contract; this epic owns all of it except phases 2–3 of CAP-13 and the deployment and budget docs that describe Access removal.

## Outcome

In production, the owner can sign in, create agents and hand out codes without a deploy, while Access keeps working as the fallback. This is the starting point phase 2 needs.

## Requirements

The spec's `CAP-N` ids are this epic's requirements, all owned here except:
- CAP-13: phase 1 only (session first, JWT fallback in one place, expand-only migrations). Phases 2–3 belong to epic-access-removed.
- CAP-12: all of it except removing the `?reconnect=1` marker, the `/cdn-cgi/` denylist entry and the Access logout link, which belong to epic-access-removed (Access fronts the hostname until phase 2).
- CAP-14: identity-access, security, api, data-model, design, free-tier-budget (reads and writes), deployment (new secrets and phase 1), the agents and the skill. The Access-removal parts of deployment and free-tier-budget belong to epic-access-removed.

## Done when

1. On production, with Access still in front, the owner signs in through break-glass, creates an agent on the Agents page and generates a code, and the agent enrols the installed PWA by typing it in. No deploy happens in between.
2. Deactivating that agent gets their phone a 401 on its next request. The phone opens `/login`, and the outbox still holds every unsent visit.
3. Outside `src/worker/auth.ts`'s JWT fallback, nothing reads `ADMIN_EMAILS` or `AGENT_EMAILS`. The assign menu, the dashboard's agent rows and the position gate all decide from `users`.
4. Against production, the 11th failed login from one IP within 15 minutes gets 429 with `Retry-After`, and a cross-origin `POST /api/*` with a valid session gets 403.
5. `pnpm lint`, `typecheck`, `test` and `build` are green on `main`, and the precache stays at or under 1,000 KiB.
6. The epic-1 follow-ups listed in `cutover.md` have each landed in their own change.

## Boundaries

The Worker's auth, the admin routes for users and sessions, the `/login` page, the Agents page, the fourth À traiter row, and 401 handling in both clients. Not the Access removal, not passkeys, not GH #209; see the spec's Non-goals.

## References

- parent — _bmad-output/initiative-own-login/initiative-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, sections Capabilities, Constraints, Assumptions
- data — _bmad-output/specs/spec-own-login/auth-data.md
- cutover — _bmad-output/specs/spec-own-login/cutover.md, sections Phases, Code touchpoints today, Follow-ups
- adr — docs/adr/0029-own-login-instead-of-cloudflare-access.md
- design — docs/design.md, sections Tableau de bord and Working with shadcn in this repo

## Notes

- Unknown: `cutover.md`'s touchpoint list is narrower than the code. `grep` also finds `reconnect`, `cdn-cgi` or the roster vars in `App.tsx`, `SyncIndicator`, `sync-view`, `leave-guard`, `theme.ts`, `AdminLayout`, `OfflineBanner`, `shared/schemas.ts`, and in `assignableEmails` behind the dashboard's agent rows (`routes/admin.ts`). Some of these hits may only be the word "reconnect" in another sense. The roster story and the 401 story check them when pulled.
- Decision (2026-10-07): tracer bullet is entry 2 (break-glass session on `/login`); entry 1 precedes it because CLAUDE.md requires a screen decided in `docs/design.md` before it is built.
- Decision (2026-10-07): `docs/api.md` and `docs/data-model.md` update in the same PR as each entry that adds a route or table (CLAUDE.md Definition of done), overriding the spec constraint that each follow-up doc lands in its own change for these two. The other follow-ups keep their own changes (entries 1, 14, 15, 16).
- Decision (2026-10-07): an agent whose Access cookie expires in phase 1 before receiving a code lands on `/login` and waits for one; accepted, since the owner hands out codes right after entry 18.
- Decision (2026-10-07): entries 8 → 9 → 10 run in one lane (all add Agents page panels and auth-module code); 12 waits on 7 for `AdminLayout`; 18 entries kept in one epic over the typical 8–12.
- Decision (2026-10-09): CAP-12's removal of the Access paths moves to epic-access-removed. Until phase 2 an expired Access cookie can only be renewed by a network navigation, which the `?reconnect=1` marker provides (entry 12).
- Decision (2026-10-07): the Worker tests' Access JWT stubs stay until epic-access-removed; entry 3 adds the D1 session stub new tests use.
