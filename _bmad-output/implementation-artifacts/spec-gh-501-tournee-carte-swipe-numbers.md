---
title: 'Tournée and Carte show the stops by their swipe numbers (story 1.5, #501)'
type: 'feature'
created: '2026-10-15'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '81afa41f0e634dae91832275204c7e5befb0622a'
context:
  - '{project-root}/docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-496-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After the swipe, Tournée and Carte still list `buildTodayList`'s live nearest-next order: a stop's number is its list position, it changes as the agent walks, a saved À relancer stays or moves to « Plus tard », and nothing matches the numbers the swipe wrote.

**Approach:** Build `docs/design.md` › Next-stop card and › Carte to the swipe's numbers. One pure field helper reads today's tournée (pulled, else this identity's queued one), joins each stop with its prospect, drops the stops with a visit today (server visited stops ∪ this identity's outbox visits), and returns the rest in number order. The card, the rows, the Carte pins, the sheet and the tablet list all show `stop.number`. The phone stops calling `buildTodayList`.

## Boundaries & Constraints

**Always:** Placement reads the outbox, never a status (invariants 2, 3). A stop leaves Tournée the moment its visit is in the outbox, whatever its outcome. Distances still show from the latest reading and never reorder anything. With no reading they read « Position inconnue », and there is no notice and no « Réessayer » on Tournée or Carte (design.md). The card and each row are named « Arrêt {n} · {name} » (`copy.carte.pinLabel`). `round-map.ts` takes numbered items. The admin round view keeps `buildTodayList` and passes list positions as numbers. All copy lives in `copy/field.ts`. Precache stays under 1,000 KiB, and the PR quotes the total.

**Never:** « Nouveau », joiners and the `left` flag (entry 6), the counter (entry 7: `DailyProgress` and `dailyProgress` keep their inputs and get today's unvisited stops), the Carnet tab (entry 8), midnight (entry 9), or the admin round response (entry 12). No change to `src/shared/today.ts`, the server, the sync contract or Dexie's schema.

**Decisions (owner, 2026-10-15):** Until Carnet exists, the all-done state is design.md's card with the 56px `success` disc and « Tous les arrêts sont faits. » only. Entry 8 adds « Retrouvez-les dans Carnet. » and « Ouvrir le carnet ». The Carte sheet shows the same sentence and no actions. The spec stays whole at about 2,200 tokens, since it is one goal.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Walked in order | stops 1–6; 1–3 visited (server or outbox), 4 not | card « Arrêt 4 »; rows 5, 6; pins 4 (gold), 5, 6 |
| Any outcome | outbox visit today, À relancer + Aujourd'hui or a later date | stop gone from Tournée and Carte; no « Plus tard » section |
| Unsynced visit | visit only in the outbox, written by this identity | stop gone before any sync |
| Another identity's outbox visit | `writtenBy` another agent | stop stays |
| Yesterday's data | pulled visited stop or outbox visit dated yesterday | does not hide today's stop |
| Queued tournée | not pulled yet, this identity's `outboxTournees` today | its `outboxStops`, numbered |
| Both | pulled tournée today and an outbox one | the pulled one's stops |
| Field prospect | stop's prospect only in `outboxProspects` | row with « Pas encore envoyé » |
| Prospect not held | stop whose prospect is in neither table | no row, no pin, its number missing |
| No coordinates | stop without lat/lng | row with its number, no pin |
| No reading | position refused or missing | same order and numbers, « Position inconnue », no notice |
| All visited | every stop has a visit today | all-done card on Tournée; the sheet says the same; no pins |

</frozen-after-approval>

## Code Map

- `src/client/field/tournee-stops.ts` (new, pure) -- `todaysStops({ pulledTournees, pulledStops, outboxTournees, outboxStops, prospects, outboxProspects, visitedStops, outboxVisits, identity, now, point })` → `TourneeItem[]` in number order. `TourneeItem` = `{ id, number, name, type, address, lat, lng, status, pending, distanceM }`, where `id` is the prospect id because `visitPath` uses it. Today is `brusselsPeriod(now, 1)`, the gate's rule (`tournee-gate.ts:39-46`), and "mine" is `writtenByOrUnstamped`. Export `visitedTodayIds(...)` so entry 7 can reuse it.
- `src/client/field/useRound.ts` -- read the tournée tables (`db.ts:91-97`) live and return `{ stops, point, refresh, now, outboxVisits }`. Drop `list`, `buildTodayList`, `locating` and `denied`.
- `src/client/field/round-map.ts` -- `mapPins` takes `{ id, number, lat, lng, name }[]`, `MapPin.index` becomes `number`, and `next` stays the first item. Update `RoundMap.tsx:53,281`, `VisitSidePane.tsx:50-51` and `admin/round/round-list.ts:33`, which maps stops to `number: i + 1`.
- `src/client/field/StopNumber.tsx` -- rename the prop `index` to `number`. Admin `RoundScreen.tsx:157` passes its position.
- `StopRow.tsx`, `NextStopCard.tsx`, `CarteSheet.tsx`, `CarteList.tsx` -- take `TourneeItem` and show `item.number`. Drop the `index` props. `NotSyncedBadge` reads `pending` only. Add the accessible names.
- `TodayScreen.tsx` -- drop `LaterRow`/`LaterSection`, the locating and denied lines, and `PositionDenied`. `dailyProgress({ stops })` gets `stops`.
- `CarteScreen.tsx` -- select within `stops`, using `selected.number`, and drop `deniedNotice`.
- Delete `PositionDenied.tsx` and the copy only it and Plus tard used (`today.later`, `today.dueOn`, `today.retryPosition`, after a grep).
- Tests: add `tournee-stops.test.ts`, which covers the matrix. Update `round-map.test.ts`, `RoundMap.test.tsx`, `TodayScreen.test.tsx`, `CarteScreen.test.tsx`, `CarteRound.test.tsx`, `StopRow.test.tsx`, `VisitScreen.test.tsx`, `round-list.test.ts` and `RoundScreen.test.tsx`. The screen tests seed a pulled tournée and stops in Dexie, and a small shared seeding helper is fine.
- Docs: `docs/domains/field-operations.md` › Today list now says the list is today's tournée in number order, visited stops leave, and there are no Plus tard or end-of-round rows. `buildTodayList` stays for the admin round view only, until entry 12. `_bmad-output/specs/spec-done-stop-leaves-the-round/round-placement.md` notes that ADR-0036 replaced the « Plus tard » and end-of-round rows, and that every saved stop leaves Tournée.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/field/tournee-stops.ts` + test -- helper and matrix -- R6, R8.
- [x] `src/client/field/useRound.ts` -- stops from the tournée -- R6.
- [x] `round-map.ts`, `RoundMap.tsx`, `VisitSidePane.tsx`, `admin/round/round-list.ts`, `StopNumber.tsx`, `admin/round/RoundScreen.tsx` + tests -- numbered pins -- R6.
- [x] `StopRow.tsx`, `NextStopCard.tsx`, `CarteSheet.tsx`, `CarteList.tsx`, `TodayScreen.tsx`, `CarteScreen.tsx`, `copy/field.ts`, delete `PositionDenied.tsx` + tests -- R6, R8.
- [x] `docs/domains/field-operations.md`, `round-placement.md` -- R16.

**Acceptance Criteria:**
- Given a tournée of stops 1–6, when stops 1–3 have visits today and stop 4 has none, then Tournée's card reads « Arrêt 4 », stop 5's row and its Carte pin read 5, and Carte's sheet shows 4.
- Given three saved visits with different outcomes (Converti, À relancer + Aujourd'hui, Personne sur place + a later date), when Tournée and Carte render, then none of the three appear, no « Plus tard » heading exists, and both screens show the same numbers.
- Given the admin round view, when it renders, then its rows and pins still number by list position.

## Design Notes

- A stop needs its prospect's name and coordinates to be drawn. The sync pulls only open, assigned, unmerged prospects (`src/worker/round.ts`), so an unvisited stop that left mostly drops here already. Entry 6 adds the `left` flag and the total.
- `useRound` keeps the deliberately stale `now` (`lastSyncAt ?? openedAt`), so Tournée picks the same day the gate opened on.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test` -- expected: green.
- `pnpm lint && pnpm build && pnpm check:precache` -- expected: green, total under 1,000 KiB (was 998.73 KiB).

**Manual checks:**
- `pnpm dev`, swipe, save three visits with different outcomes: Tournée and Carte show the same numbers, with gaps where the visited stops were.

## Implementation Notes

- Implemented by a Sonnet `pwa-engineer` subagent from this spec, then the main session read the diff.
- `CarteSheet` takes `isNext` instead of an index. `AllDoneCard.tsx` is new. `today.empty` is also removed, because the all-done sentence replaces it on Tournée, the sheet and the tablet list.
- `AddProspectScreen.test.tsx` is updated as well: a place added after the swipe is not in the tournée until entry 6's joiners, so the swipe's stop stays the card.
- Test fixtures live in `src/client/field/tournee-test-helpers.ts` (`seedPulledTournee`, `clearTourneeTables`).
- Known limit until entry 6: an empty `stops` list always reads as all-done, including a tournée whose prospects the phone no longer holds. Entry 6 adds the `left` flag and the total-0 sentence.
- The sync writes the outbox delete and the pulled tables in one transaction (`sync.ts:216`), so Tournée does not flash all-done after the swipe syncs.
- Verification: typecheck, lint and build are green, with 2838/2838 tests passing. `check:precache` reads 997.41 KiB of 1,000 KiB, down from 998.73.
- Review pass 1 patches, by the same subagent: `useRound` reads its eight tables in one `useLiveQuery` snapshot and exposes `loaded`, so the all-done card and sentence show only once Dexie has answered. The row's description includes the distance. There are new tablet all-done and identity-filter tests, and the `progress.ts` comment is rewritten. After the patches, typecheck, lint and build are green, with 2841/2841 tests passing and `check:precache` at 997.51 KiB.

## Spec Change Log

## Review Triage Log

Pass 1 used four lenses. blind-hunter and verification-gap ran on Sonnet, as the owner asked for routine work this run. edge-case-hunter and intent-alignment ran on the session's model. Counts: high 0 · medium 2 · low 5 · false 6 · maybe-false 0. Routes: patch 5 · defer 2 · rejected 13 · noted 1.

| Finding | Verdict | Route | Evidence / action |
|---|---|---|---|
| All-done flashes before Dexie answers: eight `useLiveQuery` calls default to `[]` (blind, edge) | medium | patch | `useRound.ts` gave `stops=[]` on first render → `AllDoneCard`. One snapshot query, all-done only once loaded |
| Separate live queries settle in different ticks; adopting the winning tournée can read all-done for a frame (edge) | medium | patch | The same root fix: one `useLiveQuery` snapshot |
| Row's `aria-describedby` omits the distance (blind, edge) | low | patch | `StopRow.tsx`: the distance span sits outside `infoId`. Added to the description |
| Tablet `CarteList` all-done sentence untested (verification-gap) | low | patch | Pre-verified. Tablet case added |
| `writtenByOrUnstamped` filters on outbox field prospects and queued stops untested (verification-gap) | low | patch | Cases added |
| `progress.ts` `total` comment still explains Plus tard / end of round (blind) | low | patch | Comment rewritten |
| Finished-day counter line no longer tested (verification-gap, blind) | low | defer | Pre-verified; entry 7 owns the counter (intent: Never the counter). deferred-work entry |
| After a cache wipe the counter reads « 0 portes sur 3 » for a 6-stop day (edge) | medium | defer | Pre-existing: `n` comes from the phone-only `sentVisits` log; entry 7 replaces it with server visits. deferred-work entry |
| A `left` stop still shown if its prospect is cached (edge, blind) | false | rejected | `sync.ts` clears and rewrites `prospects` in the same transaction as `tourneeStops` (`:216`, `:288-289`), and the pull holds only open, assigned, unmerged prospects, so an unvisited stop that left is never held |
| Duplicate stops for one prospect (blind) | false | rejected | `tournee_stops` is unique per tournée and prospect (R10), and pulled stops are replaced wholesale; the swipe writes the deduped snapshot |
| Visit saved offline after midnight does not leave (blind, edge) | low | rejected | Out of scope by intent (Never: midnight, entry 9) |
| A place added after the swipe appears nowhere until entry 6 (blind, edge) | medium | rejected | Out of scope by intent (Never: joiners, entry 6). Raised with the owner in the PR |
| No tournée or no held prospect reads all-done (blind) | low | rejected | The gate never opens these screens without a tournée; the total-0 sentence is entry 6. Spec notes the limit |
| Tournée has no « Réessayer » after a refusal (blind) | false | rejected | design.md › Next-stop card: "there is no « Réessayer » any more"; field-operations.md says each screen takes one reading when it opens |
| French literals inlined in negative test assertions (blind) | low | rejected | Tests, not components; the keys were deleted on purpose |
| Admin numbers are list positions (blind) | false | rejected | The intent keeps the admin on `buildTodayList` until entry 12; `round-map.ts` and the docs say so |
| Empty identity hides outbox rows (blind) | false | rejected | `useRound` reads the same `useSyncState().identity` the gate opened on; no field screen renders without one |
| Gold pin missing when the next stop has no coordinates (blind) | false | rejected | design.md › Carte: a stop with no coordinates draws no pin; gold means only the next stop |
| Two clocks in `TodayScreen.test` (verification-gap other) | low | rejected | The counter's real-clock day is entry 7's; noted in the test |
| `field/today.ts` still imports `TodayItem` (intent) | false | rejected | A type import only; the phone calls no `buildTodayList` |
| Intent alignment: screen tests seed pulled tables, not swipe → sync end to end | — | noted | `startTournee` and sync are covered by story 1.3's tests; the end-to-end check is the manual `pnpm dev` step in the PR |
