---
tracker_id: "106"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/106"
tracker_status: done
id: 2
type: story
title: "Visits index on visited_at"
parent: epic-dashboard
covers: [CAP-2]
risk: high
---

# Visits index on visited_at

## Description

Adds the visits(visited_at) index from server-gaps G2 through schema.ts and pnpm db:generate, as an additive migration the deployed Worker ignores.

## Acceptance Criteria

Verify: The migration applies in the worker tests, migration-guard finds no issue, and EXPLAIN QUERY PLAN on a visited_at range count uses the new index.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-dashboard/epic-dashboard.md
- server — _bmad-output/specs/spec-dashboard-redesign/server-gaps.md

## Notes


## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
