---
title: 'Carte: lazy map and tab (GH #121)'
type: 'feature'
created: '2026-09-26'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-117-context.md']
baseline_commit: '908cc8011fc83feaaafb29d4204154fbefe5908b' # was cc1295cfa4b93bc2a39cd715433fd319490866ba (branch cut); moved by the merge of origin/main (#119, #125, #146)
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The field app has no map of the round. DESIGN.md and EXPERIENCE.md give the tab bar a Carte slot, but `tabs.ts` leaves it out until the screen exists. The visit tablet pane (story 9) and the admin round view both need a shared map component.

**Approach:** Add `/tournee/carte` as a lazy route and a Carte tab (second slot, `Map` icon). The screen draws today's walking order on Leaflet from a shared `RoundMap`. It has numbered pins (gold for the next stop, card-coloured for the rest), the agent's position dot, a 3px dashed gold straight-line path through the stops, OSM attribution and a 44px "Me recentrer" button. Offline, it shows a grey canvas with "Carte indisponible hors ligne. La liste reste à jour." and "Voir la liste", and it mounts no Leaflet map, so no tile request is made. Build to `mockups/key-f2-carte.html`, without the sheet (story 5).

## Boundaries & Constraints

**Always:**
- The walking order and numbering come from the same `buildTodayList` result that Tournée du jour renders. Share it with a hook; never re-derive it.
- Plus tard stops get no pin. A stop without coordinates gets no pin, but keeps its number in the sequence.
- Leaflet stays out of the entry chunk.
- The attribution is Leaflet's own control, fed `copy.attribution` (invariant 11). Tiles are OSM and load only online. They are never bulk-cached, and `runtimeCaching` stays `[]`.
- Colours come from tokens read at runtime (MapCanvas's `readToken` pattern), never hexes.
- Every French string is in `copy.ts`.
- Targets are ≥ 44px on the map (DESIGN.md) and ≥ 48px elsewhere.
- **Decision (owner, 2026-09-26): ADR-0026 as written.** The Carte route and `RoundMap` + Leaflet are lazy chunks, and both stay precached, so "out of the precache" is not in scope. `globIgnores` stays `AdminApp-*` only. The Leaflet chunk is shared with the admin side.
- Quote the precache total and the entry chunk in the PR, against the baseline of 695.50 KiB / 381.79 kB (121.44 kB gzip).

**Never:**
- No bottom sheet, no pin-tap selection and no tablet two-pane layout (story 5).
- No visit map (story 9), no swipe, no routing service (ADR-0002) and no new dependency.
- No `watchPosition`: position stays a one-shot `useAgentPosition` reading.
- Do not restyle tiles for dark mode (#27 stays open).
- Do not change admin `MapCanvas` behaviour.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Online round | 3 due stops with coords, position known | Pins 1 (gold, 34px), 2 and 3 (card, 28px), dashed path 1→2→3, position dot, attribution; view fits pins + position | — |
| Stop without coordinates | stop 2 has `lat` null | Pins 1 and 3 only, labelled 1 and 3; path 1→3 | — |
| Plus tard | a future follow-up | no pin | — |
| Position denied | geolocation refused | no dot; the same notice + "Réessayer" as Tournée, over the top of the map; pins still shown | — |
| Re-centre | tap "Me recentrer" | asks for a fresh position and pans to it; without a position, fits the pins | — |
| Offline on open | `navigator.onLine` false | grey canvas, notice card, "Voir la liste" → `/tournee`; no Leaflet map is created | — |
| Goes offline | online → `offline` event | map unmounts, notice shows; back online → map remounts | — |
| Empty round | no due stops | map centred on position, else Brussels default; no pins | — |
| Tab | on `/tournee/carte` | Carte tab `aria-current="page"`, band subtitle "Carte"; Tournée tab not current | — |

</frozen-after-approval>

## Code Map

- `src/client/field/TodayScreen.tsx:56-86` -- move the position, `now`, three `useLiveQuery`s and `buildTodayList` into a new `src/client/field/useRound.ts` (`useRound()` → `{ list, point, locating, denied, refresh }`). TodayScreen then calls the hook; its behaviour is unchanged.
- `src/client/field/round-map.ts` (new, pure) -- `mapPins(now: TodayItem[])` → `{ id, index, lat, lng, next }[]` (index = position in `now` + 1; skips null coords) and `walkingPath(pins)` → `[lat,lng][]`. Unit-tested.
- `src/client/field/RoundMap.tsx` (new, shared) -- a Leaflet component in MapCanvas's pattern: the map is created once in an effect, refs are driven imperatively, reduced motion is honoured, and it uses `L.divIcon` pins/dot (no image URLs) and `L.polyline` (`weight 3`, `dashArray "7 6"`, `--color-primary`). It sets `zoomControl: false` and `attributionControl.setPrefix(false)`, uses the OSM tile layer with `copy.attribution`, and imports `leaflet/dist/leaflet.css`. Props: pins, path, position, a `recentre` trigger. The re-centre control is a vendored shadcn `Button` (44px, `bg-card`, `LocateFixed`, `aria-label` = `copy.carte.recentre`), absolutely positioned at bottom right.
- `src/client/field/CarteScreen.tsx` (new) -- `useRound()` + `useOnline()`. Online → `<RoundMap>`; offline → a `bg-secondary` canvas and a centred card (a 44px `secondary` icon tile with `Map`, the notice, and a full-width secondary `Link` "Voir la liste" with `Route` → `/tournee`). The position-denied line is an overlay card at the top. The screen is full-bleed: it cancels `main`'s `px-4 pt-6` and fills the height down to the tab bar with `calc()` off `--spacing-band-height`/`--spacing-tab-bar-height` + safe-area (app.css:218-219, 437), with no hard-coded px.
- `src/client/App.tsx:47-80,94-100` -- add `const CarteScreen = lazy(...)` and a `path="carte"` route before `:id` under `Suspense`, plus the `useMatch("/tournee/carte/*")` → `copy.nav.subtitle.map` subtitle.
- `src/client/field/tabs.ts` -- insert Carte second (`/tournee/carte`, `Map as MapIcon`, `end: false`) and drop the "No Carte tab" comment. `isCurrentTab` already handles the subtree.
- `src/client/copy.ts:43-55,512` -- add `nav.subtitle.map`, `nav.tabs.map` "Carte", and a `carte` block: `offline`, `showList` "Voir la liste", `recentre` "Me recentrer", and the map's aria label.
- `src/client/admin/import/map.ts:30-31` -- reuse `DEFAULT_CENTER`/`DEFAULT_ZOOM` (a pure module) rather than a second Brussels constant.
- `src/client/admin/import/MapCanvas.tsx` -- reference only (the pattern and `readToken`); do not edit.
- `vite.config.ts` / `config.test.ts` / `scripts/check-precache.mjs` -- do not edit. The shared Leaflet chunk is precached by ADR-0026's design.
- `docs/design.md:747+,1109-1180` -- add a "### Carte" section (sketch, pins, path, offline, re-centre) and update the Tab bar section and its sketch (Carte is now shipped, 3–4 slots).

## Tasks & Acceptance

**Execution:**
- [x] `src/client/field/useRound.ts` + `TodayScreen.tsx` -- extract the hook -- one source for the walking order
- [x] `src/client/field/round-map.ts` + `round-map.test.ts` -- pins/path helpers; tests for matrix rows 1–3 -- pure rules
- [x] `src/client/field/RoundMap.tsx` -- shared Leaflet component -- CAP-7, reuse by story 9 and admin
- [x] `src/client/field/CarteScreen.tsx` + `CarteScreen.test.tsx` -- the screen; the DOM tests `vi.mock("./RoundMap")` and cover offline on open (notice, link href, RoundMap never rendered), online (RoundMap gets the pins), the online→offline swap, position denied, and the empty round -- matrix
- [x] `src/client/App.tsx`, `tabs.ts`, `tabs.test.ts`, `FieldTabs.test.tsx`, `copy.ts` -- route, tab, subtitle, copy; the tab tests assert the order Tournée, Carte, Ajouter[, Tableau de bord] and the current-tab state on `/tournee/carte` -- CAP-5
- [x] `docs/design.md` -- the Carte section and the Tab bar update -- CAP-11

**Acceptance Criteria:**
- Given `pnpm build`, when `dist/client-chunk-modules.json` is read, then no `leaflet` module is in the entry `index-*.js`, and the PR quotes the precache total and the entry chunk.
- Given the built app online at 390px in light and dark, when Carte opens on a seeded round, then it matches `key-f2-carte.html` (minus the sheet) with the attribution visible.
- Given airplane mode, when Carte opens, then the notice shows and the network panel lists no `tile.openstreetmap.org` request.
- Given the branch, when lint, typecheck, test, build and `check:precache` run, then all pass.

## Implementation Notes

- Implemented by a pwa-engineer subagent from this spec. `RoundMap` imports `DEFAULT_CENTER` from `admin/import/map.ts`, so Rollup names the shared Leaflet chunk `map-*.js`. It holds Leaflet plus that pure module, and `CarteScreen-*.js` holds no `leaflet`. A new `icon-map` button size (44px) was added to `button-variants.ts` for map-floating controls.
- The matrix audit (on diff read) found untested rows: the position dot/attribution/fit, Re-centre, the remount when the network comes back, and the "Carte" subtitle. It also found that Re-centre with no position waited 10 s before fitting the pins. The implementer added `RoundMap.test.tsx` (real Leaflet in happy-dom, 10 tests), made the no-position re-centre fit at once, extended the offline test with the remount, and added an App subtitle test. The coordinator added the Plus tard no-pin case to `CarteScreen.test.tsx`. The design.md sketch was realigned.
- Size: precache 864.71 KiB (baseline 695.50, +169.21), entry `index-*.js` 383.13 kB / 121.94 kB gzip (baseline 381.79 / 121.44), shared `map-*.js` ≈ 149.9 kB / 43.9 kB gzip.
- Files: `round-map.ts`, `round-map.test.ts`, `useRound.ts`, `RoundMap.tsx`, `RoundMap.test.tsx`, `CarteScreen.tsx`, `CarteScreen.test.tsx`, `TodayScreen.tsx`, `tabs.ts`, `tabs.test.ts`, `FieldTabs.test.tsx`, `App.tsx`, `App.test.tsx`, `copy.ts`, `ui/button-variants.ts`, `docs/design.md`.
- Review patches applied by the implementer (all 10 patch rows). Final: lint, typecheck, 1,252 tests, build and check:precache green; precache 865.31 KiB (19 entries), entry `index-*.js` 383.13 kB / 121.94 kB gzip, `map-*.js` 149.88 kB / 43.88 kB gzip, `CarteScreen-*.js` 6.13 kB. `leaflet` sits only in `map-*.js`. The manual browser checks (390px light/dark, airplane mode) have not run yet.
- Merged origin/main (`e42e0f6`). There was one conflict, in TodayScreen, and both sides are kept: `useRound()` now also returns `now` and `outboxVisits` for the daily progress line. Afterwards: 1,348 tests pass, precache 879.11 KiB (20 entries), entry chunk 387.64 kB / 123.48 kB gzip. PR #149 is updated.

## Spec Change Log

## Review Triage Log

**Pass 1** (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Counts: high 2 · medium 3 · low 8 · false 1 · rejected-low 8 · defer 1. No intent_gap or bad_spec, so no loopback.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | BH, ECH, VG | Initial fit latches on the first render, before the live queries and position resolve, so Carte opens on Brussels | high | patch | `useLiveQuery(..., [], [])` returns `[]` first and `point` starts null; `fitted` set at RoundMap.tsx:175. Refit on each new point set until the agent moves the map |
| 2 | BH, ECH, IA | Re-centre button and denied card paint under Leaflet's panes | high | patch | leaflet.css:107 `.leaflet-pane {z-index:400}`, and the container has no stacking context. `isolate` on the container, `z-10` on the button |
| 3 | BH, ECH, VG | Re-centre: late readings ignored, the comment is wrong, the fallback drops the known position | medium | patch | The effect at :188 bails when the timer is null. Replaced with a `pendingRecentre` ref; the fallback fits pins + position |
| 4 | BH, ECH | Full-bleed height ignores SyncStrip/UpdatePrompt; the button and attribution slide under the tab bar | medium | patch | Both render in flow above `<main>` (App.tsx FieldFrame); the strip always shows offline. Sized from the measured top |
| 5 | VG | Wiring untested: position, recentre, Réessayer; the route rendering CarteScreen; the 10 s fallback | medium | patch | Tests added |
| 6 | BH, IA | Button overlaps the bottom-right attribution (invariant 11) | low | patch | Both sit at the container's bottom-right. Button raised |
| 7 | ECH | fitBounds on identical points zooms to 19 | low | patch | `maxZoom: POINT_ZOOM` |
| 8 | BH | design.md: "never downloads Leaflet"; "can never number differently"; "one fresh reading" | low | patch | Precached (ADR-0026); each screen takes its own reading; `maximumAge` 120 s. Reworded |
| 9 | BH | Glossary has no row for the Carte screen; "Carte" already names the osm source | low | patch | glossary.md:61. Row added |
| 10 | BH, VG, IA | Stale CarteScreen.test header | low | patch | RoundMap.test.tsx exists |
| 11 | ECH | Denied card shows while a stale `point` is drawn | low | reject | Needs a new state branch; same behaviour as TodayScreen, and rare (a later failed refresh) |
| 12 | ECH | No gold pin when the next stop has no coordinates | low | reject | Numbering follows the list by design; handling it adds a branch |
| 13 | BH | Markers redrawn on every render | low | reject | Tens of markers; memoising adds complexity for no seen cost |
| 14 | BH, IA | `readToken` hex fallback | low | reject | MapCanvas's existing pattern; only hit with no stylesheet (tests) |
| 15 | BH, IA | Field imports `admin/import/map` | low | reject | The spec's Code Map chose that reuse; it is a pure module |
| 16 | BH | Denied card lacks `role=status`; hand-rolled link button | low | reject | Copies TodayScreen's existing pattern |
| 17 | IA | Offline canvas flat rather than striped | low | reject | The intent says "grey canvas"; the stripe is mock texture |
| 18 | IA | "Online but no connectivity" still mounts the map | false | reject | The matrix defines offline as `navigator.onLine` false; tiles simply fail |
| 19 | ECH | No error boundary if the lazy chunk fails to load | medium (unverified) | defer | Pre-existing: Visit and Ajouter lazy routes have none either; the chunk is precached |
| 20 | BH | Offline canvas/strip overflow | low | patch | Covered by #4 |

## Design Notes

- The path joins stops, not the agent. The mock's polyline starts at pin 1, not at the position dot, and a straight segment from the agent would look like a route.
- Offline means the map is **not mounted**, rather than mounted with its tiles failing. That is the only way to guarantee "no tile request" when Leaflet requests tiles on every pan.
- Pins use `L.divIcon` with Tailwind classes in the source (Tailwind v4 scans them), so the pins pick up the theme tokens and need no image assets.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- expected: green
- `pnpm build && pnpm check:precache` -- expected: ≤ 1,000 KiB. Record the total, the entry `index-*.js` raw/gzip and the Leaflet chunk against the baseline of 695.50 KiB / 381.79 kB / 121.44 kB gzip.
- `node -e` over `dist/client-chunk-modules.json` -- expected: the entry chunk lists no `leaflet`.

**Manual checks:**
- In the browser pane, at 390×844 in light and dark on a seeded round (`pnpm dev`): Carte online (pins, path, dot, attribution, re-centre), then go offline and confirm the notice and that no tile request appears in the network log.
