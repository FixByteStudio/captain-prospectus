---
title: 'Outcome tokens and admin-chunk guard (GH #105)'
type: 'feature'
created: '2026-09-26'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: []
baseline_commit: '0721a71422e7efd035b86c0ee6f6b83b498b186f'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `app.css` still carries the pre-#91 `outcome-*` values, and `palette.test.ts` never asserts the 3:1 rule #91 settled (#100). Separately, `check-precache.mjs` only catches an admin-only module leaking into the field precache once it pushes the total past 1,000 KiB, which leaves 322 KiB of silent room before Recharts lands (#95).

**Approach:** Copy DESIGN.md's six outcome hexes into `app.css` and add the per-theme 3:1 assertion. Have the build write a map of the modules in each client chunk, outside `dist/client`, and make `check-precache.mjs` fail when any precached chunk holds an admin-only package. The story folds #100 and #95 into one change (epic decision, 2026-09-26).

## Boundaries & Constraints

**Always:** DESIGN.md hexes verbatim (the table in Code Map). Assert light against `card` and dark against `card-dark` via the existing `THEMES`. The guard fails closed: a missing map, or a precached `.js` with no entry in it, is a failure. `pnpm build` and `pnpm check:precache` pass on the branch. Update `docs/design.md` in the same change.

**Never:** No series-against-series assertion, which is unachievable by construction (#91). Do not move `warn` or `success`. No outcome-badge or chart component work. Do not add Leaflet, Radix or sonner to the admin-only list: Leaflet and Radix are shared on purpose (ADR-0026), and sonner may reach the field. Do not write the map inside `dist/client`, which is deployed. No new dependency, no new ADR.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean build | real `pnpm build` | exit 0, total printed as today | — |
| Leak | precached `index-*.js` whose map entry lists `@tanstack/react-query` | exit ≠0, stderr names the chunk and package | hint: keep it behind the lazy AdminApp import or add the chunk to `globIgnores` (ADR-0019) |
| Admin-only package in an ignored chunk | `AdminApp-*.js` lists `cmdk`, not in the manifest | exit 0 | — |
| No map | `dist/client-chunk-modules.json` absent | exit ≠0 | "Run pnpm build first" |
| Stale map | precached `.js` url missing from the map | exit ≠0 | names the url |
| Outcome value too dark | any outcome/warn/success < 3:1 on its theme's card | palette test fails, naming theme and token | — |

</frozen-after-approval>

## Code Map

- `src/client/styles/app.css:266-268` (`:root`), `:315-317` (system dark), `:346-348` (`[data-theme="dark"]`) -- the three outcome declarations per block. Set light to `#8a92a4` / `#2e3f63` / `#5b5f63` (no-contact / interested / not-interested) and both dark blocks to `#7c87a0` / `#aebbdb` / `#8e9399`. Lowercase, like the file.
- `src/client/styles/palette.test.ts` -- reuse `THEMES`, `solid`, `contrast`, `CONTROL`. Add a `describe` block for rule 6 next to rules 1–5. Rule 5's `outcome interested` badge must still pass with the new values; leave it as is.
- `vite.config.ts` -- add an inline plugin, `applyToEnvironment: env.name === "client"`, that writes `{ "assets/x.js": ["react", "@tanstack/react-query", "src/client/App.tsx", …] }` to `<outDir>/../client-chunk-modules.json`. Rolldown exposes `chunk.modules` (verified by a probe build). Reduce each node_modules id to its package name (after the last `/node_modules/`, two segments when scoped) and each source id to a repo-relative path. Update the `globIgnores` comment, since a new admin-only chunk is now caught.
- `scripts/check-precache.mjs` -- add `ADMIN_ONLY` (`@tanstack/*`, `cmdk`, `recharts`, `papaparse`, `@dnd-kit/*`) with a one-line why. Check every precached `.js`, and report both the ceiling and the leak before exiting. Keep the `CHECK_PRECACHE_ROOT` seam, and do not change the existing output line format.
- `scripts/check-precache.test.mjs` -- `makeFixture` writes a map (default: every fixture file with `[]`) so the existing cases still pass. Add the matrix's leak, ignored-chunk, no-map and stale-map cases.
- `docs/design.md:70-72` colour table; `:~95` "The five rules" gets rule 6 and its intro paragraph mentions the new assertion.
- `docs/adr/0026-…md:~103` -- the "ADR-0019's glob keeps its known gap in reverse" bullet: add that `check:precache` now fails on an admin-only package in a precached chunk (GH #95). This is the same amend pattern as its GH #67 bullet.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/styles/app.css` -- set the nine outcome declarations -- #100
- [x] `src/client/styles/palette.test.ts` -- add rule 6 per theme for the five tokens -- CAP-10
- [x] `vite.config.ts` -- add the chunk-module map plugin and update the comment -- the guard's input
- [x] `scripts/check-precache.mjs` -- read the map, fail closed, add the admin-only check -- #95
- [x] `scripts/check-precache.test.mjs` -- fixture map plus the four matrix cases -- the guard's own control
- [x] `docs/design.md`, `docs/adr/0026-budget-the-field-precache-not-the-entry-chunk.md` -- new hexes, rule 6, closed gap -- DoD

**Acceptance Criteria:**
- Given a new outcome value, when one light or dark value is set below 3:1 on its theme's card, then `palette.test.ts` fails (verify once by mutation, then revert).
- Given the real build, when `pnpm build && pnpm check:precache` runs, then it exits 0, the precache total is unchanged except for CSS bytes, and the map shows `@tanstack/react-query` only under `AdminApp-*.js`.
- Given a temporary `import "@tanstack/react-query"` in `src/client/App.tsx`, when the build and check run, then the check fails naming `index-*.js` (verify once, then revert).

## Implementation Notes

- Implemented by a subagent from this spec; all six Verification commands green (1013 tests, precache 676.74 KiB, byte-identical to baseline since the new hexes are the same length).
- AC 3 mutation needs a *used* import: a bare `import "@tanstack/react-query"` is tree-shaken (the package is side-effect-free). With `QueryClient` referenced, the check exited 1 naming `assets/index-*.js` and `@tanstack/query-core`; reverted.
- AC 1 mutation: restoring the old `outcome-no-contact` (`#dde0e5` / `#3a4356`) failed rule 6 in all three themes; reverted.
- Map lives at `dist/client-chunk-modules.json`; a ceiling failure no longer exits early, so one run reports ceiling and leak together.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: 0 high, 2 medium, 5 low, 6 false/out-of-intent, 1 maybe-false. 6 patched, 0 deferred, 8 rejected.

- `medium` / **patched** — verification-gap + blind-hunter: `moduleName` in `vite.config.ts` untested; a naming regression (scope dropped, raw `.pnpm` path) makes `isAdminOnly` match nothing while CI stays green, since the script fails closed on a missing map but not on wrong names. Moved to `scripts/chunk-module-name.ts` with a unit test over pnpm ids, scoped, virtual, `?query`, repo and foreign ids.
- `medium` / **patched** — blind-hunter: the ADR-0026 edit breaks `docs/adr/README.md:3` ("never edited after acceptance except to change status"). The spec's Code Map asked for it; the smallest fix is a doc move, so patched rather than looped back: hunk reverted, one sentence added to `docs/vision.md`'s precache success criterion, the doc that owns `check:precache`.
- `low` / **patched** — blind-hunter: the leak hint offered `globIgnores` unqualified; the likeliest leaking chunk is the shared `index-*.js`, and ignoring it breaks the field route offline. Reworded to lead with the lazy AdminApp import, `globIgnores` only for a wholly admin chunk.
- `low` / **patched** — edge-case-hunter: a precached `.js` that is not a build chunk (a future `public/*.js`) always hits "map is stale, rebuild", which rebuilding never clears. Message now names both causes; still fails closed.
- `low` / **patched** — edge-case-hunter (claims, vite.config.ts:99-101 and ADR-0026): "no longer slips through" overclaims; a new admin chunk of admin source or unlisted packages still passes. Comment qualified to `ADMIN_ONLY`; the ADR sentence is gone with the revert.
- `low` / **patched** — blind-hunter: `docs/design.md` repeated rule 6 in the rules intro (a rule has one home) and left a broken wrap. Sentence deleted.
- **rejected** (out of intent) — blind-hunter + edge-case-hunter: admin-only Radix primitives (select, dropdown-menu, tooltip) and `src/client/admin/*` source are not checked. The frozen Boundaries exclude Radix, and the frozen Approach names packages; `src/client/admin/status.ts` legitimately sits in the entry chunk.
- **rejected** (`low`, unlikely, fix adds a branch) — blind-hunter + edge-case-hunter: non-string entries in a hand-edited map are skipped silently. The plugin only writes strings.
- **rejected** (`false`) — blind-hunter: wildcard edges untested. Verified by reading: `@tanstack-foo` fails `startsWith("@tanstack/")`, `cmdk-extra` fails the exact match.
- **rejected** (`false`) — blind-hunter: the "not precached" test "proves little". It asserts exactly the matrix row, that a non-precached chunk holding admin-only packages passes.
- **rejected** (`maybe-false`, would be `low`) — blind-hunter: tree-shaken modules (`renderedLength` 0) could false-positive. Not reproduced: a bare, unused `@tanstack/react-query` import produced no map entry. It would fail safe anyway. Settled by a build where a listed module has `renderedLength` 0.
- **rejected** (out of intent) — blind-hunter: `docs/design.md` never states the chart's structural separation (1px stroke, in-segment counts). Chart work is out of scope; epic entry 6 documents the chart it ships.
- **rejected** (out of intent) — blind-hunter: the lightness order of the three outcome tokens is unasserted. The intent asks for the 3:1 rule only.
- **rejected** (descriptive) — intent-alignment: implements the "precached chunk, listed packages, DESIGN.md spine hexes, outcome + warn + success" reading. Its divergences (build half untested, packages not modules) are covered by the rows above.

## Design Notes

**Why a build-time map, not the alternatives.** Vite's manifest lists only entry and dynamic-import chunks, not the packages bundled into them. It also lands in `dist/client/.vite/`, which is deployed. A marker string would mean patching vendor code. `chunk.modules` is what Rolldown itself knows, and writing it next to `dist/client` keeps source paths off the public site.

**Why packages, not `src/client/admin/**`.** The field entry chunk already legitimately holds `src/client/admin/status.ts`, so a path rule would fail today.

## Verification

**Commands:**
- `pnpm test` -- expected: all projects pass
- `pnpm typecheck` -- expected: clean
- `pnpm lint` -- expected: clean
- `pnpm build && pnpm check:precache` -- expected: exit 0; quote the precache total against 1,000 KiB (baseline 676.74 KiB)
