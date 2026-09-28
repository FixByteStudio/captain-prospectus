---
title: 'Scripts rebuilt (GH #184, fixes #72)'
type: 'feature'
created: '2026-09-28'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '841125f020d1045f9d14fbb1bc39e95737a39759'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-174-context.md'
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `src/client/admin/scripts/ScriptsScreen.tsx` and `QuestionRow.tsx` predate the #175 primitives: bare `<p>` loading/failure, questions as rows in a divided list, a monospace disabled key input, a confirm button with no spinner, no DOM test, and at 390px the editor is 509px wide (#72).

**Approach:** Rebuild on `ScreenHeader`, `ScreenState`, `Surface` with one question card per question (DESIGN.md › Script question card), keeping every behaviour (seed-once, draft validation, dnd-kit pointer + keyboard sensors, key lock, confirmation naming the version). Add the first DOM tests and rewrite `docs/design.md` › The script editor for cards.

## Boundaries & Constraints

**Always:** Card = `Surface` with padding: header row `GripVertical` handle (only drag affordance) · number in label weight · label input (`min-w-0 flex-1`) · type select · remove; options (single/multi) under it; footer on `bg-secondary` with « Obligatoire », then the key. Saved key: `Lock` icon + key as text (Archivo, not monospace) + ghost « Modifier la clé »; no editable key input while locked. After unlock the key is an input and `keyUnlockedWarning` stays visible (meta line, `Info` icon) for as long as it is unlocked — never a toast. Locked keys show `keyLocked` on the same meta line. Versions rail: `Surface` list, read-only (no button, no link), active in `success` text not a pill. One gold action (« Enregistrer une nouvelle version »); everything else outline/ghost. Dialog names `nextVersionFor(scripts, name)`; while the POST is in flight its confirm shows a spinner and is disabled, « Annuler » is disabled and the dialog cannot close. Seed-once effect unchanged in behaviour. No horizontal overflow at 390px. French in `copy.ts`; tokens only; admin out of the precache.

**Decisions (taken here):**
- Card chrome is `Surface` + padding, not `ui/card.tsx` (dashboard-only, `rounded-xl` + own padding — see `Surface.tsx`).
- Spinner: vendor shadcn `spinner` into `src/client/ui/spinner.tsx` (lucide `Loader2Icon`, already a dependency), its English aria-label moved to `copy.ts`.
- Stitch extras with no spine row (per-version visit counts, agent preview, "impact" box) are not built.

**Never:** No worker, schema, API, versioning or `script-draft.ts` rule change. No new npm dependency. No toast for the unlock warning. No gold on repeated card actions.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Loaded | active v3, 2 questions | two cards numbered 1, 2; rail lists every version, v3 « Active » | — |
| Keyboard reorder | focus handle 1, Space, ArrowDown, Space; save | POST body questions in the new order | — |
| Locked key | question from v3 | key as text + « Modifier la clé »; no key textbox | — |
| Unlock | click « Modifier la clé » | key textbox enabled; warning visible, still visible after typing | — |
| New question | « Ajouter une question », type label | key suggested from label, editable, no lock | — |
| Confirm | valid draft, name of v3 | dialog body names version 4 | invalid draft → field errors/toasts as today, no dialog |
| In flight | confirm clicked, POST pending | confirm disabled with spinner; « Annuler » disabled; Escape keeps dialog | POST 500 → toast `saveFailed`, dialog closes |
| Saved | POST 200 v4 | toast « Version 4 enregistrée et activée. »; form reseeded | — |
| Background refetch | admin edited name, scripts refetched with v4 | name keeps the edit; rail shows v4 | — |
| Load failure | GET 500 | `ScreenState` Alert + « Réessayer » | retry refetches |

</frozen-after-approval>

## Code Map

- `src/client/admin/scripts/ScriptsScreen.tsx` -- rewrite render; keep hooks, `applyIssues`, `openConfirm`, `confirmSave`, seed effect. `ScreenState` (skeleton: `Surface` + 3 `Skeleton h-32`) wraps the form. Grid `lg:grid-cols-[1fr_18rem]` gets `grid-cols-1` + `min-w-0` children (#72). Dialog `onOpenChange` ignores close while `createScript.isPending`.
- `src/client/admin/scripts/QuestionRow.tsx` -- becomes the card (keep file/export name to limit churn); drop `font-mono`, fixed `w-56`/`w-44` widths get `min-w-0`/wrap below `sm`.
- `src/client/admin/Surface.tsx`, `ScreenState.tsx`, `ScreenHeader.tsx`, `DuplicatesScreen.tsx` -- patterns to copy; `OrphansScreen.tsx` pending-dialog lock (#183 triage row 1).
- `src/client/ui/skeleton.tsx`; new `src/client/ui/spinner.tsx`.
- `src/client/copy.ts:646` `scripts` -- add spinner label (`copy.ui.loading` or similar), `question.number`, any new aria; drop strings left unread.
- new `src/client/admin/scripts/ScriptsScreen.test.tsx` -- harness as `DuplicatesScreen.test.tsx` (stub `fetch`, `createAdminQueryClient`, `Toaster`); expose the client to invalidate for the refetch row. dnd-kit keyboard reorder under happy-dom needs `getBoundingClientRect` stubbed per card.
- `docs/design.md:547` « The script editor » -- rewrite down to « ### The CSV import »: cards sketch, the rules above, cards-vs-ledger rationale (epic #174 inception).
- `docs/backlog/014-scripts-rebuilt.md`, `docs/backlog/README.md` -- status `done`.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/ui/spinner.tsx` + `copy.ts` -- vendored spinner, French label
- [x] `src/client/admin/scripts/QuestionRow.tsx` -- question card
- [x] `src/client/admin/scripts/ScriptsScreen.tsx` -- primitives, rail, save bar, dialog lock, #72
- [x] `src/client/admin/scripts/ScriptsScreen.test.tsx` -- every matrix row
- [x] `docs/design.md` -- section rewritten
- [x] backlog 014 → done
- [ ] PR: `Closes #184`, `Closes #72`, precache vs 1,000 KiB, baseline, manual-only rows

**Acceptance Criteria:**
- Given `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm check:precache`, then all green and every pre-existing test passes unchanged.
- Given the build, then the precache total is < 1,000 KiB and holds no admin chunk.
- Given `grep -n 'font-mono\|w-56' src/client/admin/scripts/`, then no match.

## Implementation Notes

Implemented directly in the orchestrating session (no implementation subagent). `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm check:precache` green: 79 files, 1,875 tests; `check:precache — 25 entries (939.06 KiB) against a 1000 KiB ceiling`; no admin entry in `dist/client/sw.js`.

- Mutation-checked: removing the `KeyboardSensor`, re-seeding on every fetch, letting the dialog close while saving, and dropping the spinner each fail exactly one test.
- Matrix row « In flight » says a POST 500 toasts `saveFailed`. The code it had to keep toasts `ApiError.message` for any HTTP error (the server's `message`, else api.ts's generic sentence) and `saveFailed` only when the request never reaches the server. Behaviour kept, both paths tested; the row is flagged to the owner rather than edited (frozen).
- Keyboard reorder under happy-dom: `getBoundingClientRect` is stubbed per `<li>` (100px slots by sibling index) so the sensor finds a card below.
- The key footer renders its `FormField` in both states so a key error (`duplicate`, `invalid`) still has a `FormMessage` when locked.
- `copy.scripts.editor.saving` removed (no reader: the submit button no longer changes text; the dialog's confirm carries the spinner). Added `copy.spinner`, `question.cardAria`, `question.unlockKeyAria`.
- #72 not measured in a browser here (local dev vars not available to this session); manual row stays.
- Review patches (triage rows 1-13) applied in the orchestrating session; the focus, description and close-button tests were each mutation-checked. Re-verified: lint, typecheck, 79 files / 1,879 tests, build green; `check:precache — 25 entries (939.28 KiB) against a 1000 KiB ceiling`; no admin entry in `dist/client/sw.js`; `grep -rn 'font-mono\|w-56' src/client/admin/scripts/` no match.

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped, not a sweep). Counts: high 0, medium 0, low 17, false 4, maybe-false 0. Routes: 13 patch, 0 defer, 0 loopback; 0 found-in-passing issues.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | blind, edge | Unlocking a key unmounts the focused « Modifier la clé »; focus falls to `<body>` | low | patch: `setFocus` on the key input after the unlock renders; test asserts `activeElement`, mutation-checked. |
| 2 | blind | The unlock warning is not the key input's description | low | patch: note is the key `FormField`'s `FormDescription` (`FormItem className="contents"`); test reads `aria-describedby`, mutation-checked. |
| 3 | blind | The dialog's X stays live while saving | low | patch: `showCloseButton={!saving}`; test asserts no « Fermer » button while held, mutation-checked. |
| 4 | vgap | Per-card key error (the locked-card `FormMessage` this change moved) untested | low | patch: duplicate-key test asserts the message on the locked card 2 and no dialog. |
| 5 | edge, blind, vgap | « Saved » row's reseed and the 500 row untested | low | patch: reseed test (new question's key comes back locked); failed-save test now answers 500. |
| 6 | blind | Renamed script → version 1 untested | low | patch: test asserts `confirm.body(1)`. |
| 7 | blind | Empty-script state untested | low | patch: test asserts both empty strings, no card. |
| 8 | edge, blind | Empty `<ul mt-3>` doubles the margin above the empty state | low | patch: `<ul>` renders only with questions. |
| 9 | edge | Two-digit number overflows `w-4` | low | patch: `min-w-4`. |
| 10 | blind | Drag shadow square behind a rounded card | low | patch: `rounded-md` on the dragged `<li>`. |
| 11 | blind | `Surface.tsx` docstring says the admin side rules cards out, no padding | low | patch: docstring names the padded question card (#184). |
| 12 | blind | `docs/roadmap.md:77` still says « no cards » | low | patch: parenthetical now points at #184's cards. |
| 13 | blind | design.md sketch: `·`, `×` vs Trash2, rail without dates, « under the footer » | low | patch: sketch and legend match the code; focus and close-button rules added. |
| 14 | edge | Double confirm or Escape before `isPending` renders sends two POSTs | low, rejected | TanStack's notify runs on a 0 ms timer, long before a second human click or key (a separate input task); a synchronous guard adds state for a case the UI cannot reach. |
| 15 | edge | design.md's "a second save cannot start" overclaims (same root as 14) | low, rejected | As 14. |
| 16 | blind | Spinner's `role=status` makes the button « Chargement Enregistrer » | false | shadcn's documented `Button` + `Spinner` usage; the name states the pending state, which is accurate. |
| 17 | blind | Heading reuses `history.questionsCount` | low, rejected | One plural string; no reader diverges today. |
| 18 | intent | Submit button lost « Enregistrement… » while pending | low, rejected | While pending the modal covers it and the confirm carries the spinner; nothing visible is lost. |
| 19 | blind | Matrix/code mismatch on the 500 toast is not a GitHub issue | false | It is this spec's row, not a repo defect; fixing it edits the spec. Raised to the owner in the PR. |
| 20 | blind | Spec unfinished, backlog `done` before merge | false | Spec closes at step 5; backlog 001–012 flipped in their own PRs the same way. |
| 21 | blind, intent | #72 unverified in a browser; Toaster import style | low, rejected | #72: happy-dom lays nothing out, local dev vars were unavailable; stated as a manual row in the PR. Import style matches `DuplicatesScreen.test.tsx`. |

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm check:precache` -- expected: all green, precache < 1,000 KiB

**Manual checks:**
- `pnpm dev`, `/admin/scripts` at 390px, light and dark: no horizontal scroll, cards wrap, footer readable.
