---
title: 'Backlog 013: no sync or final stamp under an unconfirmed cached identity'
type: 'bugfix'
created: '2026-09-28'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '097fd025988b58acc876429f5a2ee6e1f53a4705'
context:
  - '{project-root}/docs/backlog/013-sync-identity-from-cache.md'
  - '{project-root}/docs/domains/identity-access.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When `/api/me` fails with anything but a 401, the shell runs on the cached identity while the Access cookie may be another agent's; `runSync` then files the cached agent's rows under the cookie's agent, and new visits get stamped with the wrong agent.

**Approach:** Option A (owner, PR #221). A cache-sourced identity is *unconfirmed*: `SyncProvider` sends nothing and re-asks `/api/me` on each trigger instead, and rows written meanwhile carry `unconfirmed: true`. The first live `/api/me` re-stamps them to the live email in one Dexie transaction before any sync; a 401 drops the flag and keeps the cached email. The backlog file's acceptance criteria are the contract.

## Boundaries & Constraints

**Always:** INVARIANT 5: no code path added here deletes an outbox row. `unconfirmed` is Dexie-only like `writtenBy`: not indexed (no Dexie version bump), stripped before the `SyncRequest`, never in `src/shared/schemas.ts`. French strings live in `copy/field.ts`. One `/api/me` fetch path (the `recheck` counter), single-flight.

**Never:** No change to `/api/agent/sync`, `/api/me`, or `CLIENT_VERSION`. Do not narrow `resolveIdentity`'s cache fallback. No held-back hand-over UI. Do not touch `adminAccess`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Unconfirmed, `/api/me` 500 | cache-sourced as A | no `POST /api/agent/sync`; status `unconfirmed`; next heartbeat (backed off) re-asks `/api/me` | nothing sent |
| Confirmed as other agent | A cached; visit queued unconfirmed; `/api/me` → B | visit re-stamped B, flag gone, sent in B's first sync; A's earlier rows `heldBack` | — |
| Confirmed as same agent | A cached; visit queued; `/api/me` → A | visit sent, `heldBack` 0 | — |
| Revoked | A cached; visit queued; `/api/me` → 401 | row keeps `writtenBy: A`, no flag, survives `clearAgentCache` | error frame as today |
| Stamp predicate | row with `unconfirmed: true` | `sendableBy(x)` false for every `x` | — |
| Wire | any outbox row | POST body has neither `unconfirmed` nor `writtenBy` | — |

</frozen-after-approval>

## Code Map

- `src/client/field/outbox-stamp.ts` -- `OutboxStamp`, `sendableBy`. Add `unconfirmed?: true`; add a display predicate (below).
- `src/client/field/db.ts` -- `queueVisit(db, visit, identity)` (L180), `SentVisit` type, `outboxCounts`, `clearAgentCache`. Add `confirmOutbox`.
- `src/client/field/sync.ts` -- `SyncStatus` union; `unstamped()` (L101) strips the stamp.
- `src/client/field/sync-schedule.ts` -- `nextDelayMs` already backs off for any non-`ok`; `unconfirmed` just needs to be a status.
- `src/client/field/useSync.tsx` -- `SyncProvider({identity})`, `syncNow` single-flight, four triggers, heartbeat effect deps `[status, running, syncNow]`.
- `src/client/App.tsx` -- identity effect keyed on `recheck` (L~290), `settle()`, the cache→online re-check effect (L~346), `<SyncProvider identity={me.email}>`.
- `src/client/field/VisitScreen.tsx:326`, `AddProspectScreen.tsx:92` -- the two outbox writers; read identity from `useSyncState`.
- `src/client/field/progress.ts` -- `dailyProgress` uses `sendableBy` for "mine".
- `src/client/field/sync-view.ts` -- `syncView` branches per status; `SyncIndicator.tsx` `forcedView` table lists the states.
- `src/client/copy/field.ts` `sync` block -- add `unconfirmed`.
- Tests: `db.test.ts`, `sync.test.ts` (fetch injected), `sync-view.test.ts`, `App.test.tsx` (mocks `./field/useSync`; real `fieldDb` on fake IndexedDB), new `useSync.test.tsx`.
- Docs: `docs/domains/identity-access.md#offline-and-session-expiry`, `docs/domains/field-operations.md` (local store + sync states), `docs/design.md` ("seven states" → eight), `docs/backlog/README.md` status table, the backlog file.

## Tasks & Acceptance

**Execution:**
- [x] `outbox-stamp.ts` -- `unconfirmed?: true` on `OutboxStamp`; `sendableBy` returns false for it; add `countsFor(identity)` = `row.unconfirmed === true || sendableBy(identity)(row)` for *display* -- an offline launch is always unconfirmed, so its own visits must still show as pending and in today's progress, not as held back.
- [x] `db.ts` -- `SentVisit` gains `unconfirmed?: true`; `queueVisit` takes a stamp `{ writtenBy: string; unconfirmed?: true }` for both rows; `outboxCounts` counts pending with `countsFor`; add `confirmOutbox(db, email?)`: one `rw` transaction over `outboxVisits`, `outboxProspects`, `sentVisits`, `modify` every `unconfirmed` row to `writtenBy = email ?? row.writtenBy` and delete the flag. Never deletes.
- [x] `sync.ts` -- add `"unconfirmed"` to `SyncStatus` (never returned by `runSync`); `unstamped` strips `unconfirmed` too.
- [x] `progress.ts` -- use `countsFor`.
- [x] `useSync.tsx` -- props `confirmed: boolean`, `recheckIdentity: () => void`; expose `stamp` on `SyncState`. While `!confirmed`: `syncNow` calls `recheckIdentity()` instead of `runSync`, bumps the failure count and a tick state in the heartbeat deps so the timer reschedules on backoff; reported `status` is `"unconfirmed"`. `confirmed` in `syncNow`'s deps so confirmation triggers an immediate sync.
- [x] `App.tsx` -- a `checking` ref guards the identity fetch (set on start, cleared on settle unless cancelled, cleared in cleanup); `recheckIdentity` and the online re-check bump `recheck` only when not checking. In `settle`: live `ready` → `await confirmOutbox(fieldDb, email)` before `clearAgentCache`/`setMe`/`setIdentityFromCache(false)`; `revoked` → `await confirmOutbox(fieldDb)` before `clearAgentCache`. Pass `confirmed={!identityFromCache}` and `recheckIdentity`.
- [x] `VisitScreen.tsx`, `AddProspectScreen.tsx` -- write `stamp` from `useSyncState`.
- [x] `copy/field.ts`, `sync-view.ts`, `SyncIndicator.tsx` -- `copy.sync.unconfirmed` ("Vérification de votre session. Vos visites sont conservées et partiront ensuite."); `syncView` gives it a secondary, polite strip with no action and a `warn` dot; add `unconfirmed` to `forcedView`.
- [x] Tests -- the six matrix rows plus: `confirmOutbox` covers all three tables and deletes nothing; `countsFor`/`outboxCounts` count an unconfirmed row as pending; `syncView` for `unconfirmed`; `App.test` passes `confirmed` false/true and re-stamps on a live re-check.
- [x] Docs -- as listed in the Code Map; the identity-access text names the residual (a phone changing hands again while still unconfirmed re-stamps both sessions' rows to whoever confirms first). Backlog file and README status `done`.

**Acceptance Criteria:**
- Given a cache-sourced session, when any sync trigger fires, then `/api/me` is re-asked (at most one in flight) and no sync request leaves the phone.
- Given unconfirmed rows persisted from an earlier launch, when any launch gets a live `/api/me`, then they are confirmed to that email before its first sync.
- Given the change, when `pnpm lint && pnpm typecheck && pnpm test && pnpm build` run, then all pass, and the PR quotes the field precache total against 1,000 KiB.

## Implementation Notes

- Implemented by a `pwa-engineer` subagent. The orchestrator then added the matrix tests the first pass lacked: the `runSync` describe for unconfirmed rows in `sync.test.ts`, and the heartbeat re-ask in `useSync.test.tsx`. It also memoized `stamp`.
- `queueVisit(db, visit, stamp: WriteStamp)` replaces the bare identity argument. `VisitScreen` is its only caller.
- Review pass 1 patches: the implementer applied most of them before it hit a rate limit. The orchestrator finished the `VisitScreen.test.tsx` and `progress.test.ts` cases and the `db.ts` formatting.
- `syncNow` now runs `confirmOutbox(fieldDb, identity)` before its first confirmed `runSync`. This supersedes the Design Note that accepted a race row waiting for the next launch.
- Verification after the patches: lint, typecheck, 82 files / 1962 tests and build all green. Precache is 25 entries, 925.62 KiB, against the 1,000 KiB ceiling.

## Spec Change Log

## Review Triage Log

### Pass 1 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment)

Counts: high 0, medium 7, low 8, false 3, maybe-false 0. No intent_gap or bad_spec; 13 patch, 0 defer, 5 rejected.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | blind, edge | Visit saved between `confirmOutbox` commit and the re-render stays unconfirmed all session | medium | patch | Nothing re-asks `/api/me` once confirmed; `syncNow` now confirms to `identity` before its first `runSync` (supersedes the Design Note's "waits for next launch") |
| 2 | blind | Offline-from-launch rows go to whichever agent confirms next; docs say "never sent under the wrong name" | medium | patch | The owner-accepted residual, but understated in both domain docs; wording fixed |
| 3 | blind | Stale (cancelled) answer still writes Dexie | false | reject | `checking` forbids a second fetch in flight; a cancelled run is StrictMode/unmount with the same cookie's answer, and `confirmOutbox` is idempotent |
| 4 | blind, edge | `confirmOutbox` throw: live answer falls into cache fallback; on 401 `clearAgentCache` skipped | medium | patch | try/finally on revoke; catch-and-continue on live |
| 5 | blind, verif | App tests ignore `confirmed`/`recheckIdentity` wiring | medium | patch | Mock records props; assertions added |
| 6 | blind, verif | App re-stamp test uses same email cached and live | medium | patch | A→B App case added |
| 7 | blind | `inFlight` comment claims single-flight of re-checks | low | patch | Comment corrected; `checking` in App.tsx does it |
| 8 | blind | Burst of `/api/me` on a failing Worker | false | reject | Both same-commit `setRecheck` bumps batch into one effect run: 2 calls total, as before this change |
| 9 | blind, edge | Unconfirmed failure count carries into confirmed session | low | patch | Reset on confirmation |
| 10 | blind | Boxes ticked with no precache evidence | low | patch | Implementation Notes record the numbers; PR quotes them |
| 11 | blind | `"unconfirmed"` lives in `SyncStatus`, which `runSync` never returns | low | reject | The backlog AC prescribes `SyncStatus` gaining it; a second type adds surface for no named failure |
| 12 | blind | Stamp type spelled three times | low | patch | `WriteStamp` exported from `outbox-stamp.ts` |
| 13 | blind | `key-f8-sync.html` mockup has no eighth state | low | reject | Planning mockup, not code; `design.md` table carries the state |
| 14 | edge | Identity-switch clear drops the re-stamped `sentVisits` rows; App comment claims otherwise | low | patch (comment only) | Loss already accepted in Design Notes; a `clearAgentCache` exception is more than a direct fix for a rare switch |
| 15 | edge | `checking` stuck if `settle` hangs | false | reject | Only a hung IndexedDB call does this, and that already blocks the shell today; a timeout adds state for an undemonstrated case |
| 16 | verif | Heartbeat test passes with a single reschedule | medium | patch | Asserts ≥ 2 re-checks after start |
| 17 | verif | Writer tests never set `unconfirmed` | medium | patch | One case each in AddProspect/Visit screen tests |
| 18 | verif | `dailyProgress` has no unconfirmed case | low | patch | Case added to `progress.test.ts` |
| 19 | intent | Tests stop at SyncProvider/runSync boundaries; broad R3 reading; R4 display rule | — | covered | Descriptive; boundary gaps covered by #5/#6; R3 matches the backlog's residual; R4 is the spec's `countsFor` |

## Design Notes

- **`confirmOutbox` on every live answer**, not only on a cache→live transition inside one run: a phone closed while unconfirmed leaves flagged rows that `sendableBy` never sends, so the next launch's live `/api/me` must confirm them. This is exactly the residual the backlog accepts. It also bounds a race: a visit saved between the Dexie commit and the re-render is stamped unconfirmed, and waits for the next live `/api/me` rather than being lost.
- **Identity switch:** `clearAgentCache` still clears `sentVisits` after `confirmOutbox`, so B's re-stamped log rows go too; today's progress then counts them only while they are in the outbox. Accepted as-is (log only, not data).
- **Reported status is derived** (`confirmed ? status : "unconfirmed"`), never stored, so confirmation shows the last real status at once instead of a stale strip.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: all green
- `pnpm build` output -- expected: field precache total quoted, under 1,000 KiB
