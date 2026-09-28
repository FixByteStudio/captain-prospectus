---
title: 'À rattacher rebuilt (GH #183, fixes #159)'
type: 'feature'
created: '2026-09-28'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '0d45f610172e4bcac319111e6ad44e1e6e04ce89'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-174-context.md'
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `src/client/admin/OrphansScreen.tsx` predates the #175 primitives: bare `<p>` loading/failure, a one-line empty state, outcome as coloured text, a gold « Rattacher à X » on every `not_assigned` row, two row shapes, and no DOM test. The sidebar badge counts `visits.length` only, so past `ORPHANS_PAGE_SIZE` (200) it undercounts (#159).

**Approach:** Rebuild as a forecast on `ScreenHeader`, `ScreenState`, `Surface`, `EmptyTile`: header count = whole queue, phrased as not-yet-repaired; outcome edge `STATUS_EDGE[OUTCOME_TO_STATUS[outcome]]`; one dense row shape for both reasons. Fix #159 on the client — the response already carries `remaining`, so no API change.

## Boundaries & Constraints

**Always:** Row = line 1 time (`visitedAt`), outcome badge (`OUTCOME_BADGE`), « Flyer remis » secondary badge with check, agent, reason badge far right; line 2 the note quoted; line 3 « Rattacher à » + buttons, then « Supprimer » `ml-auto`. `unknown_prospect` → the server's candidates in server order (nearest first), each button `name · distance` (`formatDistance`) inside the button. `not_assigned` with `prospectName` → one button naming that prospect (distance inside when it is among the candidates), repairing against `visit.prospectId`. Candidates empty and no named prospect → explicit no-position message, no attach button. « Supprimer » opens the confirmation dialog; its confirm is `destructive`. Header count and #159 badge both = `visits.length + remaining` through one `nav.ts` helper, also used by the dashboard's « À traiter ». Toasts, endpoints, invalidation unchanged. French in `copy.ts`; tokens only; admin out of the precache.

**Decisions (taken here):**
- Keep one `useRepairOrphan` per row: pending state stays scoped to its row, so repairing A does not disable B, and A's own « Supprimer » disables while A's repair is in flight. One screen-level mutation tracks only its latest call, so two quick repairs would clobber each other's pending state. Stated in the PR.
- Every row action is secondary (DESIGN.md › Buttons: repeated row actions); the Stitch mock's gold « Rattacher à … » is overruled by the spines. « Supprimer » is a ghost button with destructive text and a trash icon, kept distinct because a misclick there is unrecoverable.
- Row buttons do not disable while the queue refetches (unlike Doublons): repair replays answer `repaired:false` and discard is idempotent.
- No-position is read from empty `candidates`, as `orphanedVisitSchema` documents.

**Never:** No worker, schema, API, sync or data-model change. No per-row dialog. No client-side prospect picker or search. No gold button on the screen. No client-derived status sent anywhere. No new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Unknown prospect | `unknown_prospect`, candidates `[A 12 m, B 48 m]` | reason « Prospect introuvable »; buttons in that order, « 12 m » inside A's | — |
| Attach | click A | POST `/api/admin/visits/orphaned/:id/repair` `{prospectId: A}`; toast `attached(A)` | 500 → toast `attachFailed` |
| Another agent's | `not_assigned`, `prospectName: "Le Comptoir"` | reason « Prospect d'un autre agent »; one button naming it; POST `{prospectId: visit.prospectId}` | — |
| No position | `unknown_prospect`, `candidates: []` | the no-position message; no attach button; « Supprimer » present | — |
| Discard | « Supprimer » → confirm | dialog title/body; POST `/discard`; toast `discarded` | cancel → no POST; 500 → `discardFailed` |
| Whole queue | 2 visits, `remaining: 3` | header « 5 visites pas encore rattachées »; overflow line « 3 visites de plus… » | — |
| Badge past a page | 200 visits, `remaining: 50` | sidebar « À rattacher » badge/label 250 | loading/failed → no badge |
| Empty | `{visits: [], remaining: 0}` | `EmptyTile`: « Aucune visite à rattacher. », « Tout ce que les agents ont envoyé est arrivé à destination. », one button to Visites; no header count | — |
| Load failure | GET 500 | `ScreenState` Alert + « Réessayer » | retry refetches |

</frozen-after-approval>

## Code Map

- `src/client/admin/OrphansScreen.tsx` -- rewrite; keep the doc comment's reasoning. Structure like `DuplicatesScreen.tsx`: `ScreenHeader` (title, lede as subtitle `<p className="text-muted-foreground mt-0.5">`, count in `actions`) → `ScreenState<OrphansResponse>` (skeleton: `Surface` + 3 `Skeleton h-16`) → `Surface className="overflow-hidden"` with `<ul className="divide-border divide-y">` or `EmptyTile` → overflow note → the existing `Dialog`.
- `src/client/admin/dashboard/outcome-series.ts:50` `OUTCOME_BADGE`; `status.ts` `STATUS_EDGE`, `BADGE_SHAPE`; `RecentVisits.tsx:122-131` shows the outcome and flyer badge markup to copy.
- `src/client/admin/queries.ts:518-558` -- `useOrphans`, `useRepairOrphan`, `useDiscardOrphan`: read-only.
- `src/client/admin/nav.ts:74` `queueCount` -- selector returns a number (`(d) => d.pairs.length`); add `orphanTotal(data: OrphansResponse)` = `visits.length + remaining`.
- `src/client/admin/AdminSidebar.tsx:31-32`, `dashboard/DashboardScreen.tsx:56-60` -- use `queueCount` + `orphanTotal`; the dashboard's own sum goes away.
- `src/client/copy.ts:567` `orphans` -- `count` through `formatCount` and phrased not-yet (« 1 visite pas encore rattachée » / « N visites pas encore rattachées »); split `empty` into `empty` + `emptyHint`, add `emptyCta` « Voir les visites », `noPosition` (says no position was recorded so nothing is proposed, and that « Supprimer » is left if it cannot be placed), `discardAria`; `attachAria(name, distance?)`; drop `metres`, `attachHere`, `noCandidates` if unread.
- new `src/client/admin/OrphansScreen.test.tsx` -- harness as `DuplicatesScreen.test.tsx`; every matrix row except the badge.
- `src/client/admin/AdminApp.test.tsx` -- add the badge-past-a-page test (path `/admin/inconnu`, orphans stub 200 rows + `remaining: 50`, sidebar link name `copy.nav.withCount(copy.nav.orphans, 250)`); `nav.test.ts` -- `queueCount` cases updated, `orphanTotal` case with `remaining > 0`.
- `DashboardScreen.test.tsx:616-633` -- must pass unchanged (2 + 3 = 5).
- `docs/design.md:927` « The repair queue » -- rewrite down to (not including) « #### A place that looks already listed »: sketch, the rules above, the per-row mutation decision, empty state, the badge total.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/copy.ts` -- orphan strings per Code Map
- [x] `src/client/admin/nav.ts` + `nav.test.ts` -- `orphanTotal`, numeric `queueCount`
- [x] `src/client/admin/AdminSidebar.tsx`, `dashboard/DashboardScreen.tsx` -- use them
- [x] `src/client/admin/OrphansScreen.tsx` -- rebuild
- [x] `src/client/admin/OrphansScreen.test.tsx`, `AdminApp.test.tsx` -- matrix tests
- [x] `docs/design.md` -- repair-queue section rewritten
- [ ] PR: `Closes #183`, `Closes #159`, per-row decision, precache vs 1,000 KiB, baseline, manual-only rows

**Acceptance Criteria:**
- Given `pnpm typecheck && pnpm lint && pnpm test`, then all green and every pre-existing test passes unchanged.
- Given `pnpm build`, then the precache total from `dist/client/sw.js` is < 1,000 KiB and holds no admin chunk.
- Given `grep -n 'variant="default"' src/client/admin/OrphansScreen.tsx`, then no match, and no `<Button>` there lacks a `variant`.

## Implementation Notes

Implemented directly in the orchestrating session (no implementation subagent). `pnpm typecheck && pnpm lint && pnpm test` green (77 files, 1,847 tests); `pnpm build` precache 25 entries, 938.55 KiB of 1,000 KiB, no admin entry in `dist/client/sw.js`. The #159 badge test was mutation-checked: with the sidebar reverted to `visits.length` it fails, with `orphanTotal` it passes. Rows carry an accessible name (`copy.orphans.rowAria`) so tests and screen readers address one visit. `copy.orphans.metres`, `attachHere`, `noCandidates` removed (no other reader).

- Review patches (triage rows 1-9) applied in the orchestrating session; each new test was mutation-checked against the unpatched line. Re-verified: typecheck, lint, 77 files / 1,851 tests, build green; precache 25 entries, 938.55 KiB of 1,000 KiB, no admin entry in `dist/client/sw.js`.

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped, not a sweep). Counts: high 0, medium 1, low 10, false 5, maybe-false 0. Routes: 8 patch, 3 defer, 0 loopback; 3 found-in-passing issues (#197, #198, #199).

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | blind, edge | Cancel/Escape during a pending discard frees the row and the dialog; a second discard clobbers the shared mutation | medium | patch: dialog cannot close and « Annuler » disables while pending; row lock keyed on `discard.variables`. Escape-while-pending asserted; mutation-checked. |
| 2 | vgap, blind | The per-row repair lock is untested | low | patch: test holds the POST, asserts row A (with « Supprimer ») disabled and row B live; fails with `busy = discarding`. |
| 3 | vgap, blind | `not_assigned` with no distance / `attachAria(name, null)` untested | low | patch: test with `candidates: []` → one button, no-distance label, POST to the named prospect. |
| 4 | blind | `not_assigned` with `prospectName: null` falls back to candidates, undocumented and untested | low | patch: comment, design.md sentence, test. |
| 5 | edge, vgap | Header count disappears over rows kept under a failed refetch (`isSuccess` false, data kept) | low | patch: count from `orphans.data`; test fails with the old `isSuccess`. |
| 6 | blind | Badge test hardcodes 250 | low | patch: `ORPHANS_PAGE_SIZE + 50`. |
| 7 | blind | Tests filter buttons with a French literal prefix | low | patch: `attachButtons()` excludes the row's discard name from `copy`. |
| 8 | blind | design.md cites the spine and Stitch without a link; one line over the wrap | low | patch: relative link to the spine DESIGN.md; rewrapped. |
| 9 | intent | Edge class and "never gold" have no assertion | low | patch: tests pin the `STATUS_EDGE` class on the row and `data-variant` (secondary, no default). Density/phone remain manual (happy-dom). |
| 10 | blind, edge | Toast claims attachment when `repaired:false` or a merge was followed | low | defer: pre-existing (same `attach` before #183); #199. |
| 11 | edge | No-position message when the visit has a position but no live prospect has coordinates | low | defer: server/schema contract ambiguity, decision frozen in spec; #197. |
| 12 | blind | `OUTCOME_BADGE` imported from the dashboard folder | low | defer: move to `status.ts` in the 174.12 refactor sweep (RecentVisits and the chart share it). |
| 13 | edge | Mutate-level toast lost when the repaired row unmounts | false | Probe with a queue that drops the row after the POST: toast shows. Kept as a test. |
| 14 | blind | `visits: []` with `remaining > 0` contradicts header and empty tile | false | `remaining = total − held.length`; an empty page means total 0 (admin.ts:1548). |
| 15 | blind | Empty-state link bypasses `visitsHref` | false | `visitsHref(period)` needs a period; Doublons hardcodes its link the same way. |
| 16 | blind | Spec file missing from the diff | false | Untracked until the PR commit, which includes `_bmad-output`. |
| 17 | edge | "Every pre-existing test passes unchanged" is inaccurate: the `queueCount` test and AdminApp's stub changed | low, rejected | True (the `queueCount` selector now returns a size); fix would edit the spec. Stated in the PR instead. |

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all green
- precache total from `dist/client/sw.js` -- expected: < 1,000 KiB, no admin chunk

**Manual checks:**
- `pnpm dev`, `/admin/a-rattacher` at 390px and dark: rows wrap, no horizontal scroll, « Supprimer » stays right.
