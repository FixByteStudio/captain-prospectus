---
title: 'Admin Tournée du jour: map pane'
type: 'feature'
created: '2026-10-06'
status: 'done'
baseline_commit: '96eea454b1356a88956d3ea39bb3a83963ccb1d9'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-dashboard-redesign/epic-admin-round-view/story-admin-tourn-e-du-jour-map-pane.md'
  - '{project-root}/_bmad-output/forge/story-5-6-map-pane-decisions/forged-idea.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/admin/tournee` (story 5.5) lists an agent's stops for today but shows no map, so the admin cannot see where the round sits on the ground. Story #269, CAP-4 / CAP-11, EXPERIENCE.md Flow 3.

**Approach:** Put the field's `RoundMap` beside the list, imported statically, fed by `mapPins`/`walkingPath` over the same stops the list shows. The one shared-code change is `recentre` becoming optional (no button without it). The "gold pin 1 and path only with a stored position" rule lives in the admin. Forge decisions: `_bmad-output/forge/story-5-6-map-pane-decisions/forged-idea.md`.

## Boundaries & Constraints

**Always:** pins numbered in the list's order (a stop without coordinates keeps its number, draws no pin); with a position: pin 1 gold, the dashed path, the position marker; with none: `next: false` on every pin, an empty path, `position={null}`. Pins stay decorative (no `onSelect`). The map is keyed by the agent's email and mounts for any loaded round, zero pins included. Header and agent Select on top at every width; below `md` the map at a fixed 280 px, then the list; from `md` the list on the left, the map on the right and sticky. Tailwind tokens only. OSM attribution shows (invariant 11).

**Never:** no change to `mapPins`, `round-map.ts`, `src/shared/today.ts`, Carte or the visit side pane's behaviour; no assertion changed in their existing tests; no new prop on `RoundMap` besides making `recentre` optional; no lazy import of `RoundMap` from the admin; no Liste/Carte toggle; no polling.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Position today | stops + `position` | pins `index` = list number, pin 1 `next: true` (only the first list stop, if it has coordinates), path through the pins, position passed | — |
| No position | `position: null` | every pin `next: false`, `path` `[]`, `position` `null` | — |
| Stop without coordinates | stop #2 has `lat: null` | no pin for it; the next pin still reads 3 | — |
| Zero pins | empty round, or no coordinates | map mounted (default Brussels view, or centred on the position) | — |
| No agent / loading / error | before choice, query pending or failed | no map | ScreenState handles it |
| Agent change | Select picks another email | `RoundMap` remounts (new key) and refits | — |

</frozen-after-approval>

## Code Map

- `src/client/field/RoundMap.tsx` -- `recentre: () => void` → optional; render the re-centre `Button` only when given. Its doc comment and `onSelect` comment already describe the admin reuse; keep fit/draw logic untouched (it fits pins + position together, defaults to `DEFAULT_CENTER`/`DEFAULT_ZOOM`, centres on one point).
- `src/client/field/RoundMap.test.tsx` -- real Leaflet in happy-dom; existing tests pass `recentre={() => {}}`. Attribution test (`.leaflet-control-attribution` = `copy.attribution`) and null-position-no-marker test already exist; add the no-recentre case.
- `src/client/field/round-map.ts` -- `mapPins(now)`, `walkingPath(pins)`, `MapPin`. Reuse; do not edit.
- `src/client/admin/round/round-list.ts` -- `roundStops(data, now)`. Add the admin rule beside it: `roundMap(stops, position)` → `{ pins, path, point }` (no position ⇒ pins mapped to `next: false`, `path: []`, `point: null`; else `mapPins`, `walkingPath`, `{lat,lng}`).
- `src/client/admin/round/round-list.test.ts` -- add unit tests for `roundMap`.
- `src/client/admin/round/RoundScreen.tsx` -- `ScreenState` children: notice, then a two-column wrapper (`md:grid md:grid-cols-2 md:items-start gap-4`); DOM order map then list so phones get map first; on `md` place the list in column 1 and the map in column 2, row 1; map box `h-70` below `md`, `md:sticky md:top-4` with a viewport-tall height from `md`; `<RoundMap key={agent} … />` with no `recentre`, no `onSelect`. The `Surface` keeps `overflow-hidden`; wrap the map in a `Surface` too for the rounded border.
- `src/client/admin/round/RoundScreen.test.tsx` -- add `vi.mock("../../field/RoundMap", …)` capturing props and counting mounts (pattern: `src/client/field/CarteScreen.test.tsx:30-46`). Existing tests keep passing.
- `src/client/admin/AdminApp.test.tsx:105` -- renders RoundScreen at the prompt only (no map); no change expected.
- `docs/design.md` -- "The admin round view" section: replace "The map pane is story 5.6." with the pane's behaviour and widen the ASCII sketch.
- `scripts/check-precache.mjs` -- run after build; `RoundMap-*` must stay its own precached chunk, admin chunk out of the precache (ADR-0019).

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/field/RoundMap.tsx` -- make `recentre` optional; button only when set.
- [ ] `src/client/field/RoundMap.test.tsx` -- add: without `recentre` no button named `copy.carte.recentre` renders.
- [ ] `src/client/admin/round/round-list.ts` + `.test.ts` -- `roundMap` helper and its matrix rows (position, no position, uncoordinated stop keeps numbering).
- [ ] `src/client/admin/round/RoundScreen.tsx` -- layout and the keyed map.
- [ ] `src/client/admin/round/RoundScreen.test.tsx` -- mocked `RoundMap`: pin numbers follow the list, uncoordinated stop has no pin; with position: pin 1 gold, path set, position passed; without: no gold, `[]` path, `null` position; agent change remounts; absent before a choice; present for a loaded round with zero pins; no `recentre`/`onSelect` passed.
- [ ] `docs/design.md` -- the map pane's behaviour in the admin round view section.

**Acceptance Criteria:**
- Given Carte and the visit side pane, when their existing tests run, then they pass with no assertion changed.
- Given the build, when `pnpm check:precache` runs, then it passes and the total is quoted for `main` and the branch against 1,000 KiB.

## Implementation Notes

- Implemented by a subagent: `roundMap` in `round-list.ts`; `RoundScreen` grid with the map `Surface` first in DOM order (`h-70`, from `md` `sticky top-4`, column 2, `h-[80dvh]` — `SaveConfirmation.tsx` already uses `90dvh`).
- Making `recentre` optional broke typecheck in two field tests that call it; `props.recentre()` became `props.recentre?.()` in `CarteScreen.test.tsx:290` and `VisitScreen.test.tsx:1467`. No assertion changed.
- The remount test first passed without `key={agent}`: switching to an uncached agent shows the skeleton, which unmounts the map anyway. It now switches A → B → back to cached A, and fails without the key.
- Precache: **933.64 KiB on `main` (96eea45), 933.62 KiB on the branch**, of 1,000 KiB. Rollup folded the old `map-*` chunk (Leaflet, 146.08 KiB + 14.74 KiB CSS) and the 0.60 KiB `button-*` chunk into `RoundMap-*` (4.17 → 150.24 KiB): 27 → 25 entries, same bytes. Leaflet stays out of the entry chunk; `check:precache` finds no admin leak.
- Gates after review pass 1: typecheck, lint, 2185 tests, build, `check:precache` (933.67 KiB, 25 entries) green.

## Spec Change Log

## Review Triage Log

Pass 1 (2026-10-06, thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment): high 0, medium 1, low 6, false 4, maybe-false 0. Seven patches, the rest rejected. Verification-gap filed no gaps.

- medium, patch (blind): the no-position tests passed with the `next: false` override deleted (the first stop by name had no coordinates) — a coordinated first stop added in both test files; mutation-checked: deleting the override fails 2 tests.
- low, patch (blind): from `md` the DOM put the map before the list, against the visual order — list first in the DOM, map `order-first md:order-none`.
- low, patch (blind, edge): `h-70` and `md:h-[80dvh]` had no why — one-line comment (precedent for `dvh`: `SaveConfirmation.tsx`).
- low, patch (blind): design.md said zero pins show Brussels even with a position — now "or centred on the position", plus the pane's heights.
- low, patch (blind, intent): no admin test for zero pins with a position — added.
- low, patch (blind): path asserted by length only — exact coordinates in pin order.
- low, patch (blind): the remount test's first count passes without the key (skeleton remount) — comment says so; the cached switch-back proves the key.
- false (blind, intent R4): the `recentre?.()` edits in CarteScreen/VisitScreen tests are type-only; each still asserts `refresh` was called once, so no assertion changed or weakened (verification-gap confirmed).
- false (blind): story file's empty Plan and `tracker_status` — this workflow never writes the ticket; precache evidence goes in the PR.
- false (intent R1): admin tests check props, not real Leaflet — the ticket's AC asks for a mocked `RoundMap`; the rendered layout is story 5.7's Flow 3 run.
- low, reject (blind): no phone ASCII sketch — the prose states the order and height; a doc nicety.

## Design Notes

The admin wraps rather than changes the shared rule (forge E): `mapPins` keeps meaning "walking order from where the agent stands"; with no stored position the admin strips `next` and the path so the map does not imply a next step it cannot know.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:precache` -- all green; quote the precache total (also on `main` at the baseline) against 1,000 KiB.
