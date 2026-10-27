---
tracker_id: "638"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/638"
tracker_status: done
status: done
id: 6
type: story
title: "Finish R15 and clear the day-boundary test residue"
parent: epic-retro-follow-ups
covers: [CAP-18]
after: [3, 4]
risk: low
---

# Finish R15 and clear the day-boundary test residue

## Description

S6, CAP-18 (538/6, N8, N11, N12, N13), the CAP-18 list of slices.md: query-plan tests plan the statements the code runs (todayTournee reads, the owned/known lookups in writeTournees, doorDaysOn, doorDaysCounts, and the feed's tie query and seed path entry 4 leaves, in place of the hand-typed binds at admin.test.ts:2201 and :2227); the parity test takes its day key from twoPeriodsDayKey or days.dayOf with a visit within an hour of each clock switch and a doorDayCounts DST case; the position tests in sync.test.ts fake the clock; and it adds the stop-number lower bound on the wire (V8), the admin-round test with both clocks ahead (V6), the runSync « Nouveau » test with the phone ahead of serverTime (V5), a failure in the stops insert beside R3's tournée insert, and a measured doorDayCounts with a row in docs/free-tier-budget.md (invariant 13).

## Acceptance Criteria

Verify: Every line of the CAP-18 list in slices.md has a test or is marked done in the PR, pnpm test passes, and docs/free-tier-budget.md has a doorDayCounts row with its measured cost.

## References

- parent — _bmad-output/initiative-retro-follow-ups-2026-10/epic-retro-follow-ups/epic-retro-follow-ups.md

## Notes

- Open question: Whether every listed reader can be planned from Drizzle's toSQL(), or some must be exported as SQL builders first (the open question #543 left).

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
