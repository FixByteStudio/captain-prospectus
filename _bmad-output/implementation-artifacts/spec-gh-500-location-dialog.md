---
title: 'A location dialog holds the start screen until a fix is precise (story 1.4, #500)'
type: 'feature'
created: '2026-10-15'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: 'a482f6f65cb238a4a7589a5d5fb571ec0dd964d9'
context:
  - '{project-root}/docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-496-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The start screen (story 1.3) enables the swipe on any reading, however coarse, and a refused one only shows « Réessayer » under the track. So a day can be numbered from a reading kilometres off, and nothing explains how to switch location on.

**Approach:** Build `docs/design.md` › Before the swipe › the location dialog. A shadcn `AlertDialog` with no way out sits over the start screen until a reading meets a named accuracy threshold. « Activer » takes the same one-off reading as `refresh()`, coarse readings repeat at a named cadence while the page is visible, and the passing reading is the one the swipe numbers from.

## Boundaries & Constraints

**Always:** The readings are `getCurrentPosition` through `useAgentPosition` only, never `watchPosition`. The gate's readings are fresh (`maximumAge: 0`), so a cached coarse fix cannot come back. Each reading is still remembered for the ADR-0028 marker. The threshold, the cadence and the gate's `enableHighAccuracy` are named constants. The copy is verbatim from design.md and EXPERIENCE.md › Localisation, in `copy/field.ts`. The dialog shows only on the start screen. Escape and the overlay do nothing. A passing reading closes the dialog and focuses the swipe. Precache stays under 1,000 KiB.

**Decisions (owner, 2026-10-15):** The owner's pavement test sets the threshold and `enableHighAccuracy`, after implementation and before the PR. Until then the build ships provisional values: `LOCATION_GATE_ACCURACY_M = 200` (the loose end of the 100–200 m target), `enableHighAccuracy: false` and a 2 s cadence. The run halts there. The owner records the chosen values in the PR. An admin (`adminOnline`) gets the same `secondary` « Tableau de bord » link inside the dialog, under the Réglages line, because the dialog covers the one above the track (owner took the recommended option; design.md gets one line).

**Never:** The dialog after the swipe, or on Tournée, Carte, Ajouter or the visit form; those keep today's readings and « Position inconnue ». Nothing locks once the day has started. The midnight « Visite enregistrée » line belongs to entry 9. No change to the server, the sync contract or Dexie. No i18n or geolocation library.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Permission granted | Permissions API answers `granted` | readings start as the dialog opens, no tap |
| Permission unknown | `prompt`, or no Permissions API | status absent until « Activer » |
| Outstanding | a reading in flight | spinner, « Recherche de votre position… » |
| Too coarse | accuracy 350 m > threshold | spinner, « Précision : 350 m. On affine… », next reading after the cadence |
| Hidden page | tab hidden while coarse | no reading until visible again |
| Accepted | accuracy ≤ threshold | dialog closes, swipe enabled and focused, numbers from that point |
| Refused | error code 1 | « La localisation est refusée sur ce téléphone. », no repeat; « Activer » reads again |
| Unavailable / timeout | error code 2 or 3 | « Position introuvable. Sortez à découvert si possible, puis touchez Activer. », no repeat |
| Back from Réglages | page visible again, permission now `granted` | reads at once |
| Escape / overlay tap | dialog open | stays open |

</frozen-after-approval>

## Code Map

- `src/client/field/useAgentPosition.ts` -- add `accuracy: number | null` and `refused: boolean` (`code === 1`; `denied` keeps meaning any failure for existing callers). Add an optional `{ lazy, fresh, highAccuracy }`: `lazy` skips the mount reading, `fresh` sets `maximumAge: 0`. The defaults keep every current caller unchanged (`useRound`, `AddProspectScreen`, `VisitScreen`). Rewrite the header comment at `:10`: failures are survivable after the swipe, while before it the location gate holds (ADR-0036).
- `src/client/field/location-gate.ts` (new, pure) -- the threshold, cadence and high-accuracy constants, plus `locationStatus(state, threshold)` → `idle | locating | coarse(m) | refused | unavailable | passed`.
- `src/client/field/useLocationGate.ts` (new) -- composes `useAgentPosition({ lazy: true, fresh: true, highAccuracy })`. It starts a reading on mount and on `visibilitychange` → visible, when `navigator.permissions?.query({ name: "geolocation" })` says `granted` (guarded, try/catch). On `coarse` with the page visible, it schedules `refresh()` after the cadence, and clears the timer on unmount, on hide and on pass. It returns `{ status, point (only once passed), activate: refresh }`.
- `src/client/field/LocationDialog.tsx` (new) -- design.md › The location dialog: a 48px gold disc with `MapPin`, the title, the description, a `role="status"` `aria-live="polite"` line with a spinner for locating and coarse (the spinner pattern from `AddProspectScreen`), a full-width 48px « Activer », and the muted Réglages line. `onEscapeKeyDown` calls `preventDefault`. `onCloseAutoFocus` calls `preventDefault` and focuses the swipe. Takes `adminOnline` for the « Tableau de bord » link (`copy.nav.tabs.dashboard`, as in `StartScreen.tsx:116`).
- `src/client/ui/alert-dialog.tsx:44` -- `AlertDialogContent` gains `overlayClassName`, so the caller adds `backdrop-blur-sm`. This is a vendored file, and the leave guard stays unchanged.
- `src/client/field/StartScreen.tsx:32,121,127-135` -- replace `useAgentPosition` with `useLocationGate`, and render `<LocationDialog open={!passed}>`. The swipe's `ready` is the passed point. Remove the « Réessayer » under the track.
- `src/client/field/StartSwipe.tsx` -- take a `ref` (React 19 prop) merged with `track`, for the focus.
- `src/client/copy/field.ts` -- a `location` block: the title, description, `activate`, `settings`, `coarse(m)`, `refused` and `unavailable`. Reuse `today.locating`.
- `test/geolocation.ts`, `test/setup-dom.ts:24` -- add an `"unavailable"` fix (code 2) and a `setGeolocationPermission(state | null)` stub for `navigator.permissions`.
- Tests: extend `useAgentPosition.test.tsx` and `StartScreen.test.tsx`, and add `location-gate.test.ts` and `LocationDialog.test.tsx`. The existing StartScreen tests need a precise reading before the swipe enables.
- Docs: `docs/domains/field-operations.md:9` (the dialog, the constants, fresh readings), and `docs/design.md:1705` (the constants by name instead of "entry 4 sets"), plus one line: an admin's « Tableau de bord » sits inside the dialog.

## Tasks & Acceptance

**Execution:**
- [x] `test/geolocation.ts`, `test/setup-dom.ts` -- unavailable fix, permission stub -- test the error and auto-start paths.
- [x] `src/client/field/useAgentPosition.ts` + test -- accuracy, refused, lazy/fresh/highAccuracy options, comment -- R3, R16.
- [x] `src/client/field/location-gate.ts` + test -- constants, status table -- R3.
- [x] `src/client/field/useLocationGate.ts` -- auto start, repeat, visibility -- R3.
- [x] `src/client/ui/alert-dialog.tsx`, `src/client/field/LocationDialog.tsx` + test -- dialog, states, focus, no escape -- R3.
- [x] `src/client/field/StartScreen.tsx`, `StartSwipe.tsx`, `src/client/copy/field.ts` + StartScreen test -- wire the dialog, swipe from the passing point -- R3.
- [x] `docs/domains/field-operations.md`, `docs/design.md` -- R16.

**Acceptance Criteria:**
- Given the start screen, when readings come back refused, then 350 m, then within the threshold, then the dialog shows each state in turn, closes on the last one, and the swipe numbers from that last point.
- Given the dialog is open, when Escape is pressed or the overlay is tapped, then it stays open and the swipe stays `aria-disabled`.
- Given a refused reading, when no « Activer » is tapped, then no further reading is taken.

## Design Notes

- **Why `lazy` and `fresh` live on `useAgentPosition`:** it stays the app's only door to geolocation (its own header), and the gate adds the policy on top. `maximumAge: 120_000` would hand back the same cached coarse fix on every repeat.
- **Why a refusal does not repeat:** the browser does not ask again, so repeating only spins. The visibility re-check covers the « puis revenez ici » round trip through Réglages.
- **Pavement test aid:** the coarse status line shows each reading's accuracy, and that is the number the owner reads on the pavement.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test` -- expected: green.
- `pnpm lint && pnpm build && pnpm check:precache` -- expected: green, total quoted in the PR.

**Manual checks:**
- Owner, outdoors on a mid-range Android and an iPhone: the dialog closes, and the owner records the threshold and `enableHighAccuracy` in the PR.

## Implementation Notes

- Implemented by a Sonnet `pwa-engineer` subagent. After reading the diff, the main session made two changes: the status line's live region now stays mounted, empty before the first reading (`empty:hidden`), because a region added with its text already in it is often not announced; and `useLocationGate.test.tsx` now also covers a `prompt` permission beside a missing Permissions API.
- `locationStatus`: a failure outranks an older accuracy, and a coarse reading stays on screen while the next one runs, so the line does not flicker every 2 s. `useLocationGate` latches the first passing point, so the gate never reopens and takes no further readings.
- The spinner is the vendored `ui/spinner.tsx` (`aria-hidden`, `role="presentation"`), so no second `role=status` sits inside the line. `AddProspectScreen` has no spinner to copy.
- The admin « Tableau de bord » above the track stays as it was, and the dialog carries its own.
- Tests query the swipe with `{ hidden: true }`, because Radix hides the page behind the open dialog.
- Verification: typecheck, lint and build are green, with 2816/2816 tests passing. `check:precache` reads 998.62 KiB of 1,000 KiB, which leaves 1.38 KiB for entries 5–9. After review pass 1, typecheck, lint and build are green, with 2819/2819 tests passing and `check:precache` at 998.73 KiB.
- Deferred-work item "the swipe numbers from a reading up to minutes old" (story 1.3): partly resolved. The swipe numbers from the fresh reading (`maximumAge: 0`) that closed the dialog. That reading still ages if the agent waits before swiping (review pass 1, deferred again).

## Spec Change Log

## Review Triage Log

Pass 1, four lenses on Sonnet (owner's instruction for this run): blind-hunter, edge-case-hunter, verification-gap, intent-alignment. Counts: high 0 · medium 1 · low 6 · false 12 · maybe-false 0. Routes: patch 6 · defer 2 · rejected 16 · noted 1.

| Finding | Verdict | Route | Evidence / action |
|---|---|---|---|
| `activate` and the visibility re-check call `refresh()` while a reading is in flight, which cancels and restarts it (repeated « Activer » taps, or a tab switch mid-reading) | medium | patch | `useAgentPosition`'s effect cleanup sets `cancelled`, so the landing fix never reaches state. Skip the refresh while a reading is outstanding, in both paths, with tests |
| No test that the gate takes no reading after it passed (visibility after the pass) | low | patch | Verification-gap, pre-verified. Test added |
| 200.4 m is shown as « 200 m » but does not pass | low | patch | `Math.round` vs `<=`; display `Math.ceil` |
| `setTrack` returns the parent callback ref's cleanup | low | patch | Call `ref(node)` without returning its value |
| Overlay tap in `LocationDialog.test` guarded by `if (overlay)` | low | patch | Assert the overlay exists |
| Double space in field-operations.md | low | patch | Fixed |
| Swipe numbers from the latched passing point, which ages if the agent waits; the implementation note overclaimed | low | defer | Pre-existing (story 1.3's deferred item); note corrected; deferred-work entry |
| Precache 998.62 of 1,000 KiB leaves 1.38 KiB for entries 5–9 | medium | defer | Not a defect in this diff; deferred-work entry, and raised with the owner |
| Escape/overlay tests pass without `onEscapeKeyDown`, since the dialog is controlled with no `onOpenChange` | false | rejected | The tests assert the user-visible outcome (stays open); the handler is a second guard if someone adds `onOpenChange` |
| Status line re-announces every coarse reading | low | rejected | design.md sets a polite status line carrying the number; splitting it adds markup for a rare case |
| No way out for an agent with no fix; polls forever indoors | false | rejected | design.md / ADR-0036: "T1 has no way past it without a position", and the readings repeat while the dialog is open |
| One timeout after a coarse reading stops the repeats | false | rejected | Matches the frozen matrix ("error code 2 or 3 → no repeat"); raised with the owner for the pavement test |
| Missing `navigator.geolocation` shows the « introuvable » advice | low | rejected | Every target browser has the API; insecure contexts fail with code 1 instead |
| Coarse readings remembered for the admin marker | false | rejected | Unchanged behaviour (any reading was remembered before); the spec's Always keeps it, and a passing reading is the last one |
| NaN accuracy | false | rejected | `coords.accuracy` is a non-negative double by spec |
| Hidden page: an in-flight reading still completes | false | rejected | The matrix is about starting readings; none starts while hidden |
| Visibility re-check reads after a refusal when the Permissions API says granted | false | rejected | That is the Réglages round trip by design; one reading per return |
| Spies not restored after a failing assertion | low | rejected | Only matters on an already-failing test |
| Two StartScreen tests wait on real timers | low | rejected | They read `LOCATION_GATE_RETRY_MS`; moving the Dexie-backed screen to fake timers is not a direct correction |
| `visibilityState` redefined per test | false | rejected | Reset in `beforeEach`; Vitest isolates per file |
| `{ hidden: true }` queries could mask a hidden swipe | false | rejected | Required while Radix hides the page; the swipe's focus after close is asserted |
| « Réglages » vs Android « Paramètres »; raw metres | false | rejected | Verbatim copy from design.md and EXPERIENCE.md, owner-approved |
| Spec tasks unchecked | low | rejected | Bookkeeping; ticked |
| Intent alignment: tests run on a faked geolocation; device behaviour only in the manual check | — | noted | That is the owner's pavement test (HITL) |
