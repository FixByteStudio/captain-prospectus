---
tracker_id: "590"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/590"
tracker_status: done
id: 2
type: story
title: "Agent-only field API and assignment"
parent: epic-admins-leave-the-field
covers: [R2, R3, R4, R5]
after: [1]
hitl: true
risk: medium
---

# Agent-only field API and assignment

## Description

Adds requireAgent beside requireAdmin on /api/agent/*, removes agent.ts's admin exceptions (position at :284, any prospect's visits at :342), and narrows the roster to active agents so /api/admin/agents, PATCH and bulk assign refuse an admin, with docs/api.md and docs/domains/identity-access.md updated; delivers R2–R4 and the server part of R5.

## Acceptance Criteria

Verify: Worker tests show an admin session gets 403 from POST /api/agent/sync and that assigning a prospect to an admin is refused on PATCH and on bulk assign, while an agent's sync and assignment still pass.

## References

- parent — _bmad-output/initiative-admin-field-separated/epic-admins-leave-the-field/epic-admins-leave-the-field.md

## Notes

- Open question: Whether the recap and the admin round view, which also read activeRoster, need anything beyond the roster narrowing; imports carry no assignee (see the epic's Source conflict).

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
