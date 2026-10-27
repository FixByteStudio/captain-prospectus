---
tracker_id: "633"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/633"
tracker_status: done
status: done
id: 1
type: story
title: "Break-glass refuses an agent row"
parent: epic-retro-follow-ups
covers: [CAP-7]
risk: medium
---

# Break-glass refuses an agent row

## Description

S1, CAP-7 (579/2, 580/2, F-A, S-7; owner decision): break-glass in src/worker/routes/auth.ts no longer promotes an existing agent row named by OWNER_EMAIL, so "roles are fixed at creation" has no exception; it answers the same 401 body as the other login refusals with no Set-Cookie (580/S-3 stays true) and writes nothing, while a deactivated admin owner is still reinstated; code and tests only, the docs line goes to entry 9, and no spend-time lifetime check is added (580 question 5).

## Acceptance Criteria

Verify: A Worker test runs break-glass with OWNER_EMAIL naming an active agent and gets the shared 401 body, no Set-Cookie and no new or changed users or sessions row; a second test shows a deactivated admin owner reinstated as before.

## References

- parent — _bmad-output/initiative-retro-follow-ups-2026-10/epic-retro-follow-ups/epic-retro-follow-ups.md

## Notes

- Open question: Whether break-glass on a deactivated agent row is refused too; the spec says only an existing agent row, so the builder refuses any agent row unless the owner says otherwise.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
