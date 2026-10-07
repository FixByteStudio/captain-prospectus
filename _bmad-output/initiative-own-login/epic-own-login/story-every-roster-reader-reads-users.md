---
tracker_id: "303"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/303"
tracker_status: backlog
id: 6
type: story
title: "Every roster reader reads users"
parent: epic-own-login
covers: [CAP-11, CAP-1]
after: [5]
risk: medium
refined: true
---

# Every roster reader reads users

## Description

Moves every roster reader from ADMIN_EMAILS and AGENT_EMAILS to active users rows (users.role and users.active):
- **The assign menu** (GET /api/admin/agents) lists active users. Its response shape does not change, so the client needs no change.
- **One agent's round** returns 404 for an email with no active users row.
- **The assignee check** refuses to assign a prospect to an email with no active users row. Unassigning is still allowed.
- **The dashboard's agent rows** list active users only.
- **The ADR-0028 position gate** stores a position only for a signed-in agent with an active users row. An agent signed in through the JWT fallback with no row stores none.

A deactivated agent's prospects stay assigned; entry 11 lists them. The comments in src/shared/schemas.ts and src/worker/types.ts that say there is no users table are updated. Tests that relied on the roster vars use users rows through the existing test helper.

The vars themselves stay in wrangler.jsonc and the test config until epic-access-removed. After this story, only the JWT fallback reads ADMIN_EMAILS, and nothing reads AGENT_EMAILS.

## Acceptance Criteria

Verify: Worker tests show a created agent appears in GET /api/admin/agents, can be assigned a prospect, has a round, and has their position stored at sync. A deactivated one leaves the menu and the dashboard's agent rows, cannot be newly assigned, and their round gets 404, while their prospects stay assigned. A grep under src/ finds ADMIN_EMAILS and AGENT_EMAILS only in auth.ts's JWT fallback and types.ts.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, section CAP-11
- adr — docs/adr/0028-agent-position-at-sync.md

## Notes

- Decision (2026-10-07): every roster reader decides from active users only; a deactivated agent leaves the menu, the dashboard's agent rows and the round view, and cannot be newly assigned.
- Decision (2026-10-07): the vars stay configured until epic-access-removed; the grep check covers src/ only.
- Deploys are manual (deploy.yml runs on workflow_dispatch), so production keeps today's roster until entry 18, where the owner creates every user before anyone assigns.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
