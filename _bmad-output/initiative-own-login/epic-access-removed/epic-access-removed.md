---
tracker_id: "297"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/297"
tracker_status: done
status: done
type: epic
title: "Cloudflare Access is gone"
parent: initiative-own-login
covers: [CAP-12, CAP-13, CAP-14]
after: []
assignee: ""
risk: high
---

# Cloudflare Access is gone

## Description

The removal ADR-0034 kept from the cutover. No Access application was ever created, so nobody enrols and nothing is deleted in a dashboard. The Worker loses the JWT fallback, `jose` and the four Access and roster vars. Both clients lose every path that reached for Access. `sessions.id` becomes NOT NULL. Docs and agent rules stop describing a fallback.

## Outcome

The code holds one way to sign in: our own login. The spec's success signal holds on production with no Access code left behind it.

## Requirements

The spec's ids, in part (epic-own-login owns the rest):
- CAP-12: removing the `?reconnect=1` marker, the `/cdn-cgi/` denylist entry and the Access logout link, with their tests. With them goes the client handling that only an Access redirect needed: the `access_redirect` error code and the `reconnect` sync action. `redirect: "manual"` stays as a guard.
- CAP-13: phase 3 only, since ADR-0034 dropped phases 1 and 2. The JWT check, `jose`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS` and `AGENT_EMAILS` are gone from code, config and CI.
- CAP-14: the Access-removal parts of `docs/deployment.md` and `docs/free-tier-budget.md`; the docs ADR-0034 left describing the fallback (`identity-access.md`, `api.md`, `data-model.md`, `design.md`); the agent rules; and deleting the Worker tests' JWT stubs, which all test the fallback itself.

The breakdown is in `tickets.toml` beside this file.

## Done when

1. A search of `src`, `test`, `scripts`, `package.json`, `wrangler.jsonc`, `vite.config.ts`, `vitest.config.ts`, `.dev.vars.example` and `.github` finds no `jose`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS`, `AGENT_EMAILS` or `Cf-Access-Jwt-Assertion`, and no `?reconnect=1` marker, `/cdn-cgi/` entry, Access logout link or `access_redirect`.
2. `sessions.id` is NOT NULL, and no branch handles a null id.
3. Outside `docs/adr`, the roadmap's checked history and done `docs/backlog` files, no doc, `CLAUDE.md` line, agent or skill describes an Access fallback or a cutover phase.
4. On production, the zone's rate-limiting rule blocks a burst on `/api/auth/*` before the Worker (ADR-0035).
5. With the removal deployed, the spec's success signal runs end to end on production.
6. `pnpm lint`, `typecheck`, `test` and `build` are green on `main`, and the precache stays at or under 1,000 KiB.

## Boundaries

The removal of Access code from the Worker and both clients, the `sessions.id` contract step, the docs and agent rules that describe the fallback, and the owner's check on production (hitl). Not any new login behaviour; that is epic-own-login. Not the spec's own text; see Notes.

## References

- parent — _bmad-output/initiative-own-login/initiative-own-login.md
- adr — docs/adr/0034-launch-on-our-own-login-alone.md, section Decision
- adr — docs/adr/0035-serve-the-app-on-a-domain-we-already-own.md, section Decision (the rate-limiting rule)
- spec — _bmad-output/specs/spec-own-login/SPEC.md, CAP-12, CAP-13, CAP-14, sections Constraints and Success signal
- cutover — _bmad-output/specs/spec-own-login/cutover.md, sections Code touchpoints today and Follow-ups
- deployment — docs/deployment.md, step 7 and section First sign-in

## Notes

- Source conflict: SPEC.md CAP-13 and Constraints, and cutover.md Phases — three phases with Access in front, enrolment before deletion, expand/contract migrations vs ADR-0034 (no Access application was ever created) and `CLAUDE.md`'s disposable data stage.
- Decision (2026-10-13): ADR-0034 settles it. This epic is the removal only. The old first check (every user "Inscrit", the Access application deleted) is dropped. The spec's text is left as it is; `bmad-spec` takes the correction when the owner asks.
- Source conflict: SPEC.md Constraints — "Each follow-up doc lands in its own change" vs `CLAUDE.md`'s definition of done (docs change with the behaviour they describe).
- Decision (2026-10-13): entries 1 to 5 update the docs that describe their own code in the same PR. Entry 6 takes what describes the end state.
- Decision (2026-10-09): inception adds an entry for the `sessions.id` contract step deferred from #307: make it NOT NULL and drop the null-id branches in `auth.ts` and `routes/identity.ts`.
- Decision (2026-10-13): that step is one migration (entry 5). It no longer waits a release, because the data stage is disposable. Migration 0012 backfilled every row and every insert writes an id.
- Decision (2026-10-13): no gate on #315. Production has been live since 2026-10-12 with the four vars empty, so nothing here waits on it. Only entry 1 has a prerequisite in epic-own-login: the fallback isolated in one function (1.2, done).
- Decision (2026-10-13): `redirect: "manual"` stays in the three fetches as a guard. An opaque redirect is an ordinary failure, never a lost session.
- Decision (2026-10-13): a 403 at sync is handled as a 401 is. Its only source is the cross-origin check, and the outbox is untouched either way.
- Decision (2026-10-13): tracer bullet is entry 1. The Worker lane (1, then 5) runs beside the client lane (2, 3, 4, in that order because they share `TopBar.test.tsx`, `App.tsx` and `navigateFallbackDenylist`). Entry 6 follows both, then the sweep, then the owner's check on production.
- Decision (2026-10-13): merging deploys, so the epic has no deploy step. Entry 8 is the owner's check alone.
