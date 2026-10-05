---
tracker_id: "266"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/266"
tracker_status: backlog
id: 3
type: story
title: "The phone sends its last reading at sync"
parent: epic-admin-round-view
covers: [CAP-4]
after: [2]
risk: medium
---

# The phone sends its last reading at sync

## Description

Keeps the last reading useAgentPosition took (outside React state, not in Dexie) and has runSync add it as entry 2's optional `position` when it was taken today in Brussels time, never calling geolocation itself; a phone with no reading sends no field; docs/domains/field-operations.md describes it.

## Acceptance Criteria

Verify: Unit tests on runSync show the body carries today's reading, omits yesterday's or a missing one, and that a sync triggers no geolocation call; the PR quotes the precache total against 1,000 KiB and links an approved security-reviewer verdict on the diff.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-round-view/epic-admin-round-view.md
- src/client/field/useAgentPosition.ts
- src/client/field/sync.ts

## Notes

- Open question: None known.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
