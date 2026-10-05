---
title: 'The phone sends its last reading at sync'
type: 'feature'
created: '2026-10-05'
status: 'done'
baseline_commit: 'f3dc0fd92f3eef4a38baab09ec7d07936f201c1c'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context:
  - '{project-root}/docs/adr/0028-agent-position-at-sync.md'
  - '{project-root}/_bmad-output/initiative-dashboard-redesign/epic-admin-round-view/story-the-phone-sends-its-last-reading-at-sync.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The server now stores an optional `position` per agent (story #265), but the phone never sends one: `useAgentPosition` forgets each reading, so the admin round view would always fall back to name order. Story #266.

**Approach:** The phone side of ADR-0028. The hook keeps its latest successful reading in module memory, stamped with the confirmed identity; `runSync` adds it as `position` when it qualifies. Sync never calls geolocation.

## Boundaries & Constraints

**Always:**
- ADR-0028 › On the phone is the rule; cite it, don't restate it. Reading = `{lat, lng, accuracy: coords.accuracy, capturedAt: GeolocationPosition.timestamp}` — the fix's own time, never the time the hook resolved.
- Memory only: not React state, Dexie or localStorage. A reload forgets it.
- Stamped with the identity active at capture. A reading is stamped only when that identity is confirmed (`confirmed` true on `SyncProvider`); under a cache-sourced identity it is not kept.
- `runSync` sends it only when the stamp equals the identity it syncs as, `capturedAt` ≥ today's Brussels midnight (`brusselsPeriod(now, 1).from`, `src/shared/period.ts`), and it passes `agentPositionSchema`. Otherwise the body has no `position` key.
- An identity change, `SyncProvider` unmount, and `clearAgentCache` each drop it. A reading with an older `capturedAt` never replaces a newer one of the same stamp.
- Sync, and the new module, never call `navigator.geolocation` and never ask for permission. `getCurrentPosition` stays the only call, in the hook (no `watchPosition`).
- Additive wire change: no `clientVersion` bump (INVARIANT 9). Outbox rules untouched (INVARIANT 5). Position is never logged.
- Report the field precache total against 1,000 KiB (ADR-0026) in the PR.

**Never:**
- No server, schema or admin change. No second place that holds a reading (no Dexie field, no context value, no localStorage).
- Do not change what any screen shows or when the hook reads: no new reading, no new permission prompt.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Today's reading | confirmed `a@`, reading taken today under `a@` | body carries `position` | — |
| No reading | nothing recorded | no `position` key | — |
| Yesterday | `capturedAt` before today's Brussels midnight | no `position` key | — |
| Other identity | stamped `a@`, sync runs as `b@` | no `position` key | — |
| Cache-sourced | reading taken while `confirmed` false | not kept; no `position` key | — |
| Invalid | `accuracy` > cap or lat 200 | no `position` key | left out, sync proceeds |
| Cleared | `clearAgentCache` after a reading | no `position` key | — |
| Older fix | stored 10:00, hook delivers 09:55 | stored one kept | — |
| Fix time | hook reading with timestamp T | `capturedAt` = T | — |
| Sync alone | `runSync` runs | `getCurrentPosition` and `watchPosition` uncalled | — |

</frozen-after-approval>

## Code Map

- `src/client/field/useAgentPosition.ts:49-58` -- success callback: add `rememberReading({lat, lng, accuracy: pos.coords.accuracy, capturedAt: pos.timestamp})` before the `cancelled` check (the fix was taken either way). Header comment (:1-9) still says "check-in only": rewrite per ADR-0028.
- `src/client/field/last-reading.ts` (new) -- module state `{identity, last}`; `setReadingIdentity(identity | null)`, `rememberReading`, `dropReading`, `readingToSend(identity, now)`. Pure of the DOM; imports `agentPositionSchema` and `brusselsPeriod` from `src/shared`.
- `src/client/field/sync.ts:106-120` -- `runSync` builds the body; add `position: readingToSend(identity, now())`. `SyncDeps` gains optional `now?: () => number` (file header says the clock is injected). `serializeWithinCap` spreads the payload, so the key survives; `undefined` is omitted by `JSON.stringify`.
- `src/client/field/useSync.tsx:89` -- `SyncProvider`: effect `setReadingIdentity(confirmed ? identity : null)`, cleanup sets `null`.
- `src/client/field/db.ts:275` -- `clearAgentCache`: also `dropReading()` (called on revoked, identity switch and a 401/403 sync).
- `src/shared/schemas.ts:417` -- `agentPositionSchema` (accuracy 0..10,000 m); reuse, don't copy. `src/shared/period.ts:80` -- `brusselsPeriod`.
- Tests: `src/client/field/sync.test.ts` (injected `fetchFn`, fake Dexie), `useAgentPosition.test.tsx`, `useSync.test.tsx` (real provider), `db.test.ts`. `test/geolocation.ts` and `test/setup-dom.ts` fake geolocation: they answer `timestamp: Date.now()` and no `accuracy`; extend `GeolocationFix` with optional `accuracy` and `timestamp`.
- `docs/design.md:1304` -- Carte note "`useAgentPosition` has no shared state". Keep: each screen still takes its own reading; add that the latest is kept in module memory for sync only (ADR-0028). Other docs already describe this side (ticket note); touch them only if the code departs.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/field/last-reading.ts` -- the module above -- the one home of the keep-and-qualify rule
- [x] `src/client/field/useAgentPosition.ts` -- record each success; fix the header comment -- ADR-0028 follow-up
- [x] `src/client/field/sync.ts` -- attach `position`; `now` dep -- the only sender
- [x] `src/client/field/useSync.tsx`, `src/client/field/db.ts` -- stamp identity, drop on change/unmount/clear
- [x] `test/geolocation.ts`, `test/setup-dom.ts` -- optional `accuracy` and `timestamp` on the fake fix
- [x] `src/client/field/last-reading.test.ts`, `sync.test.ts`, `useAgentPosition.test.tsx`, `useSync.test.tsx`, `db.test.ts` -- every row of the matrix
- [x] `docs/design.md` -- Carte "no shared state" note

**Acceptance Criteria:**
- Given the branch, when the `security-reviewer` subagent reviews the diff, then its verdict is approved (or its changes are applied) and is recorded in Implementation Notes for the PR.
- Given `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm check:precache`, then all pass and the precache total is quoted against 1,000 KiB.

## Implementation Notes

- Implemented inline (no coding subagent): `last-reading.ts` plus the hook, `runSync`, `SyncProvider` and `clearAgentCache` hooks, with tests for every matrix row. Precache total **933.21 KiB of 1,000 KiB** (`pnpm check:precache`).
- **security-reviewer verdict (2026-10-06): APPROVED.** No high or medium findings. Two lows: the stamp is read when the fix lands, not when it was requested (rejected, row 1); `docs/security.md:37` still says "once epic 5's phone side ships" (rejected, row 9). Link this verdict in the PR.
- Found in passing: nothing out of scope.

## Spec Change Log

## Review Triage Log

Pass 1 (2026-10-06): high 0, medium 1, low 8, false 3, maybe-false 0. No intent_gap or bad_spec; 3 patches applied inline, none deferred. Lenses: blind-hunter, edge-case-hunter, verification-gap (no gaps), intent-alignment, plus the security-reviewer.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | blind, edge, security | Stamp is read when the fix lands, not when it was requested | low | reject | Needs an in-page switch within the 10 s timeout, and the device is the same one; a fix to it adds a getter and a parameter |
| 2 | blind, edge | A newer fix failing the wire schema (accuracy > 10 km) displaced a good one, leaving nothing to send | medium | patch | `rememberReading` validates first; test keeps the good one across three bad fixes |
| 3 | intent | No test chains hook, provider and `runSync` | low | patch | `SyncProvider — hook to wire` test: a mounted screen's fix reaches the fetch body |
| 4 | blind | `dropReading` comment names a sign-out nothing calls | low | patch | Comment names `setReadingIdentity(null)` |
| 5 | blind | A fix taken before confirmation is lost | false | reject | ADR-0028 requires it: never a cache-sourced identity |
| 6 | edge | A future-dated `capturedAt` shadows later fixes | low | reject | ADR-0028 prescribes the raw comparison; the OS stamps the fix |
| 7 | edge | A fix resolving after `clearAgentCache` is kept | low | reject | Same window as row 1; the same identity took it |
| 8 | edge | The provider cleanup nulls the identity on any dependency change | false | reject | Dependencies change only on a real switch or confirmation flip, which must drop it |
| 9 | security | `docs/security.md:37` is conditional on a release that has now landed | low | reject | Ticket note: docs change only if the code departs; the release checklist owns that wording |
| 10 | blind | Inject a `getReading` dependency instead of a module singleton | false | reject | The spec chose the module (Design Notes); hooks have no provider |
| 11 | edge | `useAgentPosition` outside `SyncProvider` is silently discarded | false | reject | Every caller is under `SyncProvider` in `App.tsx` |
| 12 | blind | No test that position is never logged; lat 200 only unit-tested | low | reject | There is no `console.*` in `src/client`; the schema path is shared |

## Design Notes

- **Why a module, not the hook's context:** `useRound`, Ajouter and the visit form each call `useAgentPosition()` with no provider, and several tests mock `useSync`. `SyncProvider` owns identity and `confirmed`, so it tells the module (`setReadingIdentity`); the hook records into it. A reading stamped `null` is never stored.
- **Stamp at capture:** `rememberReading` reads the module's current identity. `setReadingIdentity(next)` drops a reading whose stamp differs, so a switch never leaves a reading another agent could send.
- **Clock:** the client checks `capturedAt` against Brussels midnight only; the server clamps to receipt (ADR-0028).

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:precache` -- expected: all green; read the precache total off the build.
