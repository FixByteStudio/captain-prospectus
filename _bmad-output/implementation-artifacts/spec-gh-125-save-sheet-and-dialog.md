---
title: 'Save sheet and dialog (GH #125)'
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
baseline_commit: 'b78cb0d057823a2bff8576efec67b700559ad750'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** "Enregistrer la visite" queues the visit at once, with no summary to check. EXPERIENCE.md (Save sheet, Flow 1 step 5) and DESIGN.md › Bottom sheet / dialog ask for one confirmation first: a bottom sheet on a phone, a centred dialog from 768 px.

**Approach:** "Enregistrer la visite" still validates exactly as today. A valid draft opens the confirmation instead of saving. The confirmation shows the overline "Validation", "Enregistrer cette visite ?", a summary on `bg-secondary` (Établissement, a neutral outcome badge, "Flyer remis" when ticked, "{n} réponses" when the visit has questions, and the notes in italic when there are any), the reassurance line with `CloudUploadIcon`, then "Enregistrer" (primary) above "Modifier" (secondary). From 768 px the two buttons sit side by side. "Enregistrer" runs today's `save`, which calls #119's `queueVisit` and keeps #142's `script` argument. It then returns to Tournée du jour with the existing "Visite enregistrée…" message. "Modifier" closes the confirmation and leaves the form untouched.

## Boundaries & Constraints

**Always:**
- Use shadcn `Sheet` (`side="bottom"`) below 768 px and `Dialog` from 768 px, switched by `useIsMobile`. Both are vendored and both use `radix-ui/dialog`.
- Invariant 5: a failed `queueVisit` does not navigate. `saveFailed` shows inside the open confirmation, and "Enregistrer" can be tapped again.
- Invariant 4: `visitId` stays minted once.
- Invariant 3: the outcome badge is neutral (`secondary`, the mock's `b-flyer`). Never use `outcome-*` or a status colour.
- Invariant 15: every string in `copy.ts`. Text ≥ 16 px, targets ≥ 48 px.
- Quote the precache total and the entry chunk.

**Never:**
- No change to `db.ts`, `visit-draft.ts`, `answers.ts`, the sync payload, `app.css` or the tablet layout (117.9).
- No second queueing path.
- No new dependency.
- No status wording in the summary.
- No new row in the summary beyond DESIGN.md's list.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Open | valid draft; tap "Enregistrer la visite" | confirmation opens with the summary; 0 outbox rows | — |
| Invalid draft | required answer empty | no confirmation; today's focus-first-problem path | — |
| Confirm | tap "Enregistrer" | exactly 1 outbox row with answers + `scriptId`, 1 `sentVisits` row; lands on `/tournee` with the saved message | — |
| Double tap | "Enregistrer" twice fast | still 1 outbox row; button disabled + "Enregistrement…" while writing | — |
| Modifier | tap "Modifier" (or Esc / scrim) | closes; every answer, the outcome, flyer and notes still in the form; 0 rows | — |
| No script | one-step visit | summary without the Questions row; notes shown if typed | — |
| No flyer / no notes | flyer unticked, notes empty | those rows are absent | — |
| Write fails | `queueVisit` rejects | stays open, `saveFailed` alert inside it, no navigation | retry allowed |
| ≥ 768 px | tablet width | centred Dialog, buttons side by side | — |

</frozen-after-approval>

## Code Map

- `src/client/field/SaveConfirmation.tsx` (new). Props are `{ open, onOpenChange, summary: { name, outcome, flyerGiven, answerCount: number | null, notes }, saving, saveFailed, onConfirm }`.
  - It uses `useIsMobile()` from `@/hooks/use-mobile` to pick `Sheet`/`SheetContent side="bottom"` (`rounded-t-xl`, drag-handle bar, `bg-card`) or `Dialog`/`DialogContent` (`showCloseButton={false}`). One inner body renders the same content in both.
  - Title and overline go through `SheetTitle`/`DialogTitle`. The reassurance line is the `Description`.
  - Build the buttons with `buttonVariants({ size: "touch" })` and `variant: "secondary"` for Modifier. Add `PencilIcon` to Modifier, as the mock does.
  - Modifier is `onOpenChange(false)`.
  - The badge is `Badge variant="secondary"`, with `OUTCOME_LABELS` for the label.
- `src/client/field/VisitScreen.tsx`.
  - Add `const [pending, setPending] = useState<VisitDraft | null>(null)`. The `handleSubmit` success callback becomes `setPending(values)`. Keep the error callback as it is.
  - `save` stays as it is, with the same `toVisit` context including `script: script ?? null`. Only its trigger moves. Add a `confirming` state that guards re-entry and drives `saving`.
  - The sticky bar's submit button no longer needs `isSubmitting`.
  - The summary is built from `pending`. `answerCount` is `hasQuestions ? questions.filter(q => a[q.key] !== undefined && a[q.key] !== "").length : null`.
  - `saveFailed` moves into the confirmation. Drop it from the sticky bar.
- `src/client/copy.ts`, `visit.confirm`. Add `overline: "Validation"`, `title: "Enregistrer cette visite ?"`, `place: "Établissement"`, `flyer: "Flyer"`, `answers(n)` (0/1 singular, like `today.progress`), `reassurance: "La visite reste sur ce téléphone jusqu'à la prochaine synchronisation."`, `save: "Enregistrer"` and `edit: "Modifier"`. Reuse `visit.outcome`, `visit.questions`, `visit.notes`, `visit.flyerGiven` and `visit.saving`.
- `src/client/field/VisitScreen.test.tsx`.
  - Add a `confirmSave(user)` helper and route every existing save test through it.
  - Add a `/tournee` route marker, so the test can assert the navigation.
  - Add tests for each matrix row. Mock `matchMedia` for the ≥ 768 px row, or assert on the `data-slot`, `sheet-content` versus `dialog-content`.
- `docs/design.md`.
  - After "A blocked save moves the screen to the problem", add a "Saving asks once" section. It gets a 34-column sketch and says why a confirmation exists here.
  - Rewrite `:375-383` (the script-save paragraph). It claims visits have "no confirmation dialog" and that the script dialog is the only one in the app. Neither is true now; say three confirmations, as EXPERIENCE.md does.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/copy.ts`: add the `visit.confirm` strings (invariant 15).
- [ ] `src/client/field/SaveConfirmation.tsx`: add the sheet or dialog body (DESIGN.md › Bottom sheet / dialog).
- [ ] `src/client/field/VisitScreen.tsx`: validate, then confirm, then `save` (CAP-8, one write path).
- [ ] `src/client/field/VisitScreen.test.tsx`: cover every matrix row. Read the outbox row's `answers` and `scriptId` back (#142). Assert `document.activeElement` and the values after Modifier.
- [ ] `docs/design.md`: add the save-confirmation section and fix the script-dialog claim (CAP-11).

**Acceptance Criteria:**
- Given the built app offline at 390 px and 820 px, in light and dark, when a visit is saved, then the confirmation matches `key-f3-f5-visit.html` F5 (sheet) and the dialog shape.
- Given the branch, when `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm check:precache` run, then all pass. The precache must stay ≤ 1,000 KiB, measured against the baseline taken before the change.

## Implementation Notes

- Implemented directly in the orchestrating session. The owner did not ask for subagents.
- `sheet.tsx` gains upstream shadcn's `showCloseButton` prop, as `dialog.tsx` already has. The mock's sheet has no corner X.
- Focus after Modifier: Radix returns focus to the dialog's Trigger, and this one has none, so focus fell to `<body>`, as a test showed. `SaveConfirmation` takes `returnFocusTo`, and focus goes back to « Enregistrer la visite ».
- Double tap: I first added a `useRef` re-entry guard. A mutation check showed the test could not tell it apart from no guard: React flushes a discrete click, so `disabled` is already on before the second tap. The ref is gone and `disabled={saving}` is the guard. The test asserts `outboxVisits.add` runs once. Removing `disabled` fails it; the row count alone could not, because a duplicate `add` rolls back.
- Size: precache 709.20 KiB / 1,000 (baseline 700.03, +9.17), 16 entries. Entry `index-*.js` 386.23 kB / 123.05 kB gzip (unchanged). VisitScreen chunk 20.16 kB (baseline 16.47).
- Verification: lint, typecheck, 1,300 tests / 57 files, build, check:precache all green.
- After review patches: lint, typecheck, 1,306 tests / 57 files, build, check:precache green. Precache 709.39 KiB / 1,000 (baseline 700.03, +9.36). Entry `index-*.js` 386.23 kB / 123.04 kB gzip (unchanged). VisitScreen 20.31 kB (baseline 16.47).
- Baseline re-stamped at PR time: merge-base with `origin/main` is still `b78cb0d057823a2bff8576efec67b700559ad750` (main has not moved).

## Spec Change Log

## Review Triage Log

**Pass 1** (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Counts: high 0 · medium 3 · low 9 · false 4 · rejected-low 6. There was no intent_gap and no bad_spec, so no loopback. The implementation was inline, so the orchestrator applied the patches.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | VG, BH, ECH | The answer count ignores `""`, `[]` and blank text; untested, and computed inline in JSX | medium | patch | VG mutated the filter to `!== undefined` and the suite stayed green. Moved to pure `answeredCount` in `visit-draft.ts`, which trims strings, with unit tests and a DOM test (text typed then blanked, a box ticked then unticked). Both mutations now fail |
| 2 | VG | The phone Sheet's focus return is untested; every behaviour test ran the Dialog | medium | patch | VG removed the Sheet's `onCloseAutoFocus` and the suite stayed green. Added an `asPhone()` helper and a phone Modifier test. The mutation now fails |
| 3 | VG, BH | "No dismiss while writing" (`if (!saving)`) is untested | medium | patch | Added a test: `add` held on a gate, both buttons disabled, Escape ignored. Removing the guard fails it |
| 4 | BH | design.md says "one of three confirmations", missing the leave guard and the discard | low | patch | design.md:627 and :1205 show the discard confirmation and the leave-guard AlertDialog. The count is dropped; the text points at "Saving asks once" |
| 5 | IA | design.md says rows are "absent, not '0'", then shows « 0 réponse » | low | patch | Reworded: an inapplicable row is absent; with a script, the row counts answers and can read 0 |
| 6 | BH | The Dialog can open with no body when `name` is unresolved | low | patch | `open` is now `summary !== null`, the same condition that renders the body |
| 7 | ECH | Long notes grow the sheet past the viewport; long tokens overflow sideways | low | patch | Added `max-h-[90dvh] overflow-y-auto` on both contents, `break-words` on the name and notes, and `min-w-0` on the row value |
| 8 | ECH | The summary shows untrimmed notes | low | patch | `notes: pending.notes.trim()`, the same trim `toVisit` queues |
| 9 | BH | A test comment credits Radix with the focus return | low | patch | Reworded to name `returnFocusTo` |
| 10 | BH, ECH | Double tap needs a `useRef` in-flight guard | false | reject | A mutation check during implementation showed React flushes a discrete click, so `disabled` applies before the next tap. The test asserts `add` runs once and fails when `disabled` is removed |
| 11 | BH | The precache total is not recorded | false | reject | Recorded in Implementation Notes and quoted in the PR |
| 12 | BH | EXPERIENCE.md / DESIGN.md citations point outside the repo | false | reject | Standing repo convention for the UX spines (spec-gh-124 row 19); `StepIndicator.tsx` does the same |
| 13 | BH | The follow-up date is missing from the summary | false | reject | The frozen intent lists the summary rows and DESIGN.md › Bottom sheet / dialog lists the same; a date row is new design, raised with the owner in the summary |
| 14 | BH | `docs/domains/field-operations.md` not updated | low | reject | That doc holds business rules, not screen flow; the confirmation's one home is design.md (ADR-0024: a rule has one home). No rule changed |
| 15 | BH | The "no status colour" assertion is brittle | low | reject | It passes, and it is the same class-scan pattern as the outcome-card tests |
| 16 | IA | Tests stub `/tournee`, so the « Visite enregistrée… » message and the progress count are not rendered | low | reject | The navigate state is unchanged and `TodayScreen.test.tsx` covers both; `sentVisits` is asserted here. The device check is story 117.12 |
| 17 | IA | Airplane mode not simulated | low | reject | The save path never touches the network, and `../api` is mocked to reject throughout |
| 18 | ECH | `save`'s early return after confirm gives no feedback | low | reject | Unreachable: the resolver validated the same values, and the form renders only with an `id` |
| 19 | ECH | `navigate` rejecting leaves `saving` stuck | low | reject | react-router's in-memory navigate does not reject; a guard adds a branch |
| 20 | ECH | The prospect vanishing mid-confirmation keeps `pending` | low | reject | Row 6 closes the dialog when `name` goes; a re-appearing prospect reopening it is harmless and rare |

## Design Notes

- Sheet and Dialog are two components, switched in JS, not one Dialog restyled with `md:` classes. DESIGN.md names both. Both wrap `radix-ui/dialog`, so the switch costs no bytes, and each keeps its own open and close motion.
- The confirmation holds the validated draft, not a built `Visit`. `save` rebuilds the visit at the tap, so `visitedAt` and the position reflect the moment the visit is saved, as they do today.
- The confirmation is not the leave guard. `save` navigating is still what bypasses the guard (docs/design.md:1208).

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test`: expected green.
- `pnpm build && pnpm check:precache`: expected ≤ 1,000 KiB. Record the total, `index-*.js` and the VisitScreen chunk against the pre-change baseline.

**Manual checks:**
- In the browser at 390×844 and 820×1180, light and dark, offline: go through Continuer, then Enregistrer la visite, then Modifier. The draft must be intact. Then go through Enregistrer la visite, then Enregistrer. You must land on Tournée, and the progress count must rise by one.
