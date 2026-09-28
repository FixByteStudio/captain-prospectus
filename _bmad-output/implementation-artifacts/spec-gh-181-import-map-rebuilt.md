---
title: 'Import rebuilt: the map path (GH #181)'
type: 'feature'
created: '2026-09-28'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '96cfe6456f7e0ceede5cc077657441db21c280a5'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-174-context.md'
  - '{project-root}/docs/design.md'
  - '{project-root}/docs/adr/0020-google-places-as-a-second-map-provider.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Import's Zone step predates the #175 primitives: hand-spelled panels and status edges (#167), a toolbar whose action group cannot wrap and gives the page a horizontal scrollbar below ~480px (#28), a shape stroked with `--color-ring`, which turns near-white in dark mode over tiles that stay light (#27), no DOM test, a generic failure Alert that never names how many rows went in (deferred from #180), `Rayon 1.5 km` with an English decimal point, and a cached answer that says « actualisé sous 7 jours » instead of its age.

**Approach:** Rebuild MapStep's two halves on `Surface`, keeping every rule in design.md › "The map import" and ADR-0020; use `STATUS_EDGE`; let the action group wrap; give the canvas its own theme-invariant overlay tokens; route counts and the radius through fr-FR formatting; name the sent-row count on failure. MapCanvas keeps imperative ownership of Leaflet.

## Boundaries & Constraints

**Always:** Map and results side by side from `lg`, stacked below. Provider select above the map with its standing hint (Google cost wording unchanged); changing it clears polygon, circle and both search results. One toolbar slot under the map: standing fact (vertex count / radius) left, then « Annuler le dernier point » (polygon only), « Effacer », gold « Rechercher dans la zone ». Unnamed candidates listed struck through, « Sans nom », `STATUS_EDGE.rejected`, excluded from the found count and the import. Likely duplicates `STATUS_EDGE.follow_up` with « Semble déjà dans la liste : X », excluded unless the single checkbox is ticked; the tick belongs to one answer and a new search starts unchecked. Attribution only through the tile layer's `attribution` option. The canvas states it needs a pointer and names the CSV path as the keyboard alternative. Every French string in `copy.ts`; tokens only; admin stays out of the precache.

**Decision (owner, 2026-09-28):** the age comes from an additive, optional `cachedAt` (epoch ms, `z.optional(z.number())`) on `areaSearchResponseSchema`, set from `overpass_cache.created_at` on both cache-hit paths; the screen reads « Résultat en cache, obtenu il y a N jours » (hours under a day). Admin-only response, not the sync contract; docs/api.md gains the field. The spec is kept whole above the token guideline.

**Never:** No other worker, schema or sync change. No React control of the Leaflet canvas (no react-leaflet, no re-creating the map per render). No new dependency. No Stitch inventions (surface area in km², EPSG badge, numbered pins, per-row badges, "Étape 3").

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Provider switch | OSM, 3 vertices drawn, results shown; choose Google | vertex count gone, circle « Cliquez sur la carte… » shown, results panel idle (Google idle copy), Undo hidden | No error expected |
| Unnamed excluded | answer: 2 named + 1 unnamed | tally « 2 lieux trouvés » and « 1 sans nom »; unnamed row struck, « Sans nom »; button « Importer 2 prospects »; the POSTed rows omit it | No error expected |
| Likely opt-in | answer with 1 likely of 3 named | button « Importer 2 prospects »; tick → « Importer 3 prospects »; search again → checkbox unchecked, back to 2 | No error expected |
| Cached | `cached: true` | `cachedAt` 3 days ago → muted « Résultat en cache, obtenu il y a 3 jours »; `cachedAt` absent → the cached line without an age | No error expected |
| Radius | circle radius 1500 m | « Rayon 1,5 km » | No error expected |
| Import fails mid-way | 2nd batch 500 | Alert via `copy.import.failedAfter(progress.done)`; button « Réessayer » | retry re-sends from the start |
| Narrow | 320px viewport | toolbar actions wrap onto their own lines; no horizontal page scroll | manual check (happy-dom has no layout) |
| Dark mode | `data-theme="dark"` | polygon/circle stroke and handles keep their light-theme values | manual check |

</frozen-after-approval>

## Code Map

- `src/client/admin/import/MapStep.tsx` -- the whole step (396 lines). Keep `chooseProvider` (resets both shapes and both mutations), the `includedFor === search.data` opt-in keying, `searchError`, `toImportRow`. Rebuild: left = provider row, lede + pointer note, `MapCanvas` inside a `Surface` with `overflow-hidden`, toolbar `flex flex-wrap items-center gap-2` whose action span is `flex flex-wrap gap-2 sm:ml-auto` (#28). Right = `Surface` with tallies via `formatCount`, cached line, truncated Alert, Google attribution, bounded candidate `ul`, checkbox, progress, `failedAfter` Alert, Retour outline + Importer. `CandidateRow` → `cn("px-3 py-2", STATUS_EDGE.rejected|follow_up|new)` (#167; lines 356-360 today).
- `src/client/admin/import/MapCanvas.tsx:118-128` -- `readToken("--color-ring"/"--color-primary"/"--color-background")` → read new `--map-stroke`, `--map-fill`, `--map-handle` (#27). Everything else untouched.
- `src/client/styles/app.css` -- declare `--map-stroke: #1b2a4a; --map-fill: #c9a227; --map-handle: #ffffff` in the light `:root` only, with a comment: the canvas does not follow the theme because the tiles do not. Never redefined in the dark blocks (palette.test asserts those blocks stay identical; don't touch them).
- `src/client/admin/status.ts:15` -- `STATUS_EDGE`, reuse only.
- `src/client/format.ts:82` `formatCount`; radius decimals via `Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 })` or an existing helper.
- `src/client/copy.ts:415` `map` -- fix `circle.radius`, add `pointerOnly`, cached-with-age string; counts through `formatCount`.
- `src/client/admin/import/ImportScreen.tsx` -- unchanged except if MapStep's props change.
- `src/client/admin/queries.ts:270,289` -- `useOverpassImport` / `usePlacesImport`, read-only.
- new `src/client/admin/import/MapStep.test.tsx` -- mock `./MapCanvas` with a stub exposing buttons that call `onMapClick([lat,lng])` and printing `polygon.length` / `circle`; render `ImportScreen` (fork to map) with QueryClient + MemoryRouter + fetch stub as in `ImportScreen.test.tsx`. Radix Select: drive via keyboard on the combobox if pointer open fails in happy-dom.
- `src/shared/schemas.ts:757` `areaSearchResponseSchema` -- add `cachedAt`; `src/worker/routes/admin.ts:1261,1340` -- `cachedAt: hit.createdAt` on the two cache hits; tests in `src/worker/overpass.test.ts:237` / `places.test.ts`; `docs/api.md` -- the field.
- `docs/design.md:633` "The map import" -- update the step name (Zone), the canvas-colour rule, the narrow toolbar, the cached-age wording.

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/schemas.ts`, `src/worker/routes/admin.ts`, worker tests, `docs/api.md` -- additive `cachedAt`
- [ ] `src/client/styles/app.css` -- map overlay tokens (#27)
- [ ] `src/client/admin/import/MapCanvas.tsx` -- read them
- [ ] `src/client/copy.ts` -- radius fr-FR, pointer note, cached age, counts
- [ ] `src/client/admin/import/MapStep.tsx` -- rebuild on Surface, STATUS_EDGE (#167), wrapping toolbar (#28), `failedAfter`
- [ ] `src/client/admin/import/MapStep.test.tsx` -- every non-manual matrix row
- [ ] `docs/design.md` -- map import section
- [ ] PR body `Closes #167, #28, #27, #181`; names the happy-dom-untestable parts (Leaflet drawing, narrow layout, dark colours)

**Acceptance Criteria:**
- Given `pnpm test`, when the suite runs, then the new MapStep tests pass and every existing test passes unchanged.
- Given `pnpm build`, when the precache manifest is read, then its total is quoted against 1,000 KiB and no admin chunk is precached.
- Given `grep -n "inset_4px" src/client/admin/import`, then nothing matches.

## Implementation Notes

- Implemented by the pwa-engineer subagent. Orchestrator fix after reading the diff: the radius matrix row was only a `[\d,]+` regex, which « 1.5 » would not fail and « 1 » would pass; tightened to a literal decimal-comma assertion plus `radius(1500) === "Rayon 1,5 km"`.
- One existing test changed, deliberately: `palette.test.ts`'s "every light hex reappears in dark" skips the three `--map-*` tokens (#27 needs them light-only), and a new test asserts they stay absent from dark.
- `cachedAt` is sent by both `/import/overpass` and `/import/places` (they share `overpass_cache`); docs/api.md, docs/domains/ingestion.md and design.md say so.
- The map path gets its own `copy.map.failedAfter`: `import.failedAfter` tells the admin to re-import « le même fichier », and there is no file here.
- Review patches (triage rows 1-13) applied by the same subagent.
- Final verification: typecheck, lint, 75 files / 1,820 tests, build green. Precache 25 entries, 938.15 KiB of 1,000 KiB; no admin chunk in `dist/client/sw.js`. baseline_commit re-stamped at PR time from the merge-base with origin/main (unchanged: 96cfe64).
- Manual only (happy-dom has no layout or computed colour): the 320px toolbar and the dark-mode shape.

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped, not a sweep). Counts: high 0, medium 1, low 14, false 4, rejected-low 2. Routes: 13 patch, 2 defer, 0 loopback.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | vgap | Worker tests only check `typeof cachedAt`; `cachedAt: Date.now()` would pass and every week-old answer would read « moins d'une heure » | medium | patch: backdate the cache row, assert exact equality, both routes. |
| 2 | blind, edge, vgap, intent | Map failure Alert reuses `failedAfter`, which says « Réimporter le même fichier » on a path with no file | low | patch: `copy.map.failedAfter`. The old `import.failed` said the same, but this story chose the string. |
| 3 | blind, edge, vgap, intent | Hours rounded, then `<= 1` reads « moins d'une heure » up to ~1h29; days from rounded hours overstate at each day boundary | low | patch: floor from ms, a singular hour branch. |
| 4 | blind, vgap | Hours and under-an-hour branches untested; age expectation built from the copy under test | low | patch: literal-string cases at 10 min, 5 h, 3 days. |
| 5 | blind, vgap, intent, edge(claim) | `palette.test.ts` edited to skip the tokens, and nothing asserts they stay out of dark; the app.css comment overclaims | low | patch: assert `PINNED_DARK[name]` undefined. The edit is recorded as the one change to an existing test (#27 needs it). |
| 6 | blind | No-age fallback lost the 7-day bound | low | patch. |
| 7 | blind | Provider-switch tests depend on option order; the found tally's removal is only inferred | low | patch: pick the option by role and name; assert the tally is gone. |
| 8 | blind, edge | Radius test comment says "1500 m east"; points are ~1.3 km diagonal | low | patch (comment); the literal check was added in step 3. |
| 9 | intent | Candidate `ul` keeps its border inside the padded results Surface | low | patch: `border-y` only. |
| 10 | blind | `sm:ml-auto` (640px) drops right alignment from 480 to 640px | low | patch: `ml-auto … justify-end`, always. |
| 11 | blind, intent | pointerOnly comment cites ADR-0026 (field precache) | low | patch. |
| 12 | blind | `cachedAt` comment says absence is the screen's choice; api.md has no unit and names only Overpass | low | patch (comment and doc). Integer/non-negative check on a server-sent response rejected as low, not met in use. |
| 13 | blind | ingestion.md cache steps don't mention the age | low | patch (one clause each). |
| 14 | edge | Failure Alert discards the server's `ApiError` message (400/403/426) | low | defer: pre-existing (the old Alert showed `import.failed`), already logged from #180. |
| 15 | edge | After a failure, switching provider or searching again leaves the stale failure Alert and « Réessayer » | low | defer: pre-existing; the old MapStep had the same state flow. |
| 16 | blind | `--map-*` hexes duplicate palette values and can drift | false | Literal light values are the fix: a `var()` to a themed token would invert in dark, which is #27. |
| 17 | blind | Spec cited by the test header is not in the diff | false | Excluded from the review diff only; it is tracked and ships in the PR. |
| 18 | intent | Left Surface wraps only the canvas | false | The toolbar and lede are not panel content; design.md keeps the toolbar a slot under the canvas. |
| 19 | intent | pointerOnly line unrequested | false | Required by the spec's Always (EXPERIENCE.md: "the screen says so"). |
| 20 | intent | Count tests never cross 1,000, so fr-FR grouping is unasserted | low, rejected | `formatCount` has its own tests; 1,000+ candidates would need a truncated fixture for no behaviour gain. |
| 21 | intent | Edge classes and Surface unasserted in DOM | low, rejected | happy-dom evaluates no CSS; entry 11 is the human pass. `grep inset_4px` is the AC. |

## Design Notes

Gold stays on « Rechercher dans la zone » and « Importer N prospects », as today: the spine names the search gold, and the import is the step's commit; demoting either would be a behaviour change this rebuild doesn't own. The theme-invariant overlay is the fix #27 asks for: the tiles are always light, so a token that inverts is wrong for this surface only.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all green
- precache total from `dist/client/sw.js` -- expected: < 1,000 KiB, no admin chunk, quoted in the PR

**Manual checks:**
- `pnpm dev`, /admin/import → map at 320px (no horizontal scroll) and in dark mode (shape legible).
