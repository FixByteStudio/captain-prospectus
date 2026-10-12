---
name: d1-migration
description: Change the D1 database schema safely with Drizzle and wrangler. Use whenever src/worker/db/schema.ts must change.
---

# D1 migration

Read the data stage at the top of `CLAUDE.md` first ([ADR-0033](../../../docs/adr/0033-rollout-rules-wait-for-protected-data.md)).
While it is **disposable**, any change goes in one migration: no backfill, no second release.
Once it is **protected**, migrations run in CI **before** the new Worker deploys, so the old Worker
must survive the new schema.

## Steps
1. Edit `src/worker/db/schema.ts`.
2. `pnpm db:generate` → new file in `drizzle/`. Read the SQL.
3. `pnpm db:migrate:local`, run the app and tests.
4. Update `docs/data-model.md` (ERD + rules + indexes).
5. Ask the `migration-guard` subagent to review.

## When protected: safe in one release
- New table.
- New nullable column, or NOT NULL **with a default**.
- New index.

## When protected: needs two releases (expand → contract)
| Change | Release 1 | Release 2 |
|---|---|---|
| Rename column | add new column, write both, read new | drop old |
| Drop column | stop reading/writing it | drop it |
| Make column NOT NULL | backfill + code always writes it | add constraint (table rebuild) |

## Never, in either stage
- Edit a migration already merged to `main`. Squashing `drizzle/` while disposable is a separate PR,
  only when the owner asks.
- Update or delete rows in `visits` (append-only). **One exception, ADR-0023:** the
  retention sweep nulls `lat`, `lng` and `notes` on visits older than
  `RETENTION_DAYS`. It never deletes a row and never touches anything sync or the
  derived status reads. Do not read it as permission for a second exception.
- Run `db:migrate:remote` yourself.
