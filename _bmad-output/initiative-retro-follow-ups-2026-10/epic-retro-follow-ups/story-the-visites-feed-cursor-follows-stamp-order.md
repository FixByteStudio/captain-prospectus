---
tracker_id: "636"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/636"
tracker_status: backlog
id: 4
type: story
title: "The Visites feed cursor follows stamp order"
parent: epic-retro-follow-ups
covers: [CAP-16]
risk: medium
---

# The Visites feed cursor follows stamp order

## Description

S4, CAP-16 (538/4, N2, N3), the two-deferral enabler that closes the #540 and #528 deferrals: a sync that stamps received_at early and commits late can no longer be skipped by the Visites feed cursor, whether received_at is stamped at insert or compared another way (the story's call), and a reason-filtered delta poll that is truncated advances nextSince past dropped door-days; the sync contract does not change; docs/api.md follows if the feed's response or cursor changes; the #540 and #528 entries in _bmad-output/implementation-artifacts/deferred-work.md are closed; and the PR names the feed's tie query and seed path as it leaves them, which entry 6 plans from the code.

## Acceptance Criteria

Verify: A Worker test with S1 stamped 1000 / committed 1800 and S2 stamped 1200 / committed 1300 lists both syncs' visits over successive polls, and a truncated reason= poll advances nextSince.

## References

- parent — _bmad-output/initiative-retro-follow-ups-2026-10/epic-retro-follow-ups/epic-retro-follow-ups.md

## Notes

- Open question: Whether stamping received_at at insert fits the 10 ms CPU budget and the 100-parameter batches, or the cursor must compare a commit order instead.
- S4 and S5 are the two-deferral enablers.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
