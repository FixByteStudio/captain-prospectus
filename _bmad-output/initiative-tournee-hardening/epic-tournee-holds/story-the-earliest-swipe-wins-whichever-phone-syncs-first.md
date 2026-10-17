---
tracker_id: "541"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/541"
tracker_status: backlog
id: 3
type: story
title: "The earliest swipe wins, whichever phone syncs first"
parent: epic-tournee-holds
covers: [R8]
after: [2]
risk: high
---

# The earliest swipe wins, whichever phone syncs first

## Description

Retro action 6, a sync contract change through the sync-contract-change skill: keeping writeTournees inside entry 2's try/catch, stores every tournée of the agent's day insert-only, replaces the tournees_agent_day_idx unique index in one migration, makes todayTournee, the admin round and agentsStartedOn read the tournée with the earliest client_started_at (id as tie-break) instead of the first to arrive, makes a phone that held a later tournée replace its stops with the winner's on its next pull, keeps the agentsStartedOn plan in indexes.test.ts green with the minimal change (entry 5 rewrites that test), rewords ADR-0036 › Numbers, docs/api.md, docs/data-model.md, docs/domains/field-operations.md, docs/free-tier-budget.md and docs/design.md where they name the index or "the first swipe", and the PR quotes the precache total.

## Acceptance Criteria

Verify: Worker tests where the later swipe syncs first and the earlier one second, once with correct clocks and once with both phones' clocks ahead of the server, return the earlier tournée and its numbers from both phones' next pulls and from the admin round, and resending either tournée stays accepted and idempotent; a client sync test shows a phone that held the later tournée ends with only the winner's stops; if the change is breaking, CLIENT_VERSION and MIN_CLIENT_VERSION both rise and the old version gets 426; pnpm db:migrate:local applies every migration from zero.

## References

- parent — _bmad-output/initiative-tournee-hardening/epic-tournee-holds/epic-tournee-holds.md
- docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md#numbers

## Notes

- Open question: What happens to the losing phone's unsent joiners and stops on its own tournée once it adopts the winner, and whether the change is breaking (CLIENT_VERSION and MIN_CLIENT_VERSION rise together, disposable stage).

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
