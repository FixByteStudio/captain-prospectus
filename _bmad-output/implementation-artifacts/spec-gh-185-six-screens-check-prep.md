---
title: 'Prepare the six-screen check at 1280, 820 and 390 (GH #185, prep only)'
type: 'chore'
created: '2026-09-28'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '841125f020d1045f9d14fbb1bc39e95737a39759'
stacked_on: '9f7ebfe327cbbbc3b8672f59fa62f42ab259bc6d'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-174-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic #174's Done when 2 (each of the six screens meets its EXPERIENCE.md Component and State Patterns rows, light and dark, at 1280/820/390) needs a person on devices, because happy-dom evaluates neither media queries nor computed colour. There is no checklist, and some rows happy-dom *can* check are pinned by no test.

**Approach:** Write `screens-check-185.md`, one section per screen, each applicable row as six unticked boxes (width × theme) with its EXPERIENCE.md line, marked "pinned by <test>" or "owner, on device". Add DOM tests for the uncovered checkable rows. A new test that would fail is a miss: file a `found-in-passing` issue, leave the code.

## Boundaries & Constraints

**Always:** Rows come from EXPERIENCE.md § Component Patterns, § State Patterns and § Responsive & Platform (admin column) whose "Where"/"Surface" names one of Prospects, Import, Doublons, À rattacher, Visites, Scripts, or "Admin, every screen". Admin-shell rows (Offline, Offline after a reload, Session expired, Not an admin, New build available) go once in a "Shell (all six)" section citing their existing tests, not per screen. Rows "built later" (Top-bar search) are listed as not applicable. Each "pinned by" names a real test (`file › it(…)`). Draft PR, `Refs #185`.

**Decisions (taken here):**
- Pinned rows still get their six boxes: a test proves structure, not look.
- A miss gets no failing or `todo` test; its row says "miss → #N".
- Visites' "One toolbar slot" is not applicable (no row selection there).

**Never:** No screen code change. No ticked owner box. No new dependency or visual-regression tooling. No change outside `src/client/admin/**/*.test.tsx`, the checklist, the backlog and this spec.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Toolbar swap | Prospects, tick one row | search and filter selects gone; « 1 sélectionné », « Assigner à », « Assigner », « Désassigner », « Annuler » in their place | « Annuler » → filters back, selection empty |
| Row menu | open a row's « Actions pour X » | « Assigner à », « Retirer l'assignation », « Changer le statut » | — |
| Action toast | assign 1 ticked row | toast « 1 prospect assigné » | 500 → « L'assignation a échoué. Réessayez. » |
| Feed notes | visit with notes « Rappeler lundi » | second line « Rappeler lundi » in « » | no notes → no second line |
| Merged prospect | visit whose `prospectName` differs from today's prospect | row shows the visit's `prospectName` | — |
| Arrival | a poll adds a visit | live-region announcement, no Sonner toast | — |
| Map layout | Import › Zone | provider select precedes the map; under it, in order: vertex count, « Annuler le dernier point », « Effacer », « Rechercher dans la zone » | — |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md:123-233` -- source rows (cite `EXPERIENCE.md:<line>`).
- new `_bmad-output/initiative-dashboard-redesign/epic-admin-screens/screens-check-185.md` -- the checklist; header says how to use it and what "pinned" means.
- `src/client/admin/ProspectsScreen.test.tsx` -- helpers `stubFetch`, `renderAt`, `statusSelect`, `setMobile`; add toolbar swap, row menu, assign toasts. Copy: `copy.prospects.selection`, `.row`, `.assigned`, `.assignFailed`.
- `src/client/admin/VisitsScreen.test.tsx` -- visit fixture has `notes`, `prospectName`; ledger `visits/VisitsLedger.tsx:119` renders « notes ».
- `src/client/admin/import/MapStep.test.tsx` -- existing harness; `copy.map.undo`, `.clear`, `.search`, provider select.
- Already pinned (cite, don't duplicate): ProspectsScreen pagination/empty/export/below-768 describes; VisitsScreen strip, pager, period, live region; ImportScreen stepper/rejected/running/result/failed; MapStep provider/unnamed/duplicate/cache; DuplicatesScreen; OrphansScreen; ScriptsScreen (#184); `ScreenState.test.tsx`; `App.test.tsx` shell rows.
- Candidate misses to confirm, then issue (`gh issue list --search` first): `ProspectsScreen.tsx:316` skeleton is 3 rows, not 6–8; `visits/VisitsLedger.tsx:55-59` loading is a text line, not a skeleton; `VisitsLedger.tsx:53` load failure is a bare `<p>`, no Alert or « Réessayer ».
- `docs/backlog/015-six-screens-check-prep.md`, `docs/backlog/README.md` -- `done`.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/admin/ProspectsScreen.test.tsx` -- toolbar swap, row menu, assign toasts
- [x] `src/client/admin/VisitsScreen.test.tsx` -- notes, merged name, no arrival toast
- [x] `src/client/admin/import/MapStep.test.tsx` -- provider-above-map and action-row order
- [x] confirm the three candidate misses; file one issue each
- [x] `screens-check-185.md` -- every row, boxes, pinned/owner/miss
- [x] backlog 015 → done
- [x] draft PR `Refs #185`, base `claude/014-scripts-rebuilt`

**Acceptance Criteria:**
- Given `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, then all green.
- Given `git diff --name-only 9f7ebfe..HEAD -- src/ ':!*.test.tsx'`, then empty.
- Given the checklist, then every "pinned by" names an `it(…)` that exists and passed, and every screen section has six boxes per row.

## Implementation Notes

Implemented directly in the orchestrating session. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green: 79 files, 1,888 tests. `git status -- src` shows only `*.test.tsx` changes.

- New tests: Prospects toolbar swap, row menu (assigned and unassigned: « Retirer l'assignation » shows only for an assigned prospect, which `RowMenu.tsx:49` does on purpose), assign success and failure toasts; Visites notes line, merged-prospect name, no arrival toast; MapStep provider-above-map and action-row order and variants.
- Misses confirmed in code and filed: #206 (`ProspectsScreen.tsx:316-318`), #207 (`VisitsLedger.tsx:55-59`), #208 (`VisitsLedger.tsx:53`).
- Beyond the three candidates: the admin shell's Offline, Offline-after-reload and Session-expired rows (`EXPERIENCE.md:164-166`, added by #97) have no implementation and no copy string; filed as #209 and marked on the Shell section rather than per screen.
- The checklist was generated, then checked by script: 62 "pinned by" citations, each matched to an `it(…)` in the named file; 44 rows, each with 6 boxes.
- Review patches (rows 1-12) applied; the notes and map-error tests mutation-checked; screen code untouched.
- Diff for review is `9f7ebfe..HEAD` (stacked on #205), not the merge-base, so 014's change is not reviewed twice.

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped, not a sweep). Counts: high 0, medium 0, low 15, false 3, maybe-false 0. Routes: 11 patch, 0 defer, 0 loopback; 1 found-in-passing issue (#210).

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | vgap, blind, edge | Notes "second line" check is vacuous | low | patch: asserts the note is a direct child of the row, outside the name's line; mutation (note moved into the first line) fails it. |
| 2 | edge, blind | Toolbar swap checks search and Statut only; « Annuler » never checks the box unticks | low | patch: Agent and Source asserted gone; checkbox unchecked after « Annuler ». |
| 3 | edge, blind, intent | Failure test drives « Désassigner », not the matrix's assign path | low | patch: assign path with a 500, posted body checked, selection kept to retry. |
| 4 | edge, blind | Unassign success toast unpinned | low | patch: test asserts `unassigned(1)`, `assignedTo: null`, filters back. |
| 5 | blind, edge | Arrival text not scoped to the live region | low | patch: the announcement is the `aria-live` element; toast check runs after the new row renders. |
| 6 | blind | Import "fetches nothing" is wrong: map search has pending and failed states | low | patch: two Import rows; new `MapStep` test for the search-error Alert, mutation-checked. |
| 7 | blind, edge | Width-specific rows get boxes at every width | low | patch: off-width cells are `n/a`; sign-off accepts n/a. |
| 8 | blind | Doublons and À rattacher 3-row skeletons not flagged like Prospects | low | patch: rows say why (lists, not tables); À rattacher cites the shared primitive only. |
| 9 | blind, edge | Visites strip stacking and Visites filter bar slot missing | low | patch: three Visites rows, owner on device. |
| 10 | blind | `#L` anchors do nothing on rendered Markdown | low | patch: plain `EXPERIENCE.md:<line>` sources, one link in the header. |
| 11 | edge, intent | « Retirer l'assignation » is conditional in code, unconditional in the spine | low | patch: row notes the divergence; filed #210 for the owner. |
| 12 | blind, edge, intent | Merged-prospect test cannot fail for the rule's reason | low | patch: row also cites `src/worker/admin.test.ts › still shows a visit whose prospect was merged away afterwards`, where the rule lives; the client renders what the server sends. |
| 13 | blind | Accessibility Floor and Interaction Primitives absent | low, rejected | Out of scope by the intent (Component and State rows); the checklist says so and offers to add them. |
| 14 | edge | Google-provider action order unchecked | low, rejected | Same markup minus undo; unlikely to diverge, and the owner walks it. |
| 15 | edge | `unknown_assignee` toast unpinned | low, rejected | Needs a roster mismatch the UI does not produce from the select. |
| 16 | intent | Toasts matched by text, not as Sonner toasts | false | `<Toaster />` is the only place those strings render in these harnesses. |
| 17 | intent | Misses came from reading code, not failing tests | false | Frozen decision: "A miss gets no failing or `todo` test". |
| 18 | blind, intent | Backlog `done` before merge | false | 001–014 flipped in their own PRs the same way. |

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: green
- `git diff --name-only 9f7ebfe..HEAD -- src/ ':!*.test.tsx'` -- expected: empty
