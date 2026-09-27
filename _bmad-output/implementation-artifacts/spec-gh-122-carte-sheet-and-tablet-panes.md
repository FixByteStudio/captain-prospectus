---
title: 'Carte sheet and tablet panes (GH #122)'
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
baseline_commit: 'ca7a50390a826e121cb9ebc558f985eb7a5bde59' # merge-base of feat/122-carte-sheet and main
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Carte (#121) draws the round but gives the agent no way to act from it: no next stop, no "Y aller" / "Visiter", pins are decorative, and at tablet width it is one full-bleed map instead of DESIGN.md's list-left / map-right panes.

**Approach:** Add a selected stop to Carte, defaulting to the next stop. Below 768 px a sheet above the tab bar shows it (number, name, "type · address", distance, "Pas encore envoyé", Y aller + Visiter); tapping a pin selects that stop. From 768 px the sheet is replaced by a left pane (≈ 40 %) listing the round — next-stop card then stop rows — with the map on the right; tapping a pin expands and scrolls to that stop's row. Build to `mockups/key-f2-carte.html` and DESIGN.md › Field shell, tablet.

## Boundaries & Constraints

**Always:**
- The sheet and the list read the same `useRound()` list and numbering as Tournée; reuse `StopNumber`, `NotSyncedBadge`, `Distance`, `StopActions`, `NextStopCard`, `StopRow` — never a second copy.
- The sheet always sits above the tab bar and never covers it; the attribution line and the re-centre control stay visible above the sheet.
- Offline, the sheet (phone) or the list (tablet) still renders; only the map is replaced by the offline notice, and no Leaflet map is created.
- Pins are keyboard reachable and named (stop number + name); selected state never changes pin colours (gold stays the next stop).
- Every French string in `copy.ts`; ≥ 48 px targets in the sheet and list.
- **Decision (owner, 2026-09-26): the sheet is a plain panel**, not shadcn `Sheet` (Design Notes).
- **Decision (owner, 2026-09-26): ADR-0026 as written.** "Out of the precache" meant out of the entry chunk: Leaflet stays out of the entry chunk and inside the shared lazy `map-*` chunk, which stays precached. The PR quotes the precache total and the entry chunk against the baseline 883.65 KiB (20 entries) / `index-*.js` 388.03 kB (123.62 kB gzip).

**Never:**
- No swipe (117.3), no visit map (117.9), no routing service, no new dependency, no server or sync change.
- No agent-side edit of shared data: the sheet only offers Y aller and Visiter (invariant 2).
- No drag-to-expand, no dismiss: the sheet is persistent.
- No change to admin `MapCanvas` or to Tournée du jour's behaviour.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Phone, open | 390 px, 3 due stops | sheet shows stop 1 (gold number), Y aller + Visiter → `/tournee/{id}` | — |
| Pin tap | tap pin 3 | sheet shows stop 3 (secondary number, its name/meta/distance/actions) | — |
| Selected stop leaves | selected stop 3 visited and synced away | sheet falls back to the next stop | — |
| No coordinates | selected/next stop has no lat | sheet shows Visiter full width, no Y aller | — |
| Empty round | no due stops | sheet shows `copy.today.empty`; no actions | — |
| Offline phone | `navigator.onLine` false | offline notice over the canvas + the sheet with the next stop | — |
| Tablet | ≥ 768 px | list left (next-stop card + rows), map right; no sheet | — |
| Tablet pin tap | tap pin 3 | row 3 expands (others collapse) and scrolls into view; pin 1 → the card | — |
| Tablet offline | ≥ 768 px, offline | list left, offline notice right | — |
| Resize | rotate phone ↔ tablet | map re-lays out to its new pane size (no grey strip) | — |

</frozen-after-approval>

## Code Map

- `src/client/field/CarteScreen.tsx` -- owns `selectedId: string | null` (null = next stop; resolved against `list.now`, so a vanished id falls back). Phone (`useIsMobile()` from `hooks/use-mobile.ts`, same 768 px as `md:`): `FULL_BLEED` becomes a flex column — map (or offline canvas) `flex-1 min-h-0`, then `<CarteSheet>` in flow with `-mt-3 relative z-10` so its rounded top overlaps the map by 12 px and the attribution/re-centre stay above it. Tablet: `md:grid-cols-5` — left `col-span-2 overflow-y-auto` list pane, right `col-span-3` map/offline canvas. Render the sheet or the list by `useIsMobile()`, never both (duplicate "Visiter" links in DOM). Keep `useCarteTop` and the height calc.
- `src/client/field/CarteSheet.tsx` (new) -- DESIGN.md `bottom-sheet`: `bg-card rounded-t-xl` top corners, 36×4 `bg-border` handle (decorative, `aria-hidden`), `shadow` upward, `px-4 pt-2 pb-3.5`. Row: `StopNumber` (`variant="next"` only for index 1), name (`text-base font-semibold`), meta line `copy.today.meta`, `NotSyncedBadge`, right-aligned `Distance`; then `StopActions` `mt-3`. A `<section aria-label={copy.carte.sheetLabel}>` with `aria-live="polite"` on the name block so a pin tap is announced. Plain panel, not shadcn `Sheet` (Design Notes).
- `src/client/field/CarteList.tsx` (new) -- tablet left pane: `NextStopCard` for `list.now[0]`, `StopRow`s for the rest (index `i + 2`), `copy.today.empty` when empty. `expandedId` controlled by CarteScreen (pin tap sets it; row toggle toggles it). On selection change, `scrollIntoView({ block: "nearest" })` the target (`behavior: "auto"` under reduced motion). "Plus tard" is not listed (no pin, not walkable).
- `src/client/field/RoundMap.tsx` -- new optional `onSelect?: (id: string) => void`. When set, markers are `interactive: true, keyboard: true`, with `title` = `copy.carte.pinLabel(index, name)` (add `name` to `MapPin`), and a `click` handler calling `onSelect(pin.id)`; without it, markers stay non-interactive (admin reuse). Add a `ResizeObserver` on the container calling `instance.invalidateSize()` (guarded when `ResizeObserver` is undefined). Pin taps must not count as a user move (they don't pan). Update the "No pin-tap selection yet" comment.
- `src/client/field/round-map.ts` -- add `name` to `MapPin`.
- `src/client/copy.ts` (`carte` block) -- `sheetLabel` "Arrêt sélectionné", `pinLabel(n, name)` "Arrêt {n} · {name}", `listLabel` for the tablet pane.
- `docs/design.md:879-938` -- update the Carte sketch and prose: the sheet, pin tap, tablet panes, offline sheet; drop "no pin-tap selection yet".
- `src/client/admin/import/MapCanvas.tsx`, `vite.config.ts`, `scripts/check-precache.mjs` -- do not edit.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/field/round-map.ts` + `round-map.test.ts` -- `name` on pins -- pin labels
- [ ] `src/client/field/RoundMap.tsx` + `RoundMap.test.tsx` -- `onSelect`, keyboard/title, `invalidateSize` on resize; tests: click on a marker calls `onSelect(id)`, no `onSelect` → non-interactive, a click does not stop auto-fit -- matrix "Pin tap", "Resize"
- [ ] `src/client/field/CarteSheet.tsx` -- the sheet -- CAP-7
- [ ] `src/client/field/CarteList.tsx` -- the tablet pane -- DESIGN.md tablet
- [ ] `src/client/field/CarteScreen.tsx` + `CarteScreen.test.tsx` -- selection state, phone/tablet composition; tests (mock `RoundMap` capturing `onSelect`, mock `matchMedia` for both widths) cover every matrix row except Resize
- [ ] `src/client/copy.ts` -- new strings
- [ ] `docs/design.md` -- Carte section -- CAP-11

**Acceptance Criteria:**
- Given the built app online at 390 px on a seeded round, when a pin is tapped, then the sheet shows that stop and the tab bar stays fully visible and tappable, in light and dark.
- Given 820 px, when Carte opens, then the list sits left and the map right, as DESIGN.md › Field shell, tablet describes.
- Given `pnpm build`, when `dist/client-chunk-modules.json` is read, then `leaflet` is only in `map-*.js` and the PR quotes the precache total and entry chunk.
- Given the branch, when lint, typecheck, test, build and `check:precache` run, then all pass.

## Implementation Notes

- Code lives in the worktree `/home/m0/PROJECTs/captain-prospectus-122` (branch `feat/122-carte-sheet`); run every command there. `_bmad-output` exists only in the main checkout `/home/m0/PROJECTs/captain-prospectus`. Do not commit, push or switch branches.

- Review patches 1–14 applied by the implementer. Final: lint, typecheck, 1,435 tests, build and check:precache green; precache 887.84 KiB (20 entries, baseline 883.65), entry `index-*.js` 388.08 kB / 123.64 kB gzip (baseline 388.03 / 123.62), `map-*.js` 149.59 kB / 43.73 kB gzip (the only chunk with `leaflet`), `CarteScreen-*.js` 9.30 kB / 3.53 kB gzip. Baseline re-stamped at PR time: merge-base still `ca7a50390a826e121cb9ebc558f985eb7a5bde59` (origin/main has since moved to 98f3d6b; not merged in). Manual browser checks (390/820 px, light/dark, offline) not run.

## Spec Change Log

## Review Triage Log

**Pass 1** (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Counts: high 1 · medium 3 · low 12 · false 0 · rejected-low 4 · defer 0. No intent_gap or bad_spec, so no loopback.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | BH, ECH | Pins cannot be activated from the keyboard | high | patch | Leaflet 1.9.4 `Marker.js:236` only sets `tabIndex`/`role=button`; `Map._fireDOMEvent` forwards `keydown` to the marker but nothing turns Enter/Space into `click`. Listen for `keydown` Enter/Space on the marker |
| 2 | ECH | Every re-render rebuilds all markers, dropping focus off the activated pin | medium | patch | `useRound` rebuilds `list` each render, so `pins` is a new array and RoundMap's draw effect clears the layer on each selection. Skip the redraw when the drawn content key is unchanged |
| 3 | BH, ECH | Crossing 768 px remounts `RoundMap` (pan lost, refit, comment + design.md claim otherwise); layout duplicated per branch | medium | patch | Phone and tablet branches put `RoundMap` at different tree positions. One tree: list slot, map-area slot (`online ? RoundMap : OfflineCanvas`), sheet slot |
| 4 | BH | A resize never refits an untouched map | low | patch | `invalidateSize` keeps centre/zoom; `lastFitKey` blocks a refit. On resize, refit the last points while `!userMoved` |
| 5 | BH | `aria-live` omits the stop number and distance | low | patch | Live region wraps only name/meta/badge. Move it to the whole summary row |
| 6 | BH | Tablet empty state drops the list landmark | low | patch | `CarteList` returns a bare `<p>` outside the section. Keep the section |
| 7 | self | Sheet shadow hardcodes `rgb(0 0 0 / .2)` | low | patch | CLAUDE.md: no hardcoded colours. Use `color-mix` over `--color-foreground` |
| 8 | VG, BH, ECH | Offline tests lost "RoundMap never rendered" and the "Voir la liste" href | medium | patch | Assertions deleted in the diff; `grep showList` finds no test. Restore on phone and tablet |
| 9 | VG, BH | "Never both" (one "Visiter") unasserted on phone | low | patch | Phone tests query only inside the sheet. Assert no list region and one "Visiter" link |
| 10 | VG, BH | Tablet row-header toggle never exercised | low | patch | Tablet tests only call `selectPin`. Click a header twice, and after a pin tap |
| 11 | VG | Resize test never checks `observe(container)` or `disconnect` | low | patch | Fake observer's `observe`/`disconnect` are no-ops |
| 12 | VG | Sheet distance and "Pas encore envoyé" never asserted | low | patch | All fixtures have `pending: false`, `distanceM: null` |
| 13 | VG | Denied notice untested on tablet | low | patch | Only the phone denied test exists |
| 14 | BH | "no onSelect" test asserts on an `onSelect` it never passed | low | patch | The class/title checks are real; drop the vacuous spy |
| 15 | BH, ECH | Re-tapping the already-selected pin does not re-scroll | low | reject | Needs a selection nonce; rare (scroll away, then tap the same pin) |
| 16 | BH | No selected-state cue on pins for assistive tech | low | reject | Intent keeps pin colours fixed; `aria-pressed` bookkeeping adds a branch for a cue the sheet/row already give |
| 17 | ECH | Stale `selectedId` reselects a stop that re-enters the round | low | reject | Needs a clear-on-leave branch; a stop leaving and re-entering within one Carte session is rare |
| 18 | IA | Tests stay at wiring level; layout, breakpoint and mock fidelity unverified | low | reject | Covered by the spec's manual browser checks (step 5), not unit tests |

## Design Notes

- **Sheet is a plain panel, not shadcn `Sheet`.** `Sheet` is Radix Dialog: it portals out of the pane, traps focus, dims the screen, locks scroll, and closes on any outside pointer — including a pin tap, the one interaction meant to update it. A persistent, non-modal panel that never opens or closes is a `<section>`, not a dialog; nothing shadcn ships fits it.
- **In flow, not overlaid.** Stacking the sheet below the map (with a 12 px overlap for the rounded corners) keeps Leaflet's attribution and the re-centre control above it without measuring the sheet's height.
- **Selection is an id, resolved each render.** `selected = list.now.find(s => s.id === selectedId) ?? list.now[0]`, so a sync that removes the stop needs no effect to reset it.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- expected: green
- `pnpm build && pnpm check:precache` -- expected: ≤ 1,000 KiB; record total, entry `index-*.js` raw/gzip, `map-*.js`, `CarteScreen-*.js` against the baseline.
- `node -e` over `dist/client-chunk-modules.json` -- expected: `leaflet` only in `map-*.js`.

**Manual checks:**
- Browser pane, `pnpm dev`, seeded round: 390×844 light and dark — tap pins, sheet follows, tab bar clear; 820×1180 — two panes, pin tap expands the row; offline at both widths.
