---
title: 'Joiners take the next numbers and leavers leave a gap (story 1.6, #502)'
type: 'feature'
created: '2026-10-15'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '215d7b0569112d68511b1f345858dc37cfc87a7c'
context:
  - '{project-root}/docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-496-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After the swipe, a prospect assigned to the agent (or a place added from Ajouter) is never added to the tournée, so it appears nowhere. A stop the server marks `left` is still drawn whenever the phone holds its prospect, and nothing tells a total of 0 apart from "all done".

**Approach:** After each pull, and when a field prospect is queued, one Dexie transaction compares R1's set (`snapshotProspects`) with today's tournée stops and appends each missing prospect as a joiner. It goes through the outbox, numbered by `numberStops` from the highest number ever given + 1. `todaysStops` drops `left` stops and marks a joiner « Nouveau », and the hook exposes a `total`.

## Boundaries & Constraints

**Always:** Agents only insert. A joiner is an outbox stop row (`StoredStop`, stamped like the swipe) and is never updated. A number is never reused: the highest number counts left stops and queued outbox stops. A prospect already among the tournée's stops (left ones included) never joins again, so one that comes back keeps its first number and is not « Nouveau ». A joiner is a stop whose `addedAt > tournée.startedAt`. `left` comes from the server only. « Nouveau » is an `outline` badge on the row, the card and Carte's sheet, with copy in `copy/field.ts`. The precache stays under 1,000 KiB.

**Never:** The counter's inputs or display (entry 7), Carnet or « Ouvrir le carnet » (entry 8), midnight (entry 9), the admin round view (entry 12). No change to the sync wire schema, `CLIENT_VERSION` or Dexie's schema. No `left` written anywhere.

**Decisions (owner, 2026-10-15):** When two phones of one agent append different joiners with the same number, the server keeps the first. `writeTournees` drops a stop whose number another prospect already holds in that tournée (or holds earlier in the same request), and still lists it in `accepted`. On its next pull the losing phone re-appends that prospect as the next number. Only an unsynced joiner can renumber, and design.md names this as the second exception. The spec stays whole at about 2,000 tokens, since it is one goal.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Two assigned after swipe | tournée 1–20, pull brings P and Q | outbox stops 21, 22 (`numberStops` from stop 20's coords); rows show « Nouveau »; D1 holds both after the next sync |
| Gap kept | stop 19 `left`, highest 20 | joiner gets 21, not 19 |
| Place added from Ajouter | swiped, then a field prospect is queued offline | in one transaction it is queued and appended as the next number, « Nouveau » and « Pas encore envoyé » |
| Already a stop | prospect in pulled stops (any `left`) or in outbox stops of today's tournée | no new stop |
| Reassigned back | stop 7 `left`, then assigned again | keeps 7, no « Nouveau » |
| No tournée today | before the swipe, or yesterday's only | nothing appended |
| Later follow-up | open `follow_up` due tomorrow | not a joiner (R1) |
| Unvisited stop leaves | stop 7 reassigned, next stop is 4 | 7 gone from Tournée and Carte; card still « Arrêt 4 »; `total` down by 1 |
| Visited stop | stop visited today | never `left` (server rule); Tournée already drops it |
| Every stop left unvisited | `total` 0 | « Plus aucun arrêt dans votre tournée aujourd'hui. » instead of the all-done sentence |
| Two phones, same joiner number | A synced X as 21; B sends Y as 21 | B's stop is in `accepted` but not stored; B's next pull appends Y as 22 |
| Same stop resent | same id, same number | stored once, no collision |

</frozen-after-approval>

## Code Map

- `src/shared/tournee.ts` -- `numberStops(items, from, firstNumber)` (reuse as is) and `snapshotProspects` (R1's set). `isStopLeft` stays the only `left` rule.
- `src/client/field/tournee-stops.ts` -- `stopsOfToday` picks the pulled tournée (else this identity's queued one). Extend it to return the tournée's `id`/`startedAt` and each stop's `addedAt`/`left`, then reuse it for joiners. `todaysStops` skips `left`, and `TourneeItem` gains `joiner: boolean`. Add a pure `tourneeTotal(input)`: distinct prospects among today's stops minus those pulled `left` (entry 7 will read it).
- `src/client/field/tournee-joiners.ts` (new, pure) -- `joinersFor({ tournee, stops, prospects, outboxProspects, identity, now })` → `TourneeStopSync[]`. Candidates are `snapshotProspects(prospects, mine(outboxProspects), now)` minus stop prospect ids. The anchor is the coordinates of the highest-numbered stop whose prospect is held with coordinates; with no anchor, sort by name. Numbering starts at max(number) + 1, and `addedAt = now`.
- `src/client/field/db.ts` -- `appendJoiners(db, identity, now, unconfirmed)`: one `rw` transaction over prospects, outboxProspects, tournees, tourneeStops, outboxTournees and outboxStops that reads, calls `joinersFor` and `bulkAdd`s stamped rows. Serialised by IndexedDB, so two tabs cannot both append.
- `src/client/field/sync.ts:212-292` -- call it at the end of the pull transaction (add no tables; they are all already there), with `body.serverTime` and this identity confirmed.
- `src/client/field/AddProspectScreen.tsx:92` -- queue the field prospect and call `appendJoiners` in one transaction (`Date.now()`, `!confirmed`).
- `src/worker/tournee.ts:58-110` (`writeTournees`) + test -- before the insert, read `(tourneeId, number, prospectId)` of the owned tournées (chunked, ≤100 params). Drop a new stop whose number another prospect already holds, or holds earlier in this batch. A resend (same prospect) is not a collision. The stop's id still goes in `accepted.stops`.
- `src/client/field/useRound.ts` -- expose `total`.
- `StopRow.tsx` -- `JoinerBadge` next to `NotSyncedBadge` (`Badge variant="outline"`), used in `NextStopCard.tsx` and `CarteSheet.tsx` too.
- `AllDoneCard.tsx`, `TodayScreen.tsx`, `CarteSheet.tsx:49`, `CarteList.tsx:60` -- when `total === 0`, show `copy.today.nothingLeft`.
- `src/client/copy/field.ts` -- `today.joiner` « Nouveau » and `today.nothingLeft`.
- `src/client/field/tournee-test-helpers.ts` -- reuse `seedPulledTournee`.
- Docs: `docs/domains/field-operations.md` (Today list and Protocol: joiners, leavers, the trigger points). Also `docs/api.md:26` (a joiner number already held is accepted and dropped), `docs/data-model.md:67` (collisions decided by the first stored) and `docs/design.md` › Next-stop card (the second exception: an unsynced joiner can renumber).

## Tasks & Acceptance

**Execution:**
- [x] `tournee-stops.ts` + test -- `left`, `joiner`, `tourneeTotal` -- R6.
- [x] `tournee-joiners.ts` + test -- the matrix's joiner rows -- R6.
- [x] `db.ts`, `sync.ts`, `AddProspectScreen.tsx` + tests -- append in a transaction -- R6, R10.
- [x] `src/worker/tournee.ts` + test -- number collision keeps the first -- R6, R10.
- [x] `useRound.ts`, `StopRow.tsx`, `NextStopCard.tsx`, `CarteSheet.tsx`, `CarteList.tsx`, `AllDoneCard.tsx`, `TodayScreen.tsx`, `copy/field.ts` + screen tests -- R6, R7.
- [x] Docs -- R16.

**Acceptance Criteria:**
- Given a tournée of 20 stops, when a sync pulls two newly assigned prospects, then the outbox holds stops 21 and 22, Tournée shows both with « Nouveau », and after the next sync the worker test's D1 holds both rows.
- Given stops 4–10 unvisited with 4 next, when the pull marks stop 7 `left`, then 7 disappears from Tournée and Carte, the card still reads « Arrêt 4 », and `total` drops by one.

## Implementation Notes

- A Sonnet general-purpose subagent implemented this from the spec. The main session then read the diff.
- `stopsOfToday` is exported and returns `{ tourneeId, startedAt, stops }`. It also unions in this identity's outbox stops for the pulled tournée, skipping any prospect the pull already holds, so an unsent joiner shows beside the pulled stops.
- `queueFieldProspect` (`db.ts`) does Ajouter's write: the prospect and its joiner stop go in one transaction. `appendJoiners` nests inside it and inside the sync's pull transaction. The sync stamps joiners with `unconfirmed` false, because `syncNow` only runs under a confirmed identity (`useSync.tsx`).
- `joinersFor` skips numbers above `TOURNEE_STOP_NUMBER_MAX`, so the wire schema never refuses a stop.
- The worker reads held `(tourneeId, number, prospectId)` one tournée per select (1 bound parameter).
- Changed tests:
  - The empty-round `TodayScreen` tests now expect `nothingLeft`, since there is no tournée and the total is 0.
  - The `AddProspectScreen` double-tap test holds `fieldDb.transaction`.
- Verification: typecheck, lint and build are green, with 2887/2887 tests passing. `check:precache` reads 999.81 KiB of 1,000 KiB, up from 997.51 KiB, which leaves 0.19 KiB of headroom.

## Spec Change Log

## Review Triage Log

### Pass 1

Lenses: blind-hunter and verification-gap ran on Sonnet (the owner asked for Sonnet on routine work), and edge-case-hunter and intent-alignment on the session's model. duplication-map was skipped because this is not a refactor sweep.

Counts: high 0 · medium 1 · low 14 · false 4 · maybe-false 0. Routes: patch 6 · defer 0 · rejected 13 · noted 1.

| Finding | Verdict | Route | Evidence / action |
|---|---|---|---|
| ADR-0036 › Numbers says numbers never change; the new collision rule (and first-swipe-wins) contradicts it, and the worker cites the ADR for it (blind) | medium | patch | `0036…md:95` has no exception. Add an amended bullet recording the owner's 2026-10-14 and 2026-10-15 decisions; the citation then holds |
| field-operations.md says sent stops are "always numbered above what it last saw", while the same bullet documents collisions (blind) | low | patch | Direct rewording |
| Sync test "nor one the pull marks left and brings back" removes the prospect from the pull, so the brought-back case never runs (blind) | low | patch | `sync.test.ts:1083-1098`. Keep held[1] in `prospects` with `left` |
| `queueFieldProspect(…, true)` with a tournée: stop's `unconfirmed` untested (verification-gap) | low | patch | Pre-verified. The code forwards the flag (`db.ts`); add the test |
| « Nouveau » on a queued, unsynced tournée untested (verification-gap) | low | patch | Pre-verified. Add the queued-branch cases |
| `TOURNEE_STOP_NUMBER_MAX` cut-off untested (verification-gap, blind) | low | patch | Pre-verified. One test |
| Check-then-insert race: two phones syncing at the same instant both store one number (blind, edge) | low | rejected | Needs two phones of one agent, each with a different offline joiner, syncing between each other's statements; the outcome is option B of the owner's question (a duplicate number). The fix is a unique index plus a migration, not a direct correction. Raised in the PR |
| A big swipe's later-pass stop loses its number to a second phone's joiner (edge) | low | rejected | Needs over 250 stops and a second phone pulling between drain passes (`shouldDrain` repeats at once). Fix adds a branch |
| Clock-ahead phone: clamped `addedAt` gives a false « Nouveau » or loses it (edge ×2) | low | rejected | Accepted in the Design Notes. The fix would change the wire contract (a client time or flag) |
| Unsent joiner and a pulled stop on one number show two rows until the next sync (edge, blind) | low | rejected | Transient. A stop sent in the same request is dropped and re-appended in that pull's transaction; only a stop queued after the request was built lingers, for one sync |
| `total` > 0 with nothing drawn reads all-done (blind, intent) | false | rejected | A non-left unvisited stop's prospect is assigned, open and unmerged, so the same pull transaction holds it (`round.ts`); a joiner's field prospect is in `outboxProspects`. `clearAgentCache` clears the tournée tables with the prospects |
| Sync hard-codes `unconfirmed` false (blind) | false | rejected | `syncNow` returns before `runSync` unless the identity is confirmed (`useSync.tsx:124`) |
| design.md and glossary miss the badge and the empty state (blind) | false | rejected | design.md › Next-stop card already describes the outline « Nouveau » and the total-0 sentence; glossary › Stop covers joiners and gaps |
| `appendJoiners` reads six tables in the pull lock (blind) | low | rejected | Tens to hundreds of rows; no measured cost |
| `queueFieldProspect` appends other pending joiners too (blind) | low | rejected | Intended: any snapshot member missing from the stops joins (Intent › Approach) |
| `mockImplementationOnce` on `fieldDb.transaction` is brittle (blind) | low | rejected | Test only, and it passes; no named harm |
| Spec hygiene: tasks unticked, logs empty (blind) | false | rejected | Ticked and logged at this step |
| Joiners use `serverTime` but screens use the phone's day (intent) | low | rejected | Same Brussels day except near midnight, which is entry 9's |
| Precache at 999.81 KiB, 0.19 KiB headroom (blind) | — | noted | Entry 7 deletes `sentVisits`; quoted in the PR for the owner |

## Design Notes

A joiner must never be « Nouveau » by number alone, because a snapshot can have gaps. `addedAt > startedAt` holds because the swipe writes `addedAt = startedAt` (`StartScreen.tsx:55-62`). A server-side clamp can only make them equal, which shows a joiner with no badge when the phone clock is ahead. That is acceptable.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test` -- expected: green.
- `pnpm lint && pnpm build && pnpm check:precache` -- expected: green, under 1,000 KiB (997.51 KiB before).

**Manual checks:**
- `pnpm dev`: swipe, assign two prospects from the admin, sync → 21, 22 « Nouveau »; reassign an unvisited stop → it disappears, the next stop does not change.
