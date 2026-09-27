---
title: 'Visite step 2: Questions (GH #124)'
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
baseline_commit: 'a16622ae83ec64adc05cc3c89e29e769559dbb75'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Visite step 2 still renders the M2 controls: yes/no, single-choice and rating are 56 px rows with a radio disc and a 12 % wash, a number is a bare `<input type="number">` that accepts negatives, and the Personne sur place note is a muted line under the heading. With no script, the one-step visit has no Notes field at all, although `docs/design.md` says "one screen, notes inline".

**Approach:** Rebuild step 2 to DESIGN.md › Choice controls (field) and `mockups/key-f3-f5-visit.html` (F5 backdrop): yes/no as two equal tiles, single-choice as rows, rating as five equal tiles, all on `bg-card` with a border and DESIGN.md `choice-selected` (gold fill, navy text, `primary-edge`) when chosen, over native radios. The number stepper is − / + at 48 px (secondary, aria "Diminuer" / "Augmenter") around a typeable value in display weight, never below 0. The Personne sur place note becomes a callout at the top of step 2. Saving focuses the first invalid answer (keep the existing path). The no-script visit shows Notes inline on its single step. Rewrite `docs/design.md`'s step-2 half.

## Boundaries & Constraints

**Always:** Radios, checkboxes and labels stay native (ADR-0015, ADR-0026). Every gold fill carries `primary-edge` (`palette.test.ts` rule 4). Every French string lives in `copy.ts`. The resolver stays `toVisit`, and `answers.ts` rules are unchanged. Targets ≥ 48 px, text ≥ 16 px, tabular figures on the stepper value. Every question keeps `questionDomId(key)` on its first focusable control. Quote the precache total and the entry chunk in the PR.

**Never:** Do not build the save sheet/dialog (117.8) or the tablet layout (117.9); "Enregistrer la visite" still submits directly. Do not change AddProspectScreen's type chips (117.10) or the outcome cards. No change to `app.css`, Dexie, the sync payload, `visit-draft.ts`, `answers.ts` or the save path. No Radix and no new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Yes/no | tap "Oui" | two equal tiles side by side; "Oui" gold-filled, "Non" card; answer `true` | — |
| Single choice | tap "Papier" | full-width rows; only "Papier" gold-filled | — |
| Rating | tap 4 | five equal tiles; only "4" gold-filled; answer `4` | — |
| Stepper + | empty, tap + three times | value reads 3; answer `3` | — |
| Stepper floor | value 0 | − is disabled; the value stays 0 | typed "-5" → 0; cleared field → no answer |
| Stepper typed | type "45" | answer `45`; + → 46 | — |
| Save, one invalid | 2nd required question empty, 1st answered | "Répondez à cette question." under the 2nd, which is scrolled into view and focused; no outbox row | — |
| Personne sur place | outcome `no_contact`, required unanswered | callout "Personne sur place : répondez seulement si vous savez." at the top of step 2; save writes one outbox row | — |
| No script | no cached script | one step, no indicator, Notes inline, button "Enregistrer la visite"; save writes one row with the notes | — |

</frozen-after-approval>

## Code Map

- `src/client/ui/field-controls.tsx` -- `FieldRadioOption` gains `variant?: "row" | "choice"` (default `"row"`, today's look, used by AddProspectScreen). `"choice"`: `bg-card border-border rounded-md min-h-touch`, input `sr-only` (no disc), `has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary-edge`, focus ring kept via `has-[:focus-visible]`. Do not change `FieldCheckbox` or `FieldRadioGroup`.
- `src/client/field/NumberStepper.tsx` (new) -- `{ id, value: number | undefined, invalid, label, onChange }`. Native `<button type="button">` with `buttonVariants({ variant: "secondary", size: "icon-touch" })`, `MinusIcon`/`PlusIcon`, aria from `copy.visit.stepDown`/`stepUp`. The shadcn `Input` (`id` on it, `type="number"`, `min={0}`, `inputMode="decimal"`, `text-display tabular-nums text-center`, `aria-label={label}`). Typing: "" → `undefined`, negative → 0. − disabled when value is `undefined` or ≤ 0 (then `Math.max(0, v - 1)`). + → `(value ?? 0) + 1`.
- `src/client/field/ScriptQuestions.tsx` -- yes_no: `FieldRadioGroup className="grid-cols-2"` + `variant="choice"` with centred labels. single: `variant="choice"` rows. rating: `grid-cols-5` + `variant="choice"`, centred. number: `NumberStepper`. multi and text unchanged. Keep `questionDomId` on the first control and the `role="alert"` error line.
- `src/client/field/VisitScreen.tsx` -- step 2: replace the muted `questionsOptional` line with a shadcn `Alert` (`@/ui/alert`, `InfoIcon`) placed first in step 2. Render the Notes `FormField` on step 1 when `!hasQuestions` (extract a local `notesField` render to avoid a copy). Keep `focusFirstProblem`, `goToQuestions`, the keyed buttons and everything else.
- `src/client/copy.ts` -- add `visit.stepDown: "Diminuer"`, `visit.stepUp: "Augmenter"` (EXPERIENCE.md › Voice and Tone). Reuse `questionsOptional`, `answerRequired`, `yes`, `no`.
- `src/client/field/VisitScreen.test.tsx` -- extend the existing harness (`renderVisit`, mocks, `SCRIPT`). Add a multi-question script fixture.
- `docs/design.md:925-995` -- update the step-2 sketch (tiles, rows, rating, stepper, callout) and add paragraphs for the choice controls and the stepper floor. Reword "Step 2 exists only…" to say notes sit inline on the single step.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/copy.ts` -- add stepper aria strings -- invariant 15
- [ ] `src/client/ui/field-controls.tsx` -- add the `choice` variant -- DESIGN.md `choice-selected`
- [ ] `src/client/field/NumberStepper.tsx` -- new stepper -- EXPERIENCE.md › Number stepper
- [ ] `src/client/field/ScriptQuestions.tsx` -- compose the controls -- CAP-8
- [ ] `src/client/field/VisitScreen.tsx` -- callout, Notes on the one-step path -- CAP-8
- [ ] `src/client/field/VisitScreen.test.tsx` -- DOM coverage of every matrix row; assert selected tiles carry `bg-primary` + `border-primary-edge` classes only when checked; `document.activeElement` checks for focus; `fieldDb.outboxVisits.count()` for save/no-save -- matrix
- [ ] `docs/design.md` -- rewrite the step-2 half -- CAP-11

**Acceptance Criteria:**
- Given the built app offline at 390 px in light and dark, when step 2 opens on a seeded script with yes/no, single, number and rating questions, then it matches DESIGN.md › Choice controls (field).
- Given the branch, when `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm check:precache` run, then all pass and the precache stays ≤ 1,000 KiB.

## Implementation Notes

- Implemented by a pwa-engineer subagent from this spec; its run ended on a rate limit after its report. The orchestrator verified the diff and finished it.
- Orchestrator fixes: the stepper `Input` lacked `touch` (36 px, and `md:text-sm` at tablet). `text-display` is a theme token tailwind-merge does not know, so Input's `text-base` survived the merge and won in CSS order. It is now `text-display!`, the `!` precedent is `dropdown-menu.tsx`. The Alert description is `text-base` (field text ≥ 16 px). The `FieldRadioOption` comment wrongly called `row` the outcome-card look.
- Matrix audit added a scroll-into-view assertion and a test that reads the answers back from the outbox row. That test found #142: `save` calls `toVisit` without `script`, so every queued visit drops its answers and `scriptId`, and has since M3. It is out of scope here (the spec forbids touching the save path, CLAUDE.md › Stay in scope), so the test is `it.fails` pointing at #142.
- Size: precache 694.96 KiB / 1,000 (baseline 692.49, +2.47), 16 entries. Entry `index-*.js` 381.29 kB (unchanged). VisitScreen chunk 16.73 kB (baseline 15.69), field-controls 3.16 kB.
- Verification: lint, typecheck, 1,191 tests + 1 expected fail, build, check:precache.
- After review patches: lint, typecheck, 1,193 tests, build and check:precache green. Precache 694.99 KiB / 1,000 (baseline 692.49), entry `index-*.js` 381.29 kB (unchanged), VisitScreen 16.78 kB (baseline 15.69).
- Baseline re-stamped at PR time: merge-base is still `a16622ae83ec64adc05cc3c89e29e769559dbb75` (main has not moved).

## Spec Change Log

## Review Triage Log

**Pass 1** (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Counts: high 0 · medium 2 · low 12 · false 3 · maybe-false 1 · rejected-low 6. No intent_gap or bad_spec, so no loopback. The implementer's run had ended on a rate limit, so the orchestrator applied the patches.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | VG, ECH, BH | − is never clicked in a test | medium | patch | VG mutated − to no-op, to +1 and to enabled-when-empty, and the suite stayed green. Added "stepper −": disabled while empty, and 3 → 2 |
| 2 | VG | The callout's `no_contact`-only condition has no negative test | medium | patch | VG mutated it to `true &&` and the suite stayed green. The yes/no test now asserts the callout is absent for Intéressé |
| 3 | BH, IA | The callout carries Alert's `role="alert"` and is announced as urgent on every step-2 mount | low | patch | `alert.tsx` sets `role="alert"`. Now `role="note"`, and the test queries that role |
| 4 | BH | Two number questions give identical « Diminuer » / « Augmenter » buttons | low | patch | The buttons named no question. The stepper is now `role="group"` labelled with the question, and tests query the `spinbutton` |
| 5 | BH, ECH | Notes flashes on step 1 while the script read is pending | low | patch | `hasQuestions` is false while `script === undefined`. The one-step Notes now waits for `script !== undefined` |
| 6 | BH, ECH | A typed `1e309` becomes `Infinity` | low | patch | `Number.isNaN` let it through. Now `Number.isFinite` |
| 7 | BH, ECH, VG | `it.fails` passes on any break, not only #142 | low | patch | Now a plain `it` pinned to today's `answers: {}`, with the #142 flip written in its comment |
| 8 | ECH | The scroll spy is not restored when an assertion throws | low | patch | Its `mockRestore` came after the assertions. `afterEach` now calls `vi.restoreAllMocks()` |
| 9 | BH, ECH | The yes/no test title claims "gold-fill only the checked one" | low | patch | happy-dom cannot resolve `has-[:checked]`. The title now says what it checks |
| 10 | BH, ECH, IA | The design.md sketch drops the « Questions » heading, and its bottom is one column off | low | patch | The code renders the h3. The sketch was regenerated at 73 columns, heading included (the off-by-one predates this change) |
| 11 | BH | Duplicated classes in `FieldRadioOption` variants; `ScriptQuestions` wraps `onChange` needlessly | low | patch | The wrapper was removed. The shared `border-border px-4` moved to the base, but `has-[:checked]:border-primary-edge` stays in each variant because `palette.test.ts` rule 4 needs the edge in the same literal as the fill |
| 12 | VG, IA | No test reads the answers from the outbox row | low | defer | Blocked by #142 (pre-existing). Row 7 pins today's value |
| 13 | BH | − disabling itself drops keyboard focus to `<body>` | low | reject | Touch-first field route. A fix adds a focus branch |
| 14 | BH, ECH | Stepping a decimal drifts (1.3 − 1 = 0.30000000000000004) | low | reject | Number answers are counts. Rounding adds a branch |
| 15 | BH, IA | A French comma in `type="number"` yields "" | maybe-false | reject | Browser-dependent (Chrome Android accepts the locale separator). Would only be low |
| 16 | ECH | A blocked save for notes that are too long has no focus branch | low | reject | Pre-existing on step 2. The 2,000-character cap is rarely reached |
| 17 | BH | No arrow-key test across the `sr-only` radios | low | reject | Native radio behaviour, which happy-dom does not model |
| 18 | IA | Focus lands on a hidden radio after a pointer tap, with no visible ring | low | reject | Same as #123 row 14: the question is scrolled to centre and its alert sits under it |
| 19 | BH | "DESIGN.md" in docs/design.md reads as self-referential | false | reject | It is the repo's standing citation of the UX spine (#123 did the same) |
| 20 | IA | `answers.ts` still accepts negatives | false | reject | The intent sets the floor on the stepper, and the spec keeps `answers.ts` unchanged |
| 21 | IA | The negative-clamp test relies on happy-dom | false | reject | A real browser reports "" for a lone "-" (→ no answer), then -5 → 0. Same end state |

## Design Notes

- Choice tiles hide the disc: DESIGN.md `choice-selected` is a full gold fill, which already marks the pick. Focus stays visible through the label's `has-[:focus-visible]` ring, and native radios keep arrow keys.
- Questions are not wrapped in cards, as in the F5 mock: the tiles are `bg-card` with a border, so a card around them would flatten them. EXPERIENCE.md's "questions as cards" is read as the tiles themselves.
- Notes on the one-step path follow `docs/design.md` ("one screen, notes inline"); without them a no-script visit cannot record "ferme le lundi".

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- expected: green
- `pnpm build && pnpm check:precache` -- expected: ≤ 1,000 KiB. Record the total, `index-*.js` and the VisitScreen chunk against the baseline measured before the change.

**Manual checks:**
- In the browser pane at 390×844, light and dark, offline after first load: open a visit with a seeded script, pick Intéressé, Continuer, answer each control, − at 0, save with a required answer empty; then Personne sur place; then a visit with no script.
