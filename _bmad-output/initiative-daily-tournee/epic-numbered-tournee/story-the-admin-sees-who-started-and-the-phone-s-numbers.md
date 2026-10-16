---
tracker_id: "508"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/508"
tracker_status: done
id: 12
type: story
title: "The admin sees who started and the phone's numbers"
parent: epic-numbered-tournee
covers: [R14, R15, R16]
after: [5, 10, 11]
risk: medium
---

# The admin sees who started and the phone's numbers

## Description

« Agents en tournée » and the recap card's « actifs aujourd'hui » count agents who started today's tournée. /api/admin/agents/:email/round returns the tournée's stops with their numbers, hiding those entry 2 marks `left`, so the admin round view shows the phone's numbers, through entry 5's round-map.ts, and the ADR-0028 reading only places the marker. It removes buildTodayList's last caller (entry 5). docs/api.md follows.

## Acceptance Criteria

Verify: Worker tests: an agent who swiped but sent no visit counts in both figures. On a local build, the admin round view shows the same numbers as the phone's Tournée and Carte.

## References

- parent — _bmad-output/initiative-daily-tournee/epic-numbered-tournee/epic-numbered-tournee.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
