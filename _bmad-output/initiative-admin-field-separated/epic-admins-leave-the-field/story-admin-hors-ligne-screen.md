---
tracker_id: "591"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/591"
tracker_status: backlog
id: 3
type: story
title: "Admin Hors ligne screen"
parent: epic-admins-leave-the-field
covers: [R6]
after: [1, 1.1]
hitl: true
risk: medium
---

# Admin Hors ligne screen

## Description

Builds, after the owner approves its mockup, the offline admin screen of R6 in the entry chunk (copy in copy.ts, one Réessayer button that re-checks the identity) and shows it to a cached admin identity on /admin/* in place of today's offline FieldEmptyState; story 4 routes every other admin entry to it.

## Acceptance Criteria

Verify: A component test renders the screen's two lines and button, the dev server with the network off shows it on /admin for a cached admin, and the PR quotes the precache total against 1,000 KiB.

## References

- parent — _bmad-output/initiative-admin-field-separated/epic-admins-leave-the-field/epic-admins-leave-the-field.md

## Notes

- Open question: The screen's layout, frame and what Réessayer shows while it re-checks, settled by the mockup.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
