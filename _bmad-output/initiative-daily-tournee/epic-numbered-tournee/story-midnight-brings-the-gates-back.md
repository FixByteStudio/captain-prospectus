---
tracker_id: "505"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/505"
tracker_status: done
id: 9
type: story
title: "Midnight brings the gates back"
parent: epic-numbered-tournee
covers: [R5, R16]
after: [4, 8]
risk: medium
---

# Midnight brings the gates back

## Description

At Brussels midnight the field app shows the gates again for the new day, built to entry 1's design. A visit form open across midnight saves its visit to the outbox before the start screen shows. field-operations.md follows.

## Acceptance Criteria

Verify: Tests with a fake clock: a tournée swiped on day D shows the start screen at D+1 00:00, and a visit form submitted at 00:01 reaches the outbox before the start screen renders.

## References

- parent — _bmad-output/initiative-daily-tournee/epic-numbered-tournee/epic-numbered-tournee.md

## Notes

- Open question: visited_at is set at Enregistrer, so a visit saved at 00:01 is a door-day of D+1. Open: whether D+1's Carnet lists it when its prospect is not in D+1's tournée.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
