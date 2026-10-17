---
tracker_id: "542"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/542"
tracker_status: backlog
id: 4
type: story
title: "Stop numbers are unique in the database and joiners show « Nouveau » on any clock"
parent: epic-tournee-holds
covers: [R9, R10, R11, R12]
after: [3]
risk: high
---

# Stop numbers are unique in the database and joiners show « Nouveau » on any clock

## Description

Retro action 3, building on the tournées entry 3 stores and on its migration: adds a unique (tournee_id, number) index in one migration and lets the insert decide a collision in place of writeTournees' in-memory check (F3), drains a stop whose prospect never arrived once its tournée's day has passed, listing it in accepted and storing nothing (F4, owner's decision 2026-10-17), marks a joiner « Nouveau » from something other than a server time compared with a phone time, through the sync-contract-change skill if that needs a response field (F9), and pins with a server test that a stop naming a tournée the server does not hold for this agent is accepted and not stored (F5); it updates docs/data-model.md, docs/api.md and docs/domains/field-operations.md, and the PR quotes the precache total.

## Acceptance Criteria

Verify: A Worker test shows D1 refusing a direct insert of a second stop under one number in one tournée, and two sequential syncs sending different prospects under one number both getting them in accepted with one stored; a stop whose prospect is unknown is held back on its day and listed in accepted, unstored, once its day has passed; a client test with the phone clock ahead of serverTime shows the joiner marked « Nouveau »; pnpm db:migrate:local applies every migration from zero and pnpm check:precache is green.

## References

- parent — _bmad-output/initiative-tournee-hardening/epic-tournee-holds/epic-tournee-holds.md
- docs/adr/0022-quarantine-visits-the-server-cannot-take.md
- docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md#numbers
- .claude/skills/d1-migration/SKILL.md
- .claude/skills/sync-contract-change/SKILL.md

## Notes

- Open question: How F9 tells a joiner from a snapshot stop without two clocks, and whether that needs a new field in the sync response.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
