---
tracker_id: "499"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/499"
tracker_status: backlog
id: 3
type: story
title: "A swipe freezes the day on the phone and the server"
parent: epic-numbered-tournee
covers: [R1, R2, R4, R6, R10, R16]
after: [1, 2]
risk: medium
---

# A swipe freezes the day on the phone and the server

## Description

Tracer bullet, built to entry 1's design. With no tournée, the field app shows the two messages. Otherwise it shows the start screen with the date and the stops. The swipe « Commencer la tournée » (swipe.ts maths, also a real button) is enabled once a position exists. It numbers the R1 snapshot nearest-next from that position through one shared pure function, which entry 6 reuses. It writes the tournée and its stops to the outbox and opens the app. The phone stores entry 2's pulled tournée, stops and visited stops in Dexie (this entry owns those tables), so a reinstall skips the gate, and a phone whose swipe lost to another phone's adopts the pulled tournée and its numbers. The swipe reading stays an ordinary ADR-0028 reading; the tournée rows hold no position. The sync is never gated: the outbox drains and the unsent-visits strip shows on the start screen. The outbox rewrites a stop's prospect id through `idMap` as it does a visit's. field-operations.md › the tournée, the no-tournée messages and the swipe follow.

## Acceptance Criteria

Verify: On a local build an agent swipes, and separately starts with the keyboard. The unsent-visits strip shows on the start screen while a visit is queued. The outbox drains and D1 holds the tournée and its numbered stops. A second browser profile signed in as the same agent lands on Tournée without the start screen. Tests cover the snapshot rule, and the PR quotes the precache total.

## References

- parent — _bmad-output/initiative-daily-tournee/epic-numbered-tournee/epic-numbered-tournee.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
