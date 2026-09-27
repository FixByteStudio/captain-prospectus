---
title: 'Visite tablet layout (GH #126)'
type: 'feature'
created: '2026-09-26'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: ['/home/m0/PROJECTs/captain-prospectus/_bmad-output/implementation-artifacts/epic-117-context.md']
baseline_commit: '183965110cff190af4e65ff2b2a8eee6df8d3cae' # merge-base of feat/126-visite-tablet and origin/main at branch time
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** From 768 px the visit is still the phone's single column stretched wide. DESIGN.md › Field shell, tablet and EXPERIENCE.md › Responsive ask for two columns: the form on the left, the prospect's history and a map on the right. Below 768 px there is no map.

**Approach:** From 768 px, `VisitScreen` becomes a two-column grid in the same `md:grid-cols-5` 40/60 rhythm Tournée uses, but mirrored: the form takes three columns on the left, and a sticky side pane takes two on the right. The pane holds Visites précédentes, then the map. It stays visible on both steps, since it is not part of the form. The map is Carte's `RoundMap`, loaded with `React.lazy`, so Leaflet stays in its shared lazy chunk and a phone never loads it for a visit. Below 768 px the screen is unchanged: history stays under step 1 and there is no map.

## Boundaries & Constraints

**Always:**
- Reuse `RoundMap` (no `onSelect`, so the pin is inert) and `useIsMobile()`. Never a second Leaflet component or copy of the history list; extract the history `<section>` into one component rendered in one slot per layout.
- Render the map only when `!isMobile && online` and the place has coordinates. Otherwise the slot is absent: no Leaflet instance and so no tile request offline. No new copy for an offline map, since EXPERIENCE.md approves none for the visit.
- Keep #125's `SaveConfirmation`, `save`, `pending` and `returnFocusTo` as they are. Keep #142's `script: script ?? null` in both `toVisit` calls. One outbox write path (`queueVisit`).
- Invariant 11: the attribution shows on the visit map (it comes with `RoundMap`'s tile layer).
- Every French string in `copy.ts`. Targets ≥ 48 px.
- **Decision (owner approved the spec without choosing, 2026-09-27; recommended option A applied):** the visit map's pin is the place's own pin as Carte draws it — `mapPins(useRound().list.now)` filtered to this id (walking-order number, gold only when it is the next stop), plus the agent's dot from the same `useRound()`, no path; a place not on today's `now` list gets no map. The full-length spec (~2,300 tokens) is kept.
- Quote the precache total and the entry chunk against the baseline: 892.82 KiB (22 entries), `index-*.js` 388.96 kB / 123.79 kB gzip, `VisitScreen-*.js` 20.30 kB, `map-*.js` (Leaflet only) 149.59 kB.

**Never:**
- No change to the phone layout, the form's validation, the draft, `db.ts`, `visit-draft.ts`, the sync payload or `app.css`.
- No new dependency, no server change, no routing service.
- No change to `RoundMap`'s behaviour for Carte, and no change to `CarteScreen`.
- No status colour on the pin (invariant 3).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Phone | 390 px, online | one column as today; history under step 1; `RoundMap` never rendered, lazy chunk never requested | — |
| Tablet step 1 | 820 px, online, place with coordinates | form left; right pane: Visites précédentes, then the map with the place's pin and the agent's dot | — |
| Tablet step 2 | 820 px, "Continuer" | questions left; the same side pane stays right | — |
| Tablet offline | 820 px, `navigator.onLine` false | history right; no map, no Leaflet instance | — |
| No coordinates | place with `lat` null | history right; no map | — |
| No history | tablet, no previous visits | `copy.visit.noPreviousVisits` in the pane | — |
| Save | tablet, confirm | Dialog as #125; one outbox row with answers and `scriptId` | failure stays in the dialog |
| Rotate | 820 → 390 px mid-form | map unmounts, history returns under step 1; every value in the form kept | — |

</frozen-after-approval>

## Code Map

- `src/client/field/VisitScreen.tsx`.
  - Wrap the header and the step content in the grid: `md:grid md:grid-cols-5 md:gap-6`, with the form `md:col-span-3`. The side pane is `md:col-span-2 md:sticky md:top-4 md:self-start`, the same pattern as `TodayScreen.tsx:143-152`.
  - The history `<section>` (`:524-555`) moves into `VisitHistory`. Render it under step 1 when `isMobile`, and in the pane otherwise.
  - The sticky action bar (`:560-591`) is `fixed inset-x-0`. From 768 px it spans only the form column (for example `md:sticky md:bottom-0` inside the left column). Keep `.above-tab-bar` below 768 px.
  - Keep the `key="continue"`/`key="save"` buttons and `saveButtonRef`.
- `src/client/field/VisitSidePane.tsx` (new). Props are `{ prospectId, history }`. It renders `<VisitHistory>`, then the lazy map: `lazy(() => import("./RoundMap").then(m => ({ default: m.RoundMap })))` inside `<Suspense fallback={null}>`, in a fixed-height, rounded, bordered box (`h-72`, `overflow-hidden`). It uses `useOnline()` from `../hooks/use-online` and, per Q1, `useRound()`, `mapPins` and `walkingPath` (no path for one pin).
- `src/client/field/RoundMap.tsx`. Unchanged unless Q1 is C. Its header comment already names this reuse.
- `src/client/copy.ts`. It needs no new string under A or B; reuse `copy.visit.previousVisits` and `noPreviousVisits`.
- `src/client/field/VisitScreen.test.tsx`.
  - Add an `asTablet()` helper. happy-dom's `matchMedia` is 1024 px, which is already tablet, and `asPhone()` exists at `:132`.
  - Mock `./RoundMap` as `CarteScreen.test.tsx:36` does, and mock `../hooks/use-online` and `./useRound` for the matrix rows.
  - Route the existing save tests through unchanged. They must stay green, including #142's answers-and-`scriptId` read-back.
- `docs/design.md`. Under the visit section, add a "From 768px, the form sits left, history and map right" paragraph with the lazy-map and offline reasons. Update the RoundMap comment reference if one names 117.9.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/field/VisitSidePane.tsx`: history, then the lazy map with its gates (online, tablet, coordinates).
- [ ] `src/client/field/VisitScreen.tsx`: the two-column grid, history in one slot per layout, and the action bar held to the form column from 768 px.
- [ ] `src/client/field/VisitScreen.test.tsx`: one test per matrix row. Assert `RoundMap` is never rendered on a phone or offline. Keep every #125 and #142 test green.
- [ ] `docs/design.md`: the tablet visit paragraph (CAP-11).

**Acceptance Criteria:**
- Given the built app at 820 px online, in light and dark, when a visit opens, then the form sits left and the history and map sit right, following DESIGN.md › Field shell, tablet. The form column matches the `key-f3-f5-visit.html` frames, which show the phone only.
- Given 390 px, when a visit opens, then no map shows and the network panel lists no `map-*`/`RoundMap-*` chunk fetch or tile request.
- Given the branch, when `pnpm lint`, `typecheck`, `test`, `build` and `check:precache` run, then all pass. The precache must be ≤ 1,000 KiB. `leaflet` must appear only in `map-*.js` of `dist/client-chunk-modules.json`, never in `index-*.js`.

## Implementation Notes

- Implemented directly in the orchestrating session. The owner did not ask for subagents, as with #125.
- Layout switches on `useIsMobile()`, not `md:` classes alone. The history moves between two slots, and the pane must not mount on a phone, because it loads Leaflet.
- The history `<section>` moved verbatim to `VisitHistory.tsx`. `VisitSidePane.tsx` holds the history plus `VisitMap`, and `useRound()` runs only inside `VisitMap`, i.e. only online from 768px.
- The action bar is `fixed inset-x-0 px-4` below 768px, as before, and `sticky` in the form column from 768px. `.above-tab-bar` already sets `bottom: 0` there.
- The build split `RoundMap.tsx` into its own `RoundMap-*.js` chunk (4.26 kB), shared by Carte (static) and the visit pane (lazy), and `round-map.ts` into `round-map-*.js`. Leaflet is still alone in `map-*.js`.
- Size: precache 894.69 KiB / 1,000, 25 entries (baseline 892.82, 22, +1.87). Entry `index-*.js` 389.10 kB / 123.81 kB gzip (baseline 388.96 / 123.79). VisitScreen 21.65 kB (baseline 20.30). CarteScreen 4.79 kB (baseline 8.98; RoundMap left it). `map-*.js` 149.59 kB, unchanged.
- Mutation checks: dropping the `online` gate, or the no-pin guard, each fails one test.
- Verification: lint, typecheck, 1,562 tests / 64 files, build, check:precache all green.
- After review patches: lint, typecheck, 1,564 tests / 64 files, build, check:precache green. Precache 894.94 KiB / 1,000, 25 entries (baseline 892.82, 22, +2.12). Entry `index-*.js` 389.10 kB / 123.81 kB gzip (baseline 388.96 / 123.79). VisitScreen 21.90 kB (baseline 20.30). RoundMap 4.26 kB (new chunk). `map-*.js` 149.59 kB, unchanged, and the only chunk holding `leaflet`.
- Manual browser check NOT run: seeding needs a local `.dev.vars`, and creating one from the example was declined in this session. Story 117.12 runs the real-device check.
- Baseline re-stamped at PR time: merge-base with `origin/main` is still `183965110cff190af4e65ff2b2a8eee6df8d3cae`. Main moved to `8add33f` (#163), which merges cleanly (`git merge-tree`), so the branch was not re-based.

## Spec Change Log

## Review Triage Log

**Pass 1** (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Counts: high 0 · medium 1 · low 9 · false 6 · rejected-low 5. There was no intent_gap or bad_spec, so no loopback. The implementation was inline, so the orchestrator applied the patches.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | ECH | A rejected lazy `RoundMap` import unmounts the whole visit and loses the draft | medium | patch | `grep` finds no error boundary in `src/client`. Added `MapBoundary`, which renders null, around the map box. A test throws from `RoundMap` and asserts the pane and the checked outcome survive; removing the boundary fails it |
| 2 | VG | Phone step 2 must show no history; untested | low | patch | Added an `asPhone()` step-2 test: no `previousVisits`, no complementary, no `RoundMap` |
| 3 | VG | The map's `recentre` wiring is untested | low | patch | The mock's `refresh` is now a `vi.fn()`; the test calls `props.recentre()` and asserts it once |
| 4 | BH | design.md calls the map "inert", but re-centre and the agent's dot remain | low | patch | Reworded: the pin selects nothing, no path, re-centre and dot stay as on Carte |
| 5 | BH | The `<aside>` landmark has no name | low | patch | `aria-labelledby` points at the history heading (`useId`); asserted by role and name |
| 6 | BH | The `App.tsx:66` comment says Leaflet/RoundMap live in the Carte chunk | low | patch | RoundMap is now its own chunk, shared with the visit pane. Comment updated |
| 7 | IA | design.md's action-bar paragraph still reads as a fixed bar from 768 px | low | patch | One clause added pointing at the visit's sticky-in-column bar |
| 8 | BH | Redundant `round.now = []` in a test | low | patch | Deleted |
| 9 | BH, ECH, VG | The pane takes a second position reading through `useRound()`; its dot may differ from the visit's own `point` | low | reject | The frozen decision (option A) takes the dot from `useRound()`, as Carte and Tournée each take their own reading (design.md, Carte). Walking-order numbering needs `useRound`'s position anyway. The saved visit's position is unchanged |
| 10 | BH, ECH | A place in `list.later` gets no map | low | reject | The frozen decision says a place not on `now` gets no map. A later follow-up cannot be opened from Tournée or Carte |
| 11 | BH | A long history makes the sticky pane's bottom unreachable | low | reject | A sticky item taller than the viewport scrolls into view as its column ends. A `max-h` needs the band's measured height (Carte's `useCarteTop`), which is complexity for a rare case |
| 12 | BH | Auto-fit frames the agent's dot as well as the place | low | reject | The agent is normally standing at the place during a visit. This is `RoundMap`'s shared behaviour, and Carte is unchanged |
| 13 | BH | No tests for offline mid-visit or phone-to-tablet rotation | low | reject | `useOnline` gating is one conditional, already covered at mount. Tablet-to-phone rotation is tested |
| 14 | BH | The `useRound` mock is partial and untyped | low | reject | Only three fields are read. Typing it to the full `RoundState` adds fixture noise for no caught defect |
| 15 | BH | The pane mounts for a missing place | false | reject | `VisitScreen` returns the not-found view before the grid once `settled && !name`. Before settle, the pane shows the empty history for one read |
| 16 | BH | `above-tab-bar` is kept on the tablet bar; Notes may sit under the sticky bar | false | reject | The class supplies `bottom: 0` plus the safe-area inset from 48rem (app.css:411-415), which is what sticky needs. A sticky bar in flow after the content never overlaps it |
| 17 | BH, IA | The precache total is not quoted; chunk membership is unverified | false | reject | Recorded in Implementation Notes and quoted in the PR. `client-chunk-modules.json` shows `leaflet` only in `map-*.js` |
| 18 | BH, IA | Existing tests now run the tablet layout by default | false | reject | happy-dom was already 1024 px, the Dialog path, before this change. Phone paths are asserted by `asPhone()` tests, now including step 2 (row 2) |
| 19 | IA | The layout uses `useIsMobile()` rather than `md:` classes | false | reject | The intent fixes the 3/2 split at 768 px, which this implements. JS is required because the pane must not mount on a phone (Implementation Notes) |
| 20 | IA | design.md cites "spec-gh-126", which is not a repo file | false | reject | This is the standing convention (spec-gh-121/122/125 are cited the same way) |

## Design Notes

- **Lazy, not static.** A static `RoundMap` import from `VisitScreen` would pull Leaflet (≈150 kB) into every visit a phone opens, only to render nothing. `React.lazy` keeps it off the phone path. It stays precached (ADR-0026), because `map-*` and the RoundMap chunk are not admin-only, so the tablet map still works after the first offline launch.
- **The pane is outside the form's steps.** History is context, not a question. On a tablet it stays in view while the agent answers step 2, which is the reason for a second column at all.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test`: expected green.
- `pnpm build && pnpm check:precache`: expected ≤ 1,000 KiB. Record the total, `index-*.js` raw/gzip, `VisitScreen-*.js`, `map-*.js` and any new `RoundMap-*.js` against the baseline.
- `node -e` over `dist/client-chunk-modules.json`: expected `leaflet` only in `map-*.js`.

**Manual checks:**
- In the browser pane, with `pnpm dev` and a seeded round, check 820×1180 light and dark on steps 1 and 2, then offline. Check that 390×844 has no map. Rotate mid-form and confirm the draft is intact.
