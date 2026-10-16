---
tracker_id: "503"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/503"
tracker_status: done
id: 7
type: story
title: "The counter counts arrêts from the server and the outbox"
parent: epic-numbered-tournee
covers: [R7, R16]
after: [2, 6]
risk: medium
---

# The counter counts arrêts from the server and the outbox

## Description

Built to entry 1's design, DailyProgress reads « {n} sur {total} » in arrêts. n is the tournée's stops with a visit today, from entry 2's visited stops joined with the outbox by visit id. total is the snapshot plus joiners minus stops that left unvisited. Both come from one shared helper that Carnet (entry 8) reuses. The sentVisits table and its writers go, and field-operations.md follows.

## Acceptance Criteria

Verify: Tests: 15 visited stops of 20 read « 15 sur 20 », and a second visit to stop 3 leaves it unchanged. A reassigned unvisited stop lowers total. A cache wipe followed by a sync restores the counter, and n never exceeds total.

## References

- parent — _bmad-output/initiative-daily-tournee/epic-numbered-tournee/epic-numbered-tournee.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
