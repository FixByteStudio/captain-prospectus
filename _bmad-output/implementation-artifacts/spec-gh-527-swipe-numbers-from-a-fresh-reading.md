---
title: 'The swipe numbers the stops from a reading taken at the swipe (#527)'
type: 'bugfix'
created: '2026-10-17'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: 'ba00bbd89cc53c5ac72c7960c19c6b4aa3805097'
context:
  - '{project-root}/docs/glossary.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The swipe numbers the stops nearest-next from the location gate's passing reading, latched when the dialog closes (`useLocationGate.ts:58`, `:93`). The gate takes no reading after that, so an agent who passes at the depot and swipes ten minutes later at the first street gets an order built for the depot. ADR-0036 › Numbers says "from the swipe position". Deferred by #499 and #500; scheduled as its own story under the retro #59 rule.

**Approach:** At the swipe's commit, take one more one-off fresh reading while the track shows its wait state. Number from it when it passes the gate's rule; otherwise (coarse, failed, timed out) number from the latched point. The gate itself does not reopen and its status does not change.

## Boundaries & Constraints

**Always:** `getCurrentPosition` only, through `useAgentPosition.ts`, which stays the app's only door to geolocation. The swipe reading is fresh (`maximumAge: 0`), uses `LOCATION_GATE_HIGH_ACCURACY`, and is remembered for the ADR-0028 marker like every reading. `startedAt` is the commit's moment, taken before the reading. The swipe never fails or blocks because of the reading: it always ends in `startTournee` with some point. One tournée per swipe (the `busy` guard stays). New constants live in `location-gate.ts` beside the others, marked provisional until the pavement test. Copy in `copy/field.ts`. Precache stays under 1,000 KiB and the PR quotes the total.

**Decisions (owner, 2026-10-18):** The swipe reading counts when its accuracy is at or under `LOCATION_GATE_ACCURACY_M`, the gate's own rule; no new threshold. It waits at most 3 s (the reading's `timeout`), a new provisional constant set by the pavement test. The track keeps « Démarrage… » for the whole wait; no new copy.

**Never:** No change to the gate's dialog, its status table, the threshold's value, the server, the sync contract or Dexie. A later reading never reopens the gate. No `watchPosition`, no second geolocation door, no JS timer racing the reading when the browser's own `timeout` option does it.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Agent moved | gate passed at A; swipe reading at B, passes | stops numbered nearest-next from B | — |
| Swipe reading coarse | swipe reading accuracy over the rule | numbered from A | silent fallback |
| Swipe reading fails | error code 1, 2 or 3 | numbered from A | silent fallback |
| Wait state | reading outstanding after commit | track holds at the end with the wait label; a second commit starts nothing | — |
| Offline | no network | reading still taken (GPS or fails); tournée queued as today | fallback if it fails |

</frozen-after-approval>

## Code Map

- `src/client/field/useAgentPosition.ts:59-104` -- the only `getCurrentPosition` call and `rememberReading`. Extract it into an exported promise function (e.g. `takeReading({ fresh, highAccuracy, timeout })` → `{ point, accuracy } | null`) that the hook's effect and the swipe both use; the hook keeps its state handling and its 10 s timeout. Update the header ("this hook" → "this module").
- `src/client/field/location-gate.ts` -- add the swipe wait constant beside `LOCATION_GATE_RETRY_MS`; keep the provisional note.
- `src/client/field/useLocationGate.ts:22-28,91-95` -- `LocationGate` gains an async `swipePoint()`: one `takeReading` with the gate's options and the swipe timeout, returning its point when it passes the rule, else `point`. Fix the `point` doc ("the reading the swipe numbers from") and the header.
- `src/client/field/StartScreen.tsx:70-84` -- in `start()`, after `setStarting(true)` and `startedAt`, `await swipePoint()` and pass it to `numberStops`. Header line 6 ("from the reading") follows.
- `src/client/field/StartSwipe.tsx` -- unchanged: « Démarrage… » covers the wait.
- `test/geolocation.ts`, `test/setup-dom.ts:21-33` -- add a `"timeout"` fix (error code 3).
- Tests: `useLocationGate.test.tsx` (each matrix row on `swipePoint`, and that the gate's status stays passed), `StartScreen.test.tsx:229-246` (a fix moved between pass and swipe changes the numbers), `useAgentPosition.test.tsx` stays green.
- Docs: `docs/domains/field-operations.md:9` ("is the point the swipe numbers from" → the swipe's own reading, fallback), `docs/design.md:1721-1736` (one line after "A reading that passes closes the dialog…").

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/field/useAgentPosition.ts` -- extract `takeReading`; hook uses it -- one geolocation door
- [ ] `src/client/field/location-gate.ts` -- swipe wait constant -- provisional, pavement test
- [ ] `src/client/field/useLocationGate.ts` -- `swipePoint()` -- the rule and fallback live with the gate
- [ ] `src/client/field/StartScreen.tsx` -- number from `await swipePoint()` -- the fix
- [ ] `test/geolocation.ts`, `test/setup-dom.ts` -- `"timeout"` fix -- matrix row 3
- [ ] `src/client/field/useLocationGate.test.tsx`, `StartScreen.test.tsx` -- matrix rows -- pin the behaviour
- [ ] `docs/domains/field-operations.md`, `docs/design.md` -- the swipe's reading -- docs match code

**Acceptance Criteria:**
- Given the gate passed at A and the fix moved to B before the swipe, when the agent swipes, then the outbox stops are numbered nearest-next from B.
- Given a swipe whose reading has not answered, when the agent commits again, then still exactly one tournée is queued.
- Given any swipe, then the marker reading remembered for ADR-0028 is the swipe's reading when it succeeded.

## Implementation Notes

- `takeReading` returns `{ ok: true, point, accuracy } | { ok: false, refused }` rather than `{ point, accuracy } | null`: the hook still needs a refusal (code 1) told apart from a lost fix. It never rejects (a synchronous throw resolves `{ ok: false }`, review pass 1).
- `startedAt` is taken at the commit, before the up-to-3 s reading, as the spec says.
- Verification after review pass 1: typecheck, lint and build green; 3010/3010 tests; `check:precache` 25 entries, 968.29 KiB of 1,000 KiB. The phone check (pass, walk 200 m, swipe) is still the owner's pavement test.

## Spec Change Log

## Review Triage Log

Pass 1, four lenses on Sonnet (owner's instruction): blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped (not a refactor sweep). Counts: high 0 · medium 0 · low 6 · false 6 · maybe-false 1. Routes: patch 5 · defer 1 · rejected 7 · noted 1.

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| `takeReading` "never rejects" but a sync throw in the executor rejects; hook's `.then` has no catch (blind, edge) | low | patch | Real if `getCurrentPosition` throws; try/catch in the executor, `swipePoint`'s own try/catch dropped |
| Hook's default 10 s `timeout` unpinned after moving into `takeReading` (verification-gap) | low | patch | Pre-verified; `timeout: 10_000` added to the options test |
| Marker test titled "even a coarse one" uses 80 m, which passes (blind) | low | patch | 80 ≤ 200; fix uses threshold + 50 |
| StartScreen fallback test titled "coarse or fails" only runs `"timeout"` (blind, intent) | low | patch | Retitled; coarse pinned in `useLocationGate.test.tsx` |
| design.md › On commit still says the label covers only the write; new paragraph breaks the hard wrap (blind) | low | patch | design.md:1694-1698 stale since this change; rewritten and re-wrapped |
| No backstop if the browser never calls either callback; `await swipePoint()` hangs on « Démarrage… » (blind, edge) | maybe-false | defer | Permission is already granted at the swipe, where the browser `timeout` applies; the frozen Never forbids a racing JS timer. Settle on a real iOS/Android WebView; medium if true |
| Fresh 190 m reading replaces a 15 m gate reading (blind) | false | rejected | Owner decision 2026-10-18: the swipe reading counts under the gate's own rule |
| Unmount/remount during the 3 s wait writes a detached tournée or starts twice (blind, edge, verification-gap) | low | rejected | Needs a leave-and-return or a midnight flip inside 3 s; a committed swipe writing its tournée is correct; a mounted-guard adds a branch for a rare case |
| `numberStops` throwing before the try leaves `busy` stuck (edge) | false | rejected | Pre-existing placement, pure function over validated data; not caused by this change |
| Gate read concurrent with `swipePoint` could displace the marker (edge) | false | rejected | After the pass `doneRef` stops visibility reads and the coarse retry; no gate read runs at the swipe |
| `useAgentPosition` → `useAgentPosition.ts` comment edits are churn (blind) | false | rejected | `takeReading`, not the hook, is now the caller, so "the module" is the accurate name |
| Hook state lands one microtask later; constants not tied; `fresh` in two places (blind) | false | rejected | No observable effect, tests green; no named harm |
| « Démarrage… » test's `count() === 0` is weak (verification-gap) | low | rejected | The reversed-numbering test already fails if the reading is not awaited |
| Drag path into `start()` not run through the new async path (intent) | — | noted | Both paths call the same `start()`; existing drag tests still commit |

## Design Notes

Why fall back instead of waiting longer: a started tournée is the day's one irreversible act, and an agent outdoors with no fix must still start (ADR-0036 › Consequences already holds T1 only until the first pass). The latched point is at worst the old behaviour.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:precache` -- expected: green, precache under 1,000 KiB.

**Manual checks:**
- On a phone: pass the gate, walk 200 m, swipe; the first stop is the nearest to where you swiped.
