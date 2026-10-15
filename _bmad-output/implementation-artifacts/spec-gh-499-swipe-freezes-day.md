---
title: 'A swipe freezes the day on the phone and the server (story 1.3, #499)'
type: 'feature'
created: '2026-10-15'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '0878b4b459f013c16caeaa73e897b5fe13fb7c81'
context:
  - '{project-root}/docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md'
  - '{project-root}/.claude/skills/sync-contract-change/SKILL.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-496-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The server can store and return a tournée (story 1.2), but the phone has no gate, no swipe and no tournée outbox, so nothing ever freezes the day and a second phone cannot pick it up.

**Approach:** Tracer bullet built to `docs/design.md` › Before the swipe. A gate on every `/tournee/*` route shows a no-tournée message, the start screen with the swipe, or the app. The swipe numbers the R1 snapshot nearest-next from the reading through one shared pure function and writes the tournée and its stops to new Dexie outbox tables. `runSync` sends them, rewrites stop prospect ids through `idMap`, and stores the pulled tournée, stops and visited stops in Dexie tables this story owns. The sync contract does not change.

## Boundaries & Constraints

**Always:** Inserts only, client UUIDs, outbox rows deleted only when listed in `accepted` (invariants 2, 4, 5). Outbox rows stamped `writtenBy` / `unconfirmed` like visits, sent only through `sendableBy`. A stop is sent only with its tournée or after that tournée left the outbox. The swipe reading is an ordinary `useAgentPosition` reading; no position on any tournée row. Sync is never gated: band, sync dot and strip stay on every gate screen. French strings in `copy/field.ts`, verbatim from design.md. Swipe is one real `<button>` (Enter, Space, `detail === 0` click start it; a pointer tap only nudges). Field controls stay native (ADR-0015). Dexie schema bump adds tables only. Precache under 1,000 KiB.

**Never:** The location dialog or an accuracy threshold (entry 4). Numbers on Tournée, Carte or the card, « Plus tard » changes (entry 5). Joiners or `left` handling (entry 6). The counter or removing `sentVisits` (entry 7). Carnet (entry 8). Midnight timers (entry 9). Any server, schema or contract change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Never loaded | no `lastSyncAt` in meta | « Tournée pas encore chargée » message, no tabs |
| Nothing assigned | pulled once, snapshot empty, no tournée today | « Aucune tournée aujourd'hui », no tabs |
| Start screen | snapshot of 20, no tournée today | date, « 20 arrêts », first 7 by name, « et 13 autres arrêts », swipe |
| No position yet | reading outstanding or refused | swipe `aria-disabled`, « En attente de votre position »; refused shows « Réessayer » |
| Swipe / keyboard | position set, full drag past ¾ or Enter | 1 tournée + 20 stops numbered 1–20 nearest-next in the outbox, app opens at Tournée |
| Short drag / tap | released before ¾ | snaps back, nothing written |
| Write fails | Dexie rejects | thumb back, storage error under the track |
| Snapshot rule | follow-up due tomorrow; one due 16:00 today; outbox field prospect | tomorrow's excluded; today's and the field prospect included |
| Already swiped | outbox tournée today, or pulled tournée with today's `dayStart` | app, no start screen |
| Second phone / reinstall | pull returns today's tournée | stored in Dexie, app opens without the start screen |
| Losing phone | own tournée accepted but not stored, pull returns the other | outbox drained, pulled tournée used |
| Field prospect deduped | `idMap` maps the stop's client prospect id | outbox stop rewritten before resend |
| Big snapshot | 300 stops | drains over passes, tournée first |
| Other agent's rows | outbox tournée written by another identity | not sent, not used for this agent's gate |

</frozen-after-approval>

## Code Map

- `src/shared/tournee.ts` -- add `snapshotProspects(prospects, outboxProspects, now)`: R1 (open status; `follow_up` only with `nextVisitAt` null or before tomorrow's Brussels midnight via `brusselsMidnightDaysFromNow`; outbox field prospects, deduped by id). Add `numberStops(items, from, firstNumber = 1)`: `orderByNearestNext` (`src/shared/geo.ts:53`, unlocated last), numbered from `firstNumber`. Entry 6 reuses `numberStops`.
- `src/client/field/swipe.ts` -- add track-relative pure maths: thumb offset clamped to `[0, travel]`, commit at ≥ ¾ travel. Reuse `lockAxis`/`SWIPE_SLOP`, leave `SWIPE_COMMIT` alone.
- `src/client/field/db.ts` -- Dexie v5 adds `outboxTournees: "id"`, `outboxStops: "id, tourneeId, prospectId"`, `tournees: "id"` (pulled), `tourneeStops: "id, tourneeId"` (pulled), `visitedStops: "prospectId"`. `startTournee(db, {tournee, stops}, identity, unconfirmed)` writes both outbox tables in one transaction. `outboxCounts` counts each outbox tournée as one row plus stops whose tournée is no longer in the outbox (the swipe reads as one element). `clearAgentCache` clears the three pulled tables, not the outbox. `confirmOutbox`/`releaseUnconfirmed` cover both new outbox tables.
- `src/client/field/sync.ts:177-185,215-255` -- send `outboxTournees` (sendable, ≤ `SYNC_TOURNEES_PER_REQUEST`) and `outboxStops` (sendable, tournée in this request or not in the outbox, ≤ `SYNC_STOPS_PER_REQUEST`); rewrite `outboxStops.prospectId` through `idMap`; bulk-delete accepted; replace the pulled tables wholesale from `tournee`/`visitedStops`. `SyncResult` gains accepted tournée/stop counts.
- `src/client/field/sync-schedule.ts:26` -- `shouldDrain` also continues when tournées or stops were accepted.
- `src/client/field/tournee-gate.ts` (new, pure) + `useTourneeGate.ts` (new) -- decide `loading | neverLoaded | nothingAssigned | start(snapshot) | open` from meta `lastSyncAt`, the pulled tournée, this identity's outbox tournées (Brussels day of `startedAt`) and the snapshot. "Today" from `useRound`'s pattern (`lastSyncAt ?? openedAt`); entry 9 owns midnight.
- `src/client/field/StartScreen.tsx`, `StartSwipe.tsx`, `NoTourneeMessage.tsx` (new) -- design.md › Before the swipe. The swipe uses `useAgentPosition` for the point; on commit `numberStops`, `startTournee`, `syncNow()`, `navigate("/tournee", { replace: true })`; ignores input while writing. Empty-state shape like `FieldEmptyState` (`App.tsx:255`). Admin with `adminOnline`: `secondary` « Tableau de bord » link (`copy.nav.tabs.dashboard`).
- `src/client/App.tsx:72-110,118-185` -- gate wraps `FieldRoutes`; `FieldFrame` hides `FieldTabs` unless the gate is open; the start screen's fixed track is cleared with an `app.css` utility beside `.pb-tab-bar` (`:464`).
- `src/client/copy/field.ts` -- `start` block: messages, overline date, explainer, « et {n} autres arrêts » / « et 1 autre arrêt », swipe label, button name, waiting, « Démarrage… », storage error. Reuse `today.remaining`, `today.meta`, `today.retryPosition`.
- Tests beside each new module; extend `db.test.ts`, `sync.test.ts`, `sync-schedule.test.ts`, `App.test.tsx`.
- Docs: `docs/domains/field-operations.md` › Today list (gate and snapshot), Local store table, Protocol (phone send order). `src/client/field/useAgentPosition.ts:10` comment stays for entry 4.

## Tasks & Acceptance

**Execution:**
- [x] `src/shared/tournee.ts` + test -- `snapshotProspects`, `numberStops` -- R1, R6, story verify.
- [x] `src/client/field/swipe.ts` + test -- track maths -- R4.
- [x] `src/client/field/db.ts` + test -- v5 tables, `startTournee`, counts, cache and stamp helpers -- R10, invariant 5.
- [x] `src/client/field/sync.ts`, `sync-schedule.ts` + tests -- send order, `idMap`, accepted deletes, pulled tables, drain -- R11.
- [x] `src/client/field/tournee-gate.ts`, `useTourneeGate.ts` + test -- gate decision table -- R2.
- [x] `src/client/field/StartScreen.tsx`, `StartSwipe.tsx`, `NoTourneeMessage.tsx` + tests -- screens, swipe and keyboard paths -- R2, R4.
- [x] `src/client/App.tsx`, `src/client/styles/app.css`, `src/client/copy/field.ts` -- wire the gate, hide tabs -- R4.
- [x] `docs/domains/field-operations.md` -- gate, snapshot, Dexie tables, send order -- R16.

**Acceptance Criteria:**
- Given an agent with assigned prospects on a local build, when they swipe, and separately when they press Enter on the track, then Tournée opens and, once synced, D1 holds one tournée and its stops numbered 1..n.
- Given a visit queued on the start screen, then the strip shows it and the outbox drains with the gate still up.
- Given a second browser profile signed in as the same agent, when it syncs, then it lands on Tournée without the start screen.

## Implementation Notes

- Implemented by a Sonnet subagent (resumed once after a rate limit); two fixes by the main session after verification.
- **"Today" for the gate** was first `max(meta lastSyncAt, mount time)`; review pass 1 moved it back to the spec's `useSyncState().lastSyncAt ?? openedAt` (phone clock, this session only), since `meta.lastSyncAt` is the server's clock and mixed clocks near midnight reopened the start screen. `meta.lastSyncAt` only answers "has a pull ever succeeded?" and `clearAgentCache` now deletes it. Midnight stays entry 9's (#505).
- `formatBrusselsWeekday` added to `src/client/format.ts` for the overline; `.pb-start-track` in `app.css` clears the fixed track (160px + safe area, to check on a phone).
- The gate also hides the tabs on the field frame's forbidden and not-found fallbacks.
- Verification fixes: the tap-nudge timer in `StartSwipe` is now cleared on unmount (it fired after test teardown: "window is not defined"); the App test "cache-started admin … re-check answers agent" raced `clearAgentCache` dropping the admin's pulled tournée on the identity switch, and now waits for the gate screen it lands on.
- Verification: typecheck, lint, build green; tests 2766/2766 green on repeated runs, apart from `src/worker/auth.test.ts` passphrase flake, already tracked as #460. `check:precache` 995.33 KiB of 1,000 KiB (+11.24 KiB over 984.09). After review pass 1: typecheck, lint, build green; 2773/2773 tests on three runs; `check:precache` 995.33 KiB. Manual `pnpm dev` checks (touch and keyboard swipe, D1 rows, second profile) not run in this session; left to the owner in the PR.

## Spec Change Log

## Review Triage Log

Pass 1, four lenses on Sonnet (owner's instruction for this run): blind-hunter, edge-case-hunter, verification-gap, intent-alignment. Counts: high 0 · medium 4 · low 9 · false 7 · maybe-false 0. Routes: patch 13 · defer 2 · rejected 9.

| Finding | Verdict | Route | Evidence / action |
|---|---|---|---|
| Gate "today" mixes server `meta.lastSyncAt` with phone `startedAt`; skew near midnight reopens the start screen (duplicate swipe) | medium | patch | Use in-memory `useSyncState().lastSyncAt ?? openedAt` (phone clock, this session only), keep meta value for never-loaded |
| Gate clock never tested through the hook | medium | patch | App test: meta `lastSyncAt` two days old + own outbox tournée now → open |
| `clearAgentCache` keeps `lastSyncAt`: new identity reads « Aucune tournée » before any pull | medium | patch | Delete `lastSyncAt` too; tests follow |
| `confirmOutbox` doc block now sits above `outboxTables` | low | patch | Move helper above the block |
| Subtitle « Carte » over the start screen on a deep link | low | patch | No tab subtitle while gated |
| `.pb-start-track` 160px < admin + track + retry (~200px) | low | patch | spacing × 52 |
| Snapshot comment cites "R1", silent on undated follow-ups | low | patch | Link ADR-0036, say undated is due |
| Dead `writtenBy` backfill loops for tournée rows | low | patch | Deleted (`startTournee` always stamps) |
| Keyboard-start test starts at `/tournee`, so `navigate` is unproven | medium | patch | Start at `/tournee/carte` |
| `!confirmed` → `unconfirmed` stamp untested through StartScreen | low | patch | Switchable mock, both cases |
| `formatBrusselsWeekday` untested | low | patch | format.test case at a Brussels-midnight instant |
| No v4 → v5 populated-outbox upgrade case; stale describe names | low | patch | Test added, names fixed |
| Strip on the start screen untested (AC 2) | low | patch | App gate case with a queued visit |
| Visit form open across midnight unmounts at the first sync after midnight | medium | defer | Entry 9 (#505) owns « a visit form open at midnight saves first »; deferred-work entry |
| Swipe numbers from a reading up to minutes old | low | defer | Entry 4 (#500) owns repeated readings and the threshold; deferred-work entry |
| No « Ajouter » before the swipe | false | rejected | design.md › Before the swipe: "An agent with nothing assigned has no Ajouter either" |
| No retry when the position times out | false | rejected | `useAgentPosition` sets `denied` for denied, unavailable and timeout alike, so « Réessayer » shows |
| Stale `dragged` ref after a failed commit swallows the next tap | false | rejected | `onPointerDown` resets `dragged` before the tap's click once the write has failed (`inactive` false again) |
| Not-found / forbidden lose the tab bar, "no way back" | false | rejected | Both keep their « Retour à la tournée » link (`FieldEmptyState` action) |
| Commit drag while `start()` declines snaps back silently | false | rejected | The track is inactive with no point or while busy, so `pointerdown` never starts a gesture |
| Accessible name « Commencer la tournée » vs visible « Glisser pour… » | false | rejected | design.md › The swipe names the button that way; the visible label contains the name |
| Server stores the tournée on a day other than today's (clock days off), pull returns null | low | rejected | Needs a phone clock off across a day boundary; fix would add a day marker; ADR-0036 accepts a clock days behind (story 1.2 log) |
| Dexie read failure leaves the gate on `loading` | low | rejected | Same pattern as every field screen's `useLiveQuery`; no everyday path |
| `useOutletContext` unguarded; loading frame shift | low | rejected | `FieldRoutes` renders only under `FieldFrame`; the loading frame lasts one Dexie read |
| Intent alignment: tests fake the server; no swipe → Worker → second-phone chain | — | noted | Server half is `src/worker/sync.test.ts` (story 1.2); the chain is the manual check in Verification |

## Design Notes

- **Strip count:** a swipe of 20 stops is one pending element, not 21; stops count alone only once their tournée left the outbox, so `remaining` still drives the drain.
- **No dialog yet:** until entry 4, a refused reading leaves the swipe disabled with a « Réessayer » button (`refresh()`) under the track, so the story is testable on its own.
- **Pulled wins:** with a pulled tournée for today and an own outbox one, the pulled one decides; first swipe wins on the server.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test` -- expected: green.
- `pnpm lint && pnpm build && pnpm check:precache` -- expected: green, total quoted in the PR.

**Manual checks:**
- `pnpm dev`: swipe by touch and by keyboard; `wrangler d1 execute --local` shows the tournée and stops; a second profile skips the start screen.
