---
tracker_id: "501"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/501"
tracker_status: backlog
id: 5
type: story
title: "Tournée and Carte show the stops by their swipe numbers"
parent: epic-numbered-tournee
covers: [R6, R8, R16]
after: [4]
risk: medium
---

# Tournée and Carte show the stops by their swipe numbers

## Description

Built to entry 1's design, Tournée lists the tournée's stops with no visit today, in number order, and the next-stop card shows the lowest of them as « Arrêt {n} ». Every saved stop leaves Tournée whatever its outcome, and the « Plus tard » section leaves Tournée. The Carte pins and the round-map.ts helpers that the admin round list also imports read the same numbers. The phone stops calling buildTodayList's live order; the admin round view keeps calling it, with list positions as pin numbers, until entry 12 removes that last caller. The end-of-round rows of round-placement.md go; field-operations.md and the round-placement spec say so.

## Acceptance Criteria

Verify: Tests: after stops 1 to 3 are visited and stop 4 is skipped, the card shows 4 and stop 5 still reads 5 on its row and its pin. On a local build, Tournée and Carte show the same numbers after three saved visits with different outcomes.

## References

- parent — _bmad-output/initiative-daily-tournee/epic-numbered-tournee/epic-numbered-tournee.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
