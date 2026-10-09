---
title: "deployment and free-tier-budget docs describe phase 1"
type: 'chore'
created: '2026-10-09'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: []
review_loop_iteration: 0
baseline_commit: 'd481c22408e89e5bebc909f5c1f9b382951e37ab'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `docs/deployment.md` does not say how to set the three sign-in secrets or run phase 1 of the cutover, and `docs/free-tier-budget.md` does not cost the login (GH #313, CAP-14, CAP-13).

**Approach:** Docs only, two PRs, one per doc. Every figure in the budget follows from a constant or query on `main`. Not here: removing Access from the setup, phases 2 and 3 (epic-access-removed), the retention paragraph.

</frozen-after-approval>

## Implementation Notes

- Oneshot: prose only. PR 1 (`docs/313-deployment-phase-1`) edits deployment.md and carries this spec; PR 2 (`docs/313-free-tier-budget-login`) edits free-tier-budget.md. Both cut from `origin/main` d481c22.
- deployment.md: new setup step 6 (renumbering the old 6–11 to 7–12; nothing links to the numbers), a Cutover section, the mobile-install line, the Auth cell of the environments table.
- Sources: `src/worker/routes/auth.ts`, `login-throttle.ts`, `origin.ts`, `retention.ts` (`describeSweep`), `types.ts`, `copy/admin.ts`, `copy/field.ts`.
- The pipe in `openssl rand -hex 32 | wrangler secret put` is used only for `AUTH_PEPPER`: nobody keeps it. `BREAK_GLASS` is printed first so the owner can store it offline.

## Spec Change Log

## Review Triage Log

Quick review done inline against the code, no subagent lens: every command, screen and status code named in deployment.md was checked against `main` (secrets in `types.ts`, 500/401 paths in `auth.ts` and `routes/auth.ts`, 10 failures then 429 in `login-throttle.ts`, 403 in `origin.ts`, log line in `retention.ts`, French labels in `copy/admin.ts` and `copy/field.ts`). No findings.
