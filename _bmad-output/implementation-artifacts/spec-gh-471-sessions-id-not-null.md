---
title: 'sessions.id is NOT NULL'
type: 'refactor'
created: '2026-10-13'
status: 'in-review'
route: 'oneshot'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: []
baseline_commit: 'a0e3ca0deea262fdc61bf4ecefc14560f741b759'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `sessions.id` is nullable only so the Worker deployed before GH #307 could keep inserting rows without one. That Worker is gone, yet `auth.ts`, `routes/identity.ts` and the test helper still carry null-id branches (GH #471, the contract step deferred from #307).

**Approach:** One migration makes `sessions.id` NOT NULL (disposable data stage: no backfill). Drop every null-id branch in `auth.ts`, `routes/identity.ts` and the test helpers, and update `docs/data-model.md`.

Verify: `pnpm db:migrate:local` applies every migration from zero, a Worker test shows a `sessions` insert without an id is refused, `pnpm test` is green, and a grep of `src/worker` and `test` finds no `isNull` or `isNotNull` on `sessions.id` and no null check on a session id.

</frozen-after-approval>

## Implementation Notes

Oneshot: about 60 lines across schema, one generated migration, `auth.ts`, `routes/identity.ts`, `test/session.ts`, two tests and one doc paragraph.

Open question from the story, answered: drizzle-kit rebuilds `sessions` (`0015_old_mantis.sql`) and recreates `sessions_user_email_idx` and `sessions_id_idx`. The rebuild copies `id` as is, with no backfill (data stage: disposable), so a row still holding a null id would fail the migration; none can be written since #307. The review subagents (quick lens, migration-guard) were not run: no explicit go-ahead to spawn them.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm db:migrate:local` -- expected: every migration applies from zero; `sessions_id_idx` survives the table rebuild
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: green
- `grep -rnE "(isNull|isNotNull)\(sessions\.id" src/worker test` -- expected: no match
