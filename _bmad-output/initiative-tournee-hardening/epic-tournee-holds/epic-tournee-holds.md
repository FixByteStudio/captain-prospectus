---
type: epic
title: "The numbered tournée holds under failed, late and racing syncs"
parent: initiative-tournee-hardening
covers: [R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R15, R16]
after: []
assignee: ""
risk: high
---

# The numbered tournée holds under failed, late and racing syncs

## Description

Retro actions 2, 3, 4, 6 and 8 from epic #496, one story each. The sync stops failing when its tournée write throws. The Visites feed stops skipping door-days, the duplicates screen counts door-days, and the stop-number rule is written once. The earliest swipe of the day wins, whichever phone syncs first. The database refuses a second stop under one number. A stop whose prospect never arrives stops retrying for ever. « Nouveau » stops comparing two clocks. The tests pin what the epic left unpinned. The release checklist waits for the review bot, and ADR-0028 stops promising a talk with the agents that has already happened.

## Outcome

Two phones of one agent end every day with the same tournée and numbers, and no sync is refused because of its tournée. The signal is that the next retro finds none of F1–F15 open again.

## Requirements

Source: the epic #496 retro, section Action items. Each line names its action and finding.

- R1 (action 8, P3): the release checklist's Before merge list has the line "CodeRabbit finished; each actionable comment answered or filed".
- R2 (action 8, P3): ADR-0028 at lines 139–140 says the owner told both agents, not that the owner will tell them before the release. `docs/security.md` line 43 makes the same promise and changes with it.
- R3 (action 2, F1): a failure of `writeTournees` no longer fails the sync. It runs in its own try/catch, as the position write does (ADR-0028). The visits stay in `accepted`. The tournées and stops it did not write are left out of `accepted`, so the phone resends them.
- R4 (action 2, F6): the Visites live feed's cursor misses no door-day when a poll is truncated, including rows tied on `received_at` at the cut (`src/worker/door-days.ts` `doorDaysTouched`; `src/client/admin/queries.ts` and `nextSince` in `src/client/admin/visits/feed.ts`).
- R5 (action 2, F7): the duplicates screen's `aVisits` and `bVisits` count door-days, like every other admin figure (owner's decision, 2026-10-16; ADR-0036 "every admin number uses one unit").
- R6 (action 2, F8): the stop-number rule is written once in `src/shared/schemas.ts`. `tourneeStopSyncSchema` reuses `tourneeStopNumberSchema`.
- R7 (action 2, F10): every Worker test about "today" fixes the clock, as `dashboard.test.ts` does. That covers the swipe tests in `admin.test.ts` and the 60-second window in `sync.test.ts`, so the suite passes between 00:00 and 01:00 Brussels.
- R8 (action 6, F2): the earliest swipe wins. The server takes the agent's tournée for a day from `min(client_started_at)`, not the first to arrive, and stays insert-only (ADR-0007). The `tournees_agent_day_idx` unique index and the phone's adoption of the winner change with it. A phone that held a later tournée takes the winner's numbers on its next pull. This is a sync contract change, made through the `sync-contract-change` skill.
- R9 (action 3, F3): a unique `(tournee_id, number)` index, and the insert decides a collision instead of the in-memory check in `writeTournees`. One migration, no backfill (disposable stage).
- R10 (action 3, F4): a stop whose prospect never arrives no longer waits for ever. Once its tournée's day has passed, the server lists it in `accepted` and stores nothing, so it cannot fill the 250-stop slice past its day (owner's decision, 2026-10-17).
- R11 (action 3, F9): a joiner shows « Nouveau » whatever the phone's clock. The flag no longer compares a server time with a phone time (`src/client/field/tournee-stops.ts`, `joiner`).
- R12 (action 3, F5): a server test pins that a stop naming a tournée the server does not hold for this agent is accepted and not stored.
- R13 (action 4, F11, F14): one parity test runs the three door-day readers in `src/worker/door-days.ts` (`doorDaysBetween`, `doorDaysOn`, `doorDaysTouched`) over one seed that crosses both clock changes. `doorDaysOn` and, in `src/worker/tournee.ts`, `writeTournees` and `todayTournee` get DST-day tests.
- R14 (action 4, F12): Worker tests parse responses with their zod schemas: `syncResponseSchema`, `todayTourneeSchema`, `adminVisitsResponseSchema` and `agentRoundResponseSchema`.
- R15 (action 4, F13): `src/worker/db/indexes.test.ts` plans the statements the code runs, not hand-copied SQL.
- R16 (action 4, F15): the six client tests the retro lists, starting with the partial-accept drain: a sent stop the server did not list, next to one it did.

The breakdown is in `tickets.toml` beside this file.

## Done when

1. A Worker test whose `writeTournees` throws gets a 200 with its visits in `accepted`. A feed polled with a limit below the arrivals, with a tie at the cut, returns every door-day over successive polls. A duplicates pair with two visits on one day counts 1.
2. When the later swipe syncs first and the earlier one syncs second, both phones' next pulls and the admin round return the earlier tournée and its numbers, also when both phones' clocks run ahead of the server's.
3. D1 refuses a second stop under one number in one tournée. A stop whose prospect never arrives is accepted and dropped once its day has passed. A joiner shows « Nouveau » with the phone's clock ahead of the server's.
4. The tests the retro names in F10 pass with `Date` faked to 00:30 Brussels. The parity, schema-parse, query-plan and client tests of R13–R16 are in it. Changing the drain to "delete everything sent" fails a test.
5. The release checklist carries the review-bot line, and neither ADR-0028 nor `security.md` promises a future talk with the agents.
6. The epic is on production through CI. `pnpm lint`, `typecheck`, `test`, `build` and `check:precache` are green, and `docs/api.md`, `docs/data-model.md`, `docs/domains/field-operations.md` and ADR-0036 match what shipped.

## Boundaries

The sync route and contract, `writeTournees` and the tournée tables, the Visites feed, the duplicates screen, the Worker and client tests the retro names, the release checklist, and ADR-0028's consequence line. Not the location-gate threshold (action 1). Not F17, the admin round's own `left` check, and not the retro's unverified findings; the retro deferred both. Not #527, #528 or #530, which have their own issues. Not admin-built tournées (T2).

## References

- parent — _bmad-output/initiative-tournee-hardening/initiative-tournee-hardening.md
- retro — _bmad-output/implementation-artifacts/epic-496-retro-2026-10-16.md, sections Diff-scope review: Worker and shared, Diff-scope review: client, Process (session logs and PRs), Action items
- adr — docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md, sections Decision and Numbers
- constraint — docs/adr/0007-offline-first-insert-only-sync.md
- constraint — docs/adr/0022-quarantine-visits-the-server-cannot-take.md
- constraint — docs/adr/0028-agent-position-at-sync.md, section Consequences
- constraint — docs/adr/0031-the-precache-ceiling-counts-every-precached-entry.md
- constraint — docs/adr/0033-rollout-rules-wait-for-protected-data.md
- domain — docs/domains/field-operations.md, section Protocol
- docs — docs/api.md, docs/data-model.md
- skill — .claude/skills/sync-contract-change/SKILL.md
- skill — .claude/skills/d1-migration/SKILL.md
- skill — .claude/skills/release-checklist/SKILL.md

## Notes

- Decision (2026-10-17): one story per retro action, in the order 8, 2, 6, 3, 4 (entries 1–5). The owner asked for one story per item.
- Decision (2026-10-17): no closing refactor sweep. The owner asked for one story per item, and entry 5 already pays the epic's test debt.
- Decision (2026-10-17): five stories, kept after the set check called entries 2, 4 and 5 large for one session. A builder that finds one too big splits it at planning; the seams are Worker and client.
- Decision (2026-10-17): F4 drains a stop whose prospect never arrived once its tournée's day has passed (R10). The owner chose this over a quarantine table, so ADR-0022 does not change.
- Decision (2026-10-17): no tracer bullet. The epic is a set of fixes to a shipped feature, with no new path through the layers. Entry 1 goes first so its checklist line is in place for the later PRs. That is not a code prerequisite, so no entry lists it in `after`. It touches only the release checklist, ADR-0028 and `security.md`, so it runs beside entry 2.
- Decision (2026-10-17): entries 2 → 3 → 4 → 5 are one lane. They share the sync handler in `src/worker/routes/agent.ts`, `writeTournees`, `src/shared/schemas.ts`, `src/worker/db/schema.ts` and its migrations, `src/worker/sync.test.ts` and `src/client/field/sync.ts`. Entry 3, the least certain, comes right after entry 2 because it builds on entry 2's guard (R3) and schema rule (R6). Entry 4 follows entry 3 because its index and its policy for stops that never arrive apply to the tournées entry 3 keeps. Entry 5 tests what entries 2–4 leave.
- Source conflict: ADR-0036 › Numbers, "Only a number not yet synced can change" vs R8. With the earliest swipe winning, a phone whose tournée was the day's tournée renumbers when an earlier swipe arrives later, even though its numbers were synced.
- Assumption: entry 3 rewords ADR-0036 › Numbers in place, as the 2026-10-15 amendment did, since the owner's decision restores the ADR's own "first swipe wins". The builder confirms with `architect` that no new ADR is needed (ADR-0024).
- Decision (2026-10-17): "earliest" is `min(client_started_at)`, the retro's words, with the id as tie-break. The clamped `started_at` was set aside: with both phones' clocks ahead, both clamp to their arrival times and arrival order decides again.
- Assumption: R2 rewords `docs/security.md` line 43 beside ADR-0028. The previous retro's item 7 named `field-operations.md`, which carries no such promise; `security.md` does.
- Unknown: whether R11 needs a new field in the sync response. Entry 4's builder settles it while planning.
- Parked: F17 (the admin round re-derives `left`) and the retro's unverified findings. The retro deferred them, and they are not in actions 2, 3, 4, 6 or 8.
