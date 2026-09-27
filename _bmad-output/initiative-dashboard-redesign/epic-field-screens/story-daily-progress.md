---
tracker_id: "119"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/119"
tracker_status: done
id: 2
type: story
title: "Daily progress"
parent: epic-field-screens
covers: [CAP-6]
after: [1]
risk: high
---

# Daily progress

## Description

Adds G8's Dexie version 3 log of today's sent visit ids, written when a visit is queued and pruned to today, counts n as that log plus the pending outbox rows deduplicated by visit id, and shows 'n visites sur N aujourd'hui' with its bar; exposes the queueing function the save sheet calls.

## Acceptance Criteria

Verify: Tests show two visits queued and one accepted still count 2, the next day resets the count, the outbox clears only on accepted, and a version 2 database holding outbox rows upgrades with every row intact.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-field-screens/epic-field-screens.md
- server — _bmad-output/specs/spec-dashboard-redesign/server-gaps.md

## Notes

- Open question: Which clock prunes the log: the device's local midnight is assumed.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
