---
tracker_id: "540"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/540"
tracker_status: backlog
id: 2
type: story
title: "A failed tournée write no longer fails the sync, and the ledger counts stay whole"
parent: epic-tournee-holds
covers: [R3, R4, R5, R6, R7]
risk: medium
---

# A failed tournée write no longer fails the sync, and the ledger counts stay whole

## Description

Retro action 2: wraps writeTournees in its own try/catch in the sync handler so its failure still acknowledges the visits and leaves its tournées and stops out of accepted (F1), makes the Visites feed cursor gap-free on a truncated poll, ties at the cut included (F6), counts door-days for the duplicates screen's aVisits and bVisits (F7), makes tourneeStopSyncSchema reuse tourneeStopNumberSchema (F8), and fixes the clock in the today-sensitive tests of admin.test.ts and sync.test.ts the retro names, as dashboard.test.ts fakes Date (F10), a setup entry 5 reuses; it updates docs/api.md for the feed and the duplicates counts.

## Acceptance Criteria

Verify: A Worker test that makes writeTournees throw gets a 200 with its visits in accepted.visits and none of its tournée or stop ids; a test at the layer the feed fix lands (doorDaysTouched or nextSince) polls with a limit below the arrivals and a tie at the cut and gets every door-day over successive polls; a duplicates pair with two visits on one day counts 1; and the tests the retro names pass with Date faked to 00:30 Brussels.

## References

- parent — _bmad-output/initiative-tournee-hardening/epic-tournee-holds/epic-tournee-holds.md

## Notes

- Open question: Whether a gap-free feed cursor needs a compound (received_at, id) cursor or a has-more flag, which may change the admin feed's response but not the sync contract.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
