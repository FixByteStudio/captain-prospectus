---
tracker_id: "297"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/297"
tracker_status: backlog
type: epic
title: "Cloudflare Access is gone"
parent: initiative-own-login
covers: [CAP-13, CAP-14]
after: [epic-own-login]
assignee: ""
risk: medium
---

# Cloudflare Access is gone

## Description

Phases 2 and 3 of the cutover. Every active user enrols a device. The owner then revokes Access tokens and deletes the Access application. Before the removal PR merges, the WAF question on `/api/auth/*` is answered or its residual risk recorded. Finally a PR removes the JWT fallback, `jose` and the four Access and roster vars.

## Outcome

The app runs on its own login alone. The spec's success signal holds on production with Access gone.

## Requirements

The spec's ids, in part (epic-own-login owns the rest):
- CAP-13: phases 2 and 3 of `cutover.md` — enrolment of every active user, deletion of the Access application, and the removal PR.
- CAP-14: the Access-removal parts of `docs/deployment.md` and `docs/free-tier-budget.md` (WAF check or residual risk), and moving the Worker tests' JWT stubs to the D1 session helper.

The breakdown is planned at this epic's inception.

## Done when

1. The Agents page shows every active user as "Inscrit", and the Access application and its tokens are deleted.
2. A free WAF rate-limiting rule fronts `/api/auth/*`, or `docs/free-tier-budget.md` records why none can and the residual risk.
3. Phase 3 is deployed. A search of code, `wrangler.jsonc` and CI finds no `jose`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS` or `AGENT_EMAILS`.
4. The spec's success signal runs end to end on production.
5. `docs/deployment.md` and `docs/free-tier-budget.md` describe the login with no Access in front.

## Boundaries

The owner's phase 2 steps in the Cloudflare dashboard (hitl), the phase 3 removal PR and its docs. Not any new login behaviour; that is epic-own-login.

## References

- parent — _bmad-output/initiative-own-login/initiative-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, CAP-13, CAP-14, section Constraints (WAF, request quota)
- cutover — _bmad-output/specs/spec-own-login/cutover.md, sections Phases and Follow-ups

## Notes

- Waits on epic-own-login because: phase 2 needs phase 1 live in production, and phase 3 deletes the JWT fallback that epic isolates in `src/worker/auth.ts`.
