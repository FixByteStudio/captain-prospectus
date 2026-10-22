---
tracker_id: "543"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/543"
tracker_status: done
id: 5
type: story
title: "The tests pin the door-day readers, the wire schemas and the outbox drain"
parent: epic-tournee-holds
covers: [R13, R14, R15, R16]
after: [2, 4]
risk: medium
---

# The tests pin the door-day readers, the wire schemas and the outbox drain

## Description

Retro action 4, faking the clock as entry 2's tests do: one parity test runs doorDaysBetween, doorDaysOn and doorDaysTouched over one seed that crosses both clock changes, with DST-day tests for doorDaysOn, writeTournees and todayTournee (F11, F14); Worker tests parse the sync, today-tournée, admin visits and agent round responses with their zod schemas (F12); indexes.test.ts plans the statements the code runs, against the indexes entries 3 and 4 leave (F13); and the six client tests of F15 are added, the partial-accept drain first.

## Acceptance Criteria

Verify: pnpm test passes with the new tests, and three hand mutations each fail one: the outbox drain changed to delete every sent stop, a day boundary in doorDaysOn replaced by dayStart + DAY_MS, and serverTime dropped from the sync response.

## References

- parent — _bmad-output/initiative-tournee-hardening/epic-tournee-holds/epic-tournee-holds.md

## Notes

- Open question: Whether indexes.test.ts can plan Drizzle's built statements through toSQL() for every reader, or some must be exported as SQL builders first.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
