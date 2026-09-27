---
title: 'Refactor sweep (GH #128)'
type: 'refactor'
created: '2026-09-27'
status: 'done'
baseline_commit: '5b358f40467c817e05a5ff329789c61dd2e66767' # merge-base of refactor/128-field-sweep and main (epic #59 retro F2)
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick', 'duplication-map']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-117-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic #117's ten field stories left four small copies and one impure import behind, each already named in a build record and not fixed there: `progress.ts` reaches `sendableBy` through `db.ts`, which builds `fieldDb` at module scope (spec-gh-119 rows 11/18). The Visiter path is spelled twice in `StopRow` (spec-gh-120 row 11). The position-denied line is copied between Tournée and Carte (spec-gh-121 row 16). Step 2's back button restates `BackLink`'s class string. A `useWatch` comment in `VisitScreen` is stale. `docs/design.md`'s field diagrams have also drifted: the Tournée tab bar shows two tabs where three ship, and the phone visit diagrams put the prospect's name on the back link. This breaks the epic's Done-when 5.

**Approach:** Move each copy to one home without changing the rendered DOM, the routes or the stored data. `sendableBy` and `OutboxStamp` go to a pure module that `db.ts` re-exports. Add `visitPath(id)` beside `navigationUrl` in `today.ts`, a `PositionDenied` line shared by both screens, and an exported `BACK_LINK_CLASS`. Fix the stale comment and the three diagrams. Every existing test passes unchanged. No new dependency, no copy change, no behaviour change. Deferred behaviour items stay deferred: Progress `value`, null coordinates on an early Ajouter, and the lazy-route error boundary. The PR quotes the precache total and entry chunk before and after (baseline 896.72 KiB, 25 entries, entry 389.10 kB).

</frozen-after-approval>

## Implementation Notes

Oneshot: about 100 mechanical lines across a handful of files, with no design choice left open. The scope comes from the epic's build records (spec-gh-118…127 triage tables) and `deferred-work.md`, limited to the rows that can be fixed without a behaviour change.

- `field/outbox-stamp.ts` (new) now owns `OutboxStamp` and `sendableBy`. `db.ts`, `sync.ts` and `progress.ts` import them from there, and `db.ts` re-exports them as the Approach says. The re-export was dropped in the first draft and restored after review, so the frozen intent is followed as written. `progress.ts` takes only types from `db.ts`.
- `today.ts` gains `visitPath(id)`, and `StopRow` uses it for both the Visiter link and the left swipe.
- `field/PositionDenied.tsx` (new) holds the text plus the « Réessayer » button. Each caller passes the classes it had before, so the DOM is identical.
- `BackLink.tsx` exports `BACK_LINK_CLASS`. Step 2's « Résultat » button keeps its class string unchanged (`${BACK_LINK_CLASS} -ml-1`, plain concatenation, same order as before).
- Fixed the stale `VisitScreen` `useWatch` comment. `docs/design.md` now shows 3 tabs on the Tournée diagram, and the phone visit diagrams read « ← Retour à la tournée » with the name below.
- Not taken, because each is a behaviour change: `readToken` (its fallbacks differ between `MapCanvas` and `RoundMap`), Progress `value`, an early Ajouter saving null coordinates, and the lazy-route error boundary.
- Precache before 896.72 KiB / 25 entries, entry 389.10 kB. After 896.62 KiB / 25 entries, entry 389.20 kB. Leaflet only in `map-*.js`.
- lint, typecheck green; 1595/1595 tests pass with no test file edited.

## Review Triage Log

**Pass 1** (lenses: quick, duplication-map). Counts: high 0 · medium 0 · low 3 patched · rejected-low 11 · false 1 · deferred 1.

| # | Lens | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|---|
| 1 | quick | Tournée tab-bar row in design.md is 3 columns short | low | patch | `⬤` is single-width (the Tab bar diagram's row is 36 wide). Padded to 36 |
| 2 | quick | `db.ts` does not re-export as the frozen Approach says | low | patch | Re-export restored; pure callers still import `outbox-stamp.ts` |
| 3 | quick | `cn(BACK_LINK_CLASS, "-ml-1")` reorders the step-2 button's class string | low | patch | Now plain concatenation, byte-identical to the old literal |
| 4 | dup | Back-link icon + label still in two sites; `-ml-1` unexplained | low | reject | One icon line; `-ml-1` predates this change, which keeps it rather than restyling |
| 5 | dup | `"/tournee"` root spelled 11 times | low | reject | Pre-existing; a route constant touches App, tabs and four screens for no defect |
| 6 | dup | Back-to-round action shape in App.tsx ×2 and VisitScreen | low | reject | Pre-existing, different visuals on purpose (empty state vs error frame) |
| 7 | dup | Claim-unstamped loops and inline stamping outside `outbox-stamp.ts` | low | defer | Real, and the module now exists as their home; sync-path change, so not in a no-behaviour sweep (deferred-work.md) |
| 8 | dup | Five sync failure returns | low | reject | Pre-existing, reads clearly, no defect |
| 9 | dup | Expand-in-place toggle in TodayScreen and CarteScreen | low | reject | One line each; the Carte copy is commented |
| 10 | dup | Two saved-status lines in TodayScreen | low | reject | Two adjacent lines differing by copy key |
| 11 | dup | Period check in progress.ts vs db.ts | low | reject | One is a Dexie index range, one in memory; parallel is documented |
| 12 | dup | Two Carte floating cards | low | reject | Different radius/padding by design (notice vs offline card) |
| 13 | dup | `pending` names three things | low | reject | Pre-existing naming; renaming touches the sync view contract |
| 14 | dup | `today.positionDenied` now serves Carte | false | reject | CarteScreen already used that key before this change |
| 15 | dup | `/tournee` prefix repeated inside `visitPath` | low | reject | Covered by row 5 |

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- expected: green, no existing test edited
- `pnpm build && pnpm check:precache` -- expected: at or under 1,000 KiB; Leaflet only in `map-*.js`, not in `index-*.js`
