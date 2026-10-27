---
tracker_id: "639"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/639"
tracker_status: done
status: done
id: 8
type: story
title: "The code dialog shows the day and the login forms read a 400 as a refusal"
parent: epic-retro-follow-ups
covers: [CAP-14, CAP-15]
after: [2, 5]
hitl: true
risk: low
---

# The code dialog shows the day and the login forms read a 400 as a refusal

## Description

S8, CAP-14 (580/3, D-1, D-2) and CAP-15 (580/7, R-7): a 24-hour code in the code dialog shows its day, not just a time; a 400 on the agent or the admin login form reads as a refusal rather than « Réessayez dans un instant », with every string in copy/ (copy/field for the field-reachable form); docs/design.md:1367 follows; and the code generate route's guarded-insert remainder of the #306 deferral at deferred-work.md:333-336 names an issue or is closed with a test; the owner reviews the wording, and the PR quotes the check:precache line.

## Acceptance Criteria

Verify: Dialog tests at +1 h and +24 h per role, a 400 test on both login forms, design.md:1367 updated, deferred-work.md's #306 entry names an issue or a test, and the PR quotes the check:precache line.

## References

- parent — _bmad-output/initiative-retro-follow-ups-2026-10/epic-retro-follow-ups/epic-retro-follow-ups.md

## Notes

- Open question: Whether the #306 remainder can be tested without a D1 hook the route does not expose; if not, it becomes an issue.
- hitl: PR says "Refs #n", I close.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
