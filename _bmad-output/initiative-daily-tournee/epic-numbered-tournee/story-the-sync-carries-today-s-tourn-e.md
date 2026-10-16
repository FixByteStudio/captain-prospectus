---
tracker_id: "498"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/498"
tracker_status: done
id: 2
type: story
title: "The sync carries today's tournée"
parent: epic-numbered-tournee
covers: [R1, R6, R10, R11, R16]
risk: high
---

# The sync carries today's tournée

## Description

Adds the `tournees` and `tournee_stops` tables in one migration and extends the sync contract in src/shared/schemas.ts. The request takes a tournée insert and stop inserts. The server writes them with onConflictDoNothing, with the agent from the session and the Brussels day from the start time clamped to received_at, and lists their ids in `accepted`. When a second phone's tournée loses to the day's first one, its tournée and stop ids are listed in `accepted` but nothing is kept (first swipe wins). The response returns today's tournée, its stops each with a server-derived `left` flag (one function), and today's visited stops: door-days with their latest outcome, closed prospects included, from one door-day reader in the Worker that entry 10 builds the admin figures on. Entries 6, 7 and 12 read `left`. A stop insert whose prospect id the server rewrites through `idMap` is rewritten like a visit. CLIENT_VERSION and MIN_CLIENT_VERSION rise together, and docs/api.md and docs/data-model.md describe the change.

## Acceptance Criteria

Verify: Worker tests: a tournée with 20 stops comes back from a sync by another session of the same agent; a resent batch inserts nothing twice; a stop for a reassigned prospect is accepted and reads `left`; a closed prospect visited today is in the visited stops; a second tournée for the same agent and day is accepted but leaves the first one's stops unchanged; an old clientVersion gets 426.

## References

- parent — _bmad-output/initiative-daily-tournee/epic-numbered-tournee/epic-numbered-tournee.md
- .claude/skills/sync-contract-change/SKILL.md
- .claude/skills/d1-migration/SKILL.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
