---
tracker_id: "582"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/582"
tracker_status: backlog
id: 1
type: story
title: "ADR: admins leave the field side"
parent: epic-admins-leave-the-field
covers: [R2, R3, R4, R5, R6, R7, R8, R12]
hitl: true
risk: low
---

# ADR: admins leave the field side

## Description

Writes, through the new-adr skill, an ADR recording R2–R8: admins do no tournée, /api/agent and assignment are agent-only, an offline admin sees a Hors ligne screen instead of the field side, roles are fixed at creation, and the Agents screen becomes Utilisateurs; it amends ADR-0019 and ADR-0028 and updates the ADR index.

## Acceptance Criteria

Verify: The ADR is proposed in a pull request, ADR-0019 and ADR-0028 link to it where it amends them, and the owner sets it accepted.

## References

- parent — _bmad-output/initiative-admin-field-separated/epic-admins-leave-the-field/epic-admins-leave-the-field.md

## Notes

- Open question: What happens to visits already in an admin phone's outbox once /api/agent answers 403, which sync.ts treats as a lost session (invariant 5), and whether that 403 is a sync contract change needing a CLIENT_VERSION bump.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
