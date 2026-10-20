---
tracker_id: "593"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/593"
tracker_status: backlog
id: 5
type: story
title: "Roles are fixed at creation"
parent: epic-admins-leave-the-field
covers: [R7]
after: [1, 1.1]
risk: low
---

# Roles are fixed at creation

## Description

Drops role from userUpdateSchema and the PATCH /api/admin/users/:email guard (which then protects only the last active admin from deactivation), removes « Passer admin » / « Passer agent » and the self-demotion jump, and makes the deactivation confirmation ask for a sync first; delivers R7.

## Acceptance Criteria

Verify: Worker tests show a PATCH carrying role is refused with 400 and the last active admin cannot be deactivated, and a screen test shows no role toggle in the row menu and the sync sentence in the deactivation confirmation.

## References

- parent — _bmad-output/initiative-admin-field-separated/epic-admins-leave-the-field/epic-admins-leave-the-field.md

## Notes

- Open question: None known; the copy of the deactivation sentence is written in the story.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
