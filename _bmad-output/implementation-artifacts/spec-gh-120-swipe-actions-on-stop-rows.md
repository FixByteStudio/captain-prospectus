---
title: 'Swipe actions on stop rows (GH #120)'
type: 'feature'
created: '2026-09-26'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
baseline_commit: '98f3d6bfc9c84c534436dec33584817679115845'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A stop row after the next-stop card needs two taps to start work (expand, then
Visiter / Y aller). EXPERIENCE.md › Stop row and DESIGN.md › Stop row add a swipe as a second
way in: swipe left → Visiter, swipe right → Y aller, the row sliding to reveal the action panel.

**Approach:** A pointer handler with no library on StopRow's header button. The row slides with
the finger over a panel underneath; released past the commit distance it starts the action,
otherwise it snaps back. `touch-action: pan-y` leaves vertical scrolling to the browser, and a
gesture that starts vertical is never taken over. Tap-to-expand stays exactly as it is.

## Boundaries & Constraints

**Always:**
- **Invariant 2.** A swipe only starts Visiter (`navigate("/tournee/:id")`) or Y aller (open
  `navigationUrl(item)` in a new tab, `noopener`) — the same two destinations as `StopActions`.
  Nothing is written to Dexie.
- **The tap survives.** A press that never crosses the slop still produces the header's `click`
  and toggles `aria-expanded`; a gesture that did move horizontally suppresses that one `click`,
  so a swipe never also expands the row. The expanded panel's links are untouched by the handler.
- A gesture whose first decisive movement is vertical is ignored for its whole life;
  `pointercancel` (the browser took over for scroll) resets the row to rest.
- No coordinates → no Y aller: a right swipe does not move the row and starts nothing.
- Panels match the mock: a 96px `primary` panel on the right with a check and "Visiter", a 96px
  `secondary` panel on the left with the Navigation icon and "Y aller"; both `aria-hidden`
  (the tap path is the accessible one). Tokens only, strings from `copy.today`.
- Under `prefers-reduced-motion` the snap-back / reveal has no transition (`motion-safe:` or the
  existing app.css block) — the row still follows the finger.
- **ADR-0026.** Quote the precache total and the entry chunk. No new dependency.

**Never:**
- No swipe on NextStopCard, LaterRow or the Carte list — rows only.
- No long-press, no fling-velocity physics, no hover affordance.
- No change to `StopActions`, `navigationUrl`, `TodayScreen`'s one-expanded-at-a-time rule, or
  any server / sync code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Swipe left | pointer down, move −120px x / 4px y, up | navigates to `/tournee/{id}`; no expand | No error expected |
| Swipe right | move +120px x, stop has coords | `window.open(navigationUrl, "_blank", "noopener,noreferrer")`; row returns to rest | No error expected |
| Short swipe | move −40px x, up | snaps back, starts nothing, does not expand | No error expected |
| Vertical scroll | move 3px x / 60px y, then 150px x | never swipes, row never translates | No error expected |
| Tap | down/up within slop | `click` toggles expand as today | No error expected |
| Right, no coords | `lat: null`, move +120px | row stays at 0, nothing opens | No error expected |
| Browser cancels | `pointercancel` mid-drag | row back to 0, nothing starts | No error expected |
| Reduced motion | `prefers-reduced-motion: reduce` | release is instant, no transition | No error expected |

</frozen-after-approval>

## Code Map

- `src/client/field/StopRow.tsx:91-137` -- `StopRow`: `<li overflow-hidden rounded-xl border>` → header `<button onClick={onToggle}>` + `hidden` actions panel. Swipe goes on the header only: wrap it in a `relative` container with the two absolute panels behind and the button translated by `style={{ transform }}`. Keep `edgeFor`, `Distance`, `NotSyncedBadge`, `StopActions` exports unchanged (NextStopCard imports them). Update the file comment's "no swipe (story 117.3)".
- `src/client/field/today.ts:149` -- `navigationUrl(item)`, `null` without coords. Reuse; do not change.
- `src/client/field/TodayScreen.tsx:1-8, 153-164` -- renders `StopRow`s; only its header comment ("no swipe (story 117.3)") changes.
- `src/client/copy.ts:554-555` -- `copy.today.navigate` / `copy.today.visit` for the panel labels; no new string needed.
- `src/client/styles/app.css:452` -- global reduced-motion block already zeroes transitions.
- `src/client/field/StopRow.test.tsx` -- existing tap tests (`ControlledRow` in a `MemoryRouter`) must keep passing; add swipe tests here. happy-dom's `fireEvent.pointerDown/Move/Up` carry `clientX/clientY`; `setPointerCapture` may be missing, so call it optionally.
- `src/client/field/RoundMap.tsx:138` -- precedent for reading `prefers-reduced-motion` in JS, if needed.
- `docs/design.md:866-874` -- the stop-row paragraph; replace "Neither action needs a swipe (story 117.3 adds…)" with the shipped swipe rule.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/field/swipe.ts` -- pure gesture maths: slop (10px), axis lock (`|dx| > |dy|` once past slop), clamp (right clamped to 0 without Y aller, both to ±96px of travel beyond which it resists or clamps), and `swipeAction(dx, canRight)` → `"visit" | "navigate" | null` at the 96px commit -- testable without the DOM.
- [ ] `src/client/field/swipe.test.ts` -- unit-test the matrix's thresholds, axis lock and the no-coords clamp.
- [ ] `src/client/field/useSwipe.ts` -- hook returning pointer handlers, the current offset, a `dragging` flag and an `onClickCapture` that swallows the click after a horizontal gesture; resets on up and cancel -- keeps StopRow declarative.
- [ ] `src/client/field/StopRow.tsx` -- wire the hook into the header, add the two panels, `touch-[pan-y]` (or equivalent) on the button, `motion-safe:transition-transform` only while not dragging; Visiter via `useNavigate`, Y aller via `window.open`.
- [ ] `src/client/field/StopRow.test.tsx` -- DOM tests: each direction starts its action (navigation observed through a route in `MemoryRouter`, `window.open` spied), short swipe and vertical gesture start nothing and do not expand, tap still expands, no-coords right swipe opens nothing, `pointercancel` resets.
- [ ] `src/client/field/TodayScreen.tsx`, `docs/design.md` -- replace the "no swipe" wording with the shipped rule, one short paragraph.

**Acceptance Criteria:**
- Given a stop row on Tournée du jour, when the agent swipes it left past the commit distance, then the visit form for that stop opens.
- Given the same row, when the agent taps it without moving, then it expands exactly as before and nothing navigates.
- Given the field build, when `pnpm build && pnpm check:precache` runs, then the precache stays ≤ 1,000 KiB and the PR quotes it and the entry chunk.

## Implementation Notes

- Implemented by a pwa-engineer subagent from this spec; one follow-up added the reduced-motion matrix test (class present at rest, absent mid-drag, back on release; the global app.css block makes the release instant).
- Review pass 1 patches (triage rows 1–9) applied by the same agent. One follow-on fix by the orchestrator: the patch's "ignore pointerdown while a gesture is active" guard would wedge the row forever if a `pointerup` were lost inside the slop, so a primary pointerdown now always starts a fresh gesture (second fingers are never `isPrimary`, so row 3 still holds).
- Palette test rule 4 ("every gold fill carries primary-edge") required `ring-1 ring-inset ring-primary-edge` on the Visiter panel.
- Verified on the final tree: `pnpm lint`, `pnpm typecheck`, **1,484 tests / 64 files**, `pnpm build`, `pnpm check:precache` — all green. Precache **887.73 KiB**, 22 entries, against the 1,000 KiB ceiling. Entry `index-*.js` **388.91 kB / 123.76 kB gzip**, against **386.53 kB / 123.09 kB gzip** built from the baseline commit (**+2.38 kB / +0.67 kB gzip**).
- Deferred: the real-phone vertical-scroll check (triage row 16) to story 117.12.

## Spec Change Log

## Review Triage Log

### Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment)

Verdicts: high 0 · medium 3 · low 8 · false 3 · maybe-false 2.

| # | Finding (lens) | Verdict | Route | Evidence / action |
|---|---|---|---|---|
| 1 | `swiped` cleared only on the next `pointerdown`, so a keyboard / AT activation after a swipe is swallowed (EC, BH, VG, IA) | medium | patch | Confirmed in `useSwipe.ts` `onClickCapture`: nothing clears the flag. Swallow only `detail !== 0` clicks, then clear the flag |
| 2 | No test dispatches the click after a swipe; "does not expand" assertions are vacuous (VG, BH, IA) | medium | patch | Confirmed: `fireEvent.pointer*` never makes a click. Add `fireEvent.click` after short / committed swipes, plus a keyboard click (`detail: 0`) that still expands |
| 3 | Second pointer resets `start` mid-drag; right/middle mouse button starts a gesture (EC, BH) | medium | patch | Confirmed: `onPointerDown` ignores `isPrimary`/`button`/`pointerId`; a second finger re-bases dx and can commit the wrong action. Track the first pointer's id, ignore others and non-left buttons |
| 4 | A mouse drag that locks vertical still gets its click and expands the row (EC, IA) | low | patch | Confirmed for mouse/pen; contradicts design.md's "the tap it might otherwise fire is swallowed". Direct fix: any gesture past slop is not a tap — set `swiped` on vertical lock too |
| 5 | Visiter panel shows ClipboardCheck, spec/mock say a check, stacked | low | patch | Direct deviation from the spec's "a check"; swap to `CheckIcon`, stacked as in the mock |
| 6 | `clampOffset` doc says the row "resists"; it stops (BH) | low | patch | Comment correction |
| 7 | design.md omits the 10px slop / 96px commit (BH) | low | patch | One-line doc addition |
| 8 | Reduced-motion test name claims more than it checks (BH) | low | patch | Rename to what it asserts |
| 9 | No assertion that panels are `aria-hidden` and Y aller panel absent without coords (BH) | low | patch | Cheap assertion folded into the tests of row 2 |
| 10 | Row can stick half-open if pointer capture is missing/lost (EC, BH) | maybe-false | reject | `setPointerCapture` exists in every target browser; loss outside `pointerup` comes with `pointercancel`, which resets. Would settle: a device where capture is refused mid-drag. At most low |
| 11 | Visiter path / window.open duplicated beside `StopActions` (BH) | low | reject | No caller diverges today; fix adds a helper — low and not met in everyday use |
| 12 | No "armed" feedback at the commit point (BH) | low | reject | Not asked by intent, spec or mock; fix adds UI |
| 13 | `setOffset` on every pointermove re-renders the row (BH) | maybe-false | reject | Row is a handful of spans; no measured jank. Would settle: a profile on a low-end phone. At most low |
| 14 | Precache not quoted (BH) | false | reject | Quoted in the PR description by process (887.48 KiB at implementation) |
| 15 | Intent readings R2/R3 (reveal-then-tap) not implemented (IA) | false | reject | Frozen Approach says "released past the commit distance it starts the action" — R1 |
| 16 | Real-phone vertical-scroll check not done (IA) | medium (unverified) | defer | Needs a device; story 117.12 owns the device run |
| 17 | window.open from pointerup in standalone PWA differs from the anchor (IA) | maybe-false | reject | pointerup on touch is activation-triggering; standalone iOS opens both in Safari. At most low |
| 18 | Vertical test uses the mouse model, not pointercancel (IA) | false | reject | The pointercancel path has its own test; both paths are covered |

## Design Notes

Direction lock is the whole iOS answer the story's open question asked for: with `touch-action:
pan-y` the browser owns vertical pans and fires `pointercancel` when it starts one, so the handler
only has to (a) not move the row until the axis is decided, and (b) drop a gesture decided
vertical. Capture the pointer only once the gesture is horizontal, so a vertical start never
steals the scroll.

The click after a swipe: browsers still fire `click` on the button after `pointerup` when the
pointer did not leave it. Swallow it in the capture phase with a ref set when the gesture went
horizontal and cleared on the next `pointerdown`.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck` -- expected: clean
- `pnpm test` -- expected: all green, new swipe tests included
- `pnpm build && pnpm check:precache` -- expected: precache ≤ 1,000 KiB; record it and the entry `index-*.js` size (last quoted: 699.80 KiB precache, entry 386.07 kB / 123.02 kB gzip in spec-gh-119)

**Manual checks (if no CLI):**
- On a real phone (story 117.12 owns the device run): vertical scroll over the list never swipes a row.
