---
tracker_id: "502"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/502"
tracker_status: done
id: 6
type: story
title: "Joiners take the next numbers and leavers leave a gap"
parent: epic-numbered-tournee
covers: [R6, R8, R16]
after: [5]
risk: medium
---

# Joiners take the next numbers and leavers leave a gap

## Description

A prospect pulled after the swipe that belongs in today's tournée (R1) takes the next number after the highest, through entry 3's numbering function. It is marked « Nouveau » and sent as a stop insert through the outbox. A stop that entry 2's response marks `left` drops from Tournée and Carte, leaving its number as a gap, and leaves the total. field-operations.md › joiners and leavers follow.

## Acceptance Criteria

Verify: Tests: two prospects assigned after the swipe get 21 and 22 with « Nouveau », and D1 holds both stop rows. When unvisited stop 7 is reassigned, it disappears and the next stop does not change.

## References

- parent — _bmad-output/initiative-daily-tournee/epic-numbered-tournee/epic-numbered-tournee.md

## Notes

- Open question: What happens when two phones of one agent each append a different joiner with the same number.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
