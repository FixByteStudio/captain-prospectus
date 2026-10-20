---
title: 'A repaired orphan reaches the Visites ledger''s live feed (#528)'
type: 'bugfix'
created: '2026-10-17'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '2bae2bd3f61b4c7c1b0fb45f6cc161dca61deb81'
context:
  - '{project-root}/docs/glossary.md'
  - '{project-root}/docs/api.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `POST /api/admin/visits/orphaned/:id/repair` inserts the visit with its original `received_at`, and the live feed's `since` cursor reads `received_at`, so an admin tab already holding the Visites ledger (or Dernières visites) never gets the repaired door-day; it shows only after a reseed. docs/api.md › The live feed promises every door-day touched since the cursor, each whole, and a repair touches one.

**Approach:** Give the feed a clock of its own: when the visit entered `visits`. Decided (owner, 2026-10-18, option a): a nullable `visits.repaired_at`, null on every synced visit, set to the repair's `now`; the feed reads `coalesce(repaired_at, received_at)` through one expression index, so sync, the seeds and test fixtures are untouched; `received_at` keeps meaning "when the phone's sync reached the server" and is never moved, so the clamp (INVARIANT 12), the export, the recap and the retention sweep are untouched.

## Boundaries & Constraints

**Always:** `visits` stays insert-only; the new value is written at insert, never updated. `from`/`to` stay on `received_at` (same column as the export, docs/api.md). Door-days still arrive whole; the tie-group and `newest` guards follow the feed clock. One migration from `pnpm db:generate` (d1-migration skill), no backfill (disposable stage). Docs updated in the same change: docs/api.md (endpoint row + The live feed + the `since` paragraph), docs/data-model.md.

**Never:** No change to `received_at`, `visited_at` or the clamp. No change to the sync request/response, no `CLIENT_VERSION` bump (the admin wire is not the sync contract). No client-side reseed-after-repair. The ledger's « Reçue » time stays `receivedAt`. No dedupe/merge, export, recap or retention change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Repair, ledger open | tab holds cursor C; orphan received before C is repaired at R > C | next poll returns that door-day, whole, sorted to the top and marked arrived | none |
| Repair joins a held door-day | the door-day already holds a visit; the repaired visit is older on both clocks | row replaced under the same `key`, now with both visits; its « Reçue » is unchanged | none |
| Plain sync | visit synced, never quarantined | feed clock equals `received_at`; feed behaves exactly as today | none |
| Old orphan, scoped window | `received_at` before the window's `from`, repaired today | not listed in that window, same as a reseed would show | none |
| Repair replayed | second repair of the same id | `repaired: false`, nothing written, feed clock unchanged | none |

</frozen-after-approval>

## Code Map

- `src/worker/db/schema.ts:113-160` -- `visits`; add the column and an index the feed's clock can use. Keep `visits_received_idx` (export, recap, retention read it).
- `src/worker/door-days.ts:164-320` -- `doorDaysTouched`: `since` filter, both orderings, tie-group check and query, `newest`, the step-3 `received_at <= newest` guard and the final sort all move to the feed clock; `from`/`to` and `reason` stay. Define the clock once as a `sql` fragment beside `LATEST_VISIT_FIRST`. `LATEST_VISIT_FIRST` keeps `received_at` (latest-visit rule unchanged).
- `src/worker/routes/admin.ts:1567-1597` -- the feed route's doc comment (cursor no longer "greatest `receivedAt`"). `:1840-1868` -- repair insert writes the feed clock as `now`; `received_at` stays `held.receivedAt`.
- `src/shared/schemas.ts:845-880` -- `adminDoorDaySchema`: add a top-level `listedAt` (greatest feed clock of the door-day's visits). Not per visit. This module is precached on the field (ADR-0026): one line only.
- `src/client/admin/visits/feed.ts` -- `mergeDoorDays` sort, `nextSince`, `arrivedKeys` read `listedAt`.
- `src/client/admin/queries.ts:595-611` -- window trim stays on `receivedAt`; comments that call the cursor `receivedAt` updated.
- Tests: `src/worker/door-days.test.ts`, `src/worker/admin.test.ts` (repair block), `src/client/admin/visits/feed.test.ts`; client fixtures building `AdminDoorDay` need `listedAt` (`grep -rln "dayStart" src/client`).

## Tasks & Acceptance

**Execution:**
- [ ] `src/worker/db/schema.ts` + `drizzle/` -- add the column and index, `pnpm db:generate` -- the feed needs a clock a repair can stamp.
- [ ] `src/worker/door-days.ts` -- read and page on the feed clock, emit `listedAt` -- the cursor must see a repair.
- [ ] `src/worker/routes/admin.ts` -- repair stamps `now`; route comment -- the one writer of a non-sync arrival.
- [ ] `src/shared/schemas.ts` -- `listedAt` on `adminDoorDaySchema` -- the client pages on it.
- [ ] `src/client/admin/visits/feed.ts`, `queries.ts`, fixtures -- cursor, sort and arrival on `listedAt`.
- [ ] Tests -- every I/O matrix row, worker and client side.
- [ ] `docs/api.md`, `docs/data-model.md` -- the feed's clock and the new column.

**Acceptance Criteria:**
- Given a feed polled to cursor C, when an orphan received before C is repaired, then the next `GET /api/admin/visits?since=C` returns its door-day whole and the cursor advances past the repair.
- Given only synced visits, when the feed is seeded and polled, then every answer matches today's (feed clock = `received_at`).
- Given the change, then `pnpm typecheck`, `pnpm test`, `pnpm lint` and `pnpm build` pass, and the PR quotes the field precache total against 1,000 KiB.

## Implementation Notes

- Migration `drizzle/0019_powerful_metal_master.sql` hand-corrected before it reached `main`: drizzle-kit split the expression index at its comma. Snapshot untouched.
- Repair tests live in `src/worker/orphans.test.ts`, not `admin.test.ts`. The repair test now back-dates the orphan's `received_at` a minute, so the repair's clock is past the cursor even when both land in one millisecond.
- `admin.test.ts` pins that a delta poll's touched read uses `visits_listed_idx` (EXPLAIN QUERY PLAN), so SQLite matches the qualified query expression to the index.
- Stale comments fixed: `visits.receivedAt` no longer claims the feed orders by it; the tie-group comment names the feed clock.

## Spec Change Log

## Review Triage Log

Pass 1 (blind-hunter, edge-case-hunter, verification-gap, intent-alignment): high 0, medium 0, low 4, false 9, maybe-false 0.

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| VG: seed path (`since` 0) order on the feed clock untested | low | patch | Added `seeds the newest page on the feed clock…` (limit 1, repaired row wins, `truncated`). |
| EC: EXPLAIN test silently checks `""` if no query matches | low | patch | Asserts exactly one touched read before EXPLAIN. |
| BH: "one repair stamps one `repaired_at`" misleads in api.md | low | patch | Parenthetical removed. |
| EC: repair's `now` taken before its awaits; a sync committing in between can lift a cursor past it | low | defer | Real, but the same race exists for every sync (`now` taken before its inserts); narrowing one writer does not close it. |
| EC/BH: retention sweep reads old `received_at` on a repaired visit | false | reject | Intent keeps retention untouched; before the change a repair kept the same `received_at`, so nothing moved. |
| EC: a listed door-day can carry a visit outside `[from, to]` | false | reject | Pre-existing and documented: a door-day arrives whole, "those outside the bounds included". |
| EC: seed order lacks an id tie-break | false | reject | Seed is one read, not paged; the old `desc(received_at)` had none either. |
| EC: queries.ts task unmet | false | reject | Spec keeps the trim on `receivedAt`; no comment there names the cursor's column. |
| BH: `listedAt` missing from the endpoint row | false | reject | The diff adds it to the row description in docs/api.md. |
| BH: tie-group test would pass on the old logic | false | reject | Old `received_at > T` keeps one visit, so `toHaveLength(3)` fails on it; the key map dedupes the cut row. |
| BH: index write cost, migration name, ADR note, fixtures style | false | reject | One extra index entry per visit (two agents) is negligible; migration names are generated; no ADR (ADR-0024: nullable column, disposable stage), stated in the PR. |
| IA: no hook test across two polls | false | reject | The hook is unchanged; the cursor, sort and arrival it calls are the pure helpers, which are tested. |
| IA: scoped-window trim on `receivedAt` | false | reject | Intended: `from`/`to` stay on `received_at`, pinned by the scoped-window test. |

## Design Notes

The cursor and the « Reçue » column now differ on a repaired row by design: « Reçue » answers "when did the phone send it", the cursor "when could the ledger first list it". `const LISTED_AT = sql\`coalesce(${visits.repairedAt}, ${visits.receivedAt})\``, with the index declared on the same expression so SQLite can use it (it matches indexes on expressions textually).

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: all green.
- `pnpm db:migrate:local` -- expected: the new migration applies.
