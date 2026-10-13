---
tracker_id: "471"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/471"
tracker_status: backlog
id: 5
type: story
title: "sessions.id is NOT NULL"
parent: epic-access-removed
after: [1]
risk: medium
---

# sessions.id is NOT NULL

## Description

Makes sessions.id NOT NULL in one migration (disposable data stage, d1-migration skill), drops the null-id handling in auth.ts, routes/identity.ts and the test helpers, and updates data-model.md; this is the contract step deferred from GH #307 (epic Notes, 2026-10-09).

## Acceptance Criteria

Verify: pnpm db:migrate:local applies every migration from zero, a Worker test shows a sessions insert without an id is refused, pnpm test is green, and a grep of src/worker and test finds no isNull or isNotNull on sessions.id and no null check on a session id.

## References

- parent — _bmad-output/initiative-own-login/epic-access-removed/epic-access-removed.md

## Notes

- Open question: Whether drizzle-kit rebuilds the table for the NOT NULL change and keeps sessions_id_idx; migration-guard reviews the generated SQL.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
