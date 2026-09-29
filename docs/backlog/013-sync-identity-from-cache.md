---
id: 013
status: done
implements: docs/domains/identity-access.md#offline-and-session-expiry, docs/security.md#threat-model "Agent reading other agents' data"
depends_on: [005]
---

# Do not stamp or sync under a cached identity the Access cookie may not match

## Goal

`runSync` and the outbox stamp (`writtenBy`, backlog 005) use an identity that
is known to match the Access session the next request will carry, never one
read from the offline cache alone.

## Why

Found by the security review of backlog 005. `SyncProvider` receives
`me.email`, and `resolveIdentity` (`src/client/field/identity.ts`) falls back to
the cached identity on any `/api/me` failure other than a 401. So if agent B
signs in through Access on agent A's phone and that launch's `/api/me` hits a
network blip or a 5xx, the shell runs as A while the cookie is B's: the next
sync sends A's held rows under B's JWT (the Worker files them under B), and
B's new visits are stamped A. Backlog 005 closes the common case (a live
`/api/me` that names the new agent); this window stays open.

## Decision (owner, 2026-09-28)

**Option A: a cached identity is unconfirmed.** Client-only, no sync-contract
change, so no ADR (ADR-0024: nothing stored in D1, the wire contract, the stack
or a cost changes). Rejected: B (echoing the JWT email in the sync response
only detects the mistake after the rows were filed, and is a contract change)
and C (accepting the window).

The rule, which the identity-access doc takes on as its own:

- While the identity is cache-sourced (`identityFromCache` in `App.tsx`),
  `SyncProvider` sends nothing. Every trigger that would call `runSync` first
  re-asks `/api/me`; only a live answer lets that sync run, under the email the
  answer names.
- A row written while unconfirmed belongs to whoever holds the Access cookie,
  which the cache cannot name. It is written with `writtenBy` set to the cached
  email **and** `unconfirmed: true`. The first live `/api/me` re-stamps every
  such row (outbox and `sentVisits` log alike) with the live email and drops
  the flag, in one Dexie transaction, before the first sync runs.
- A 401 on that `/api/me` drops the flag and keeps the cached email, before
  `clearAgentCache` runs: an expired cookie cannot confirm anyone, so the rows
  stay with the identity the agent was shown and are held back from anyone
  else (the 005 behaviour).

Residual, to be written down in the doc: a phone that changes hands again
while still unconfirmed (offline from launch to launch) re-stamps both
sessions' rows to whoever confirms first.

## Acceptance criteria

- [x] `SyncProvider` (`src/client/field/useSync.tsx`) takes a `confirmed`
      prop, passed `!identityFromCache` from `App.tsx`. While it is false,
      `syncNow` does not call `runSync`; it calls a `recheckIdentity` callback
      from `App.tsx` that re-runs the identity effect (the existing `recheck`
      counter) instead. The four triggers (field-operations.md#triggers) are
      unchanged, so the 60 s heartbeat retries a failed `/api/me` — today a
      5xx with `navigator.onLine` true re-checks once and never again.
- [x] `SyncStatus` (`src/client/field/sync.ts`) gains `"unconfirmed"`, which
      `SyncProvider` reports while `confirmed` is false. The sync strip and dot
      name it with a new `copy.sync.unconfirmed` string, e.g. "Vérification de
      votre session. Vos visites sont conservées et partiront ensuite." —
      distinct from `offline`, since the network may be up.
      `nextDelayMs` backs off for it the way it does for `"error"`.
- [x] `OutboxStamp` (`src/client/field/outbox-stamp.ts`) gains
      `unconfirmed?: true`. `sendableBy` returns false for a row carrying it,
      whatever the identity. It is Dexie-only, like `writtenBy`: not indexed
      (so no Dexie version bump), stripped with `writtenBy` before the
      `SyncRequest` is built, and not added to `src/shared/schemas.ts`.
- [x] `queueVisit` (`src/client/field/db.ts`) and the `outboxProspects.add`
      call in `AddProspectScreen.tsx` write `unconfirmed: true` on the outbox
      row and the `sentVisits` row when the identity is cache-sourced (read
      from `useSyncState`, not a second prop chain).
- [x] A new `confirmOutbox(db, email)` in `db.ts` re-stamps every
      `unconfirmed` row in `outboxVisits`, `outboxProspects` and `sentVisits`
      to `email` and deletes the flag, in one `rw` transaction. `App.tsx`
      awaits it on a live `/api/me` whose outcome was reached from a
      cache-sourced session, before `setMe` / `setIdentityFromCache(false)`.
      On a 401 it is called with the cached email, before `clearAgentCache`.
      It never deletes a row (INVARIANT 5).
- [x] Tests in `sync.test.ts` / `db.test.ts` / `identity.test.ts` or a
      `useSync` DOM test, each asserting:
  - [x] Cache-sourced as A, `/api/me` failing with a 500: no `POST
        /api/agent/sync` is made; the next heartbeat re-asks `/api/me`.
  - [x] Cache-sourced as A, a visit queued, then `/api/me` answers B: the
        visit is re-stamped B and sent in B's first sync; A's rows queued
        before the launch stay held back (`heldBack` counts them).
  - [x] Cache-sourced as A, a visit queued, then `/api/me` answers A: the
        visit is sent, nothing is held back.
  - [x] Cache-sourced as A, a visit queued, then `/api/me` answers 401: the
        visit keeps `writtenBy: A` without the flag, and survives
        `clearAgentCache`.
  - [x] `sendableBy` returns false for an `unconfirmed` row for every identity.
  - [x] The POST body never carries `unconfirmed` or `writtenBy`.
- [x] Docs: `docs/domains/identity-access.md#offline-and-session-expiry` says
      a cache-sourced session is unconfirmed, syncs nothing and stamps
      provisionally until a live `/api/me`, and names the residual above;
      `docs/domains/field-operations.md` names the new sync state beside the
      others; the Status table in `docs/backlog/README.md` and this file
      marked `done`.
- [x] The field precache total is quoted against its 1,000 KiB ceiling in the
      PR (CLAUDE.md, ADR-0026).
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.

## Out of scope

- Any change to `POST /api/agent/sync` or `/api/me` — no `CLIENT_VERSION` bump.
- A UI for handing held-back rows to their owner (backlog 005's out of scope,
  still open).
- Narrowing `resolveIdentity`'s cache fallback to network failures only (a 5xx
  still falls back): it shrinks the window without closing it, and this task
  makes the fallback harmless instead.
- The admin gates (`adminAccess`): already keyed on `fromCache`.

## Notes

- `App.tsx`'s `recheck` effect (spec-gh-115) already re-asks `/api/me` on the
  cache-sourced → online transition; keep it, and let `recheckIdentity` bump
  the same counter so there is one fetch path.
- Single-flight: a `/api/me` re-check started by the heartbeat and one started
  by the `online` transition must not both run `confirmOutbox`; it is
  idempotent, but guard the fetch the way `syncNow` guards `runSync`.
- INVARIANT 2 is not touched: re-stamping is local outbox bookkeeping, never a
  write to shared data.
