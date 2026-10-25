---
tracker_id: "635"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/635"
tracker_status: backlog
id: 3
type: story
title: "A test pins the prospect outbox drain"
parent: epic-retro-follow-ups
covers: [CAP-1]
risk: low
---

# A test pins the prospect outbox drain

## Description

S3, CAP-1 (538/1, N9): a client test in the field sync tests sends two field prospects, has the server list only one in accepted, and shows the other stays in the outbox (invariant 5), so the mutation "delete every prospect sent" in src/client/field/sync.ts fails a test where it survives today.

## Acceptance Criteria

Verify: pnpm test passes, and changing the prospect drain in src/client/field/sync.ts to delete every sent prospect makes the new test fail.

## References

- parent — _bmad-output/initiative-retro-follow-ups-2026-10/epic-retro-follow-ups/epic-retro-follow-ups.md

## Notes

- Open question: None known; the stop drain test of #543 is the pattern.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
