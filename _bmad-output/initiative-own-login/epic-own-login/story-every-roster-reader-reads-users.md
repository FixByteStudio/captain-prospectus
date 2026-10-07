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
---

# Every roster reader reads users

## Description

Moves the assign menu (GET /api/admin/agents), the dashboard's agent rows (assignableEmails in routes/admin.ts) and the ADR-0028 position gate (routes/agent.ts) from ADMIN_EMAILS and AGENT_EMAILS to users.role and users.active, and checks the other grep hits (src/shared/schemas.ts, src/worker/types.ts) for roster use.

## Acceptance Criteria

Verify: Worker tests show a created agent appears in GET /api/admin/agents and has their position stored at sync, a deactivated one leaves the menu, and a grep finds ADMIN_EMAILS and AGENT_EMAILS only in auth.ts's JWT fallback and types.ts.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
