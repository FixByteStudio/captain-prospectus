---
title: 'Pas intéressé asks for a reason, not the script'
type: 'feature'
created: '2026-09-30'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: 'a8bfaf995305748bf6bc6fcef6f96df7bdbd7b3a'
context:
  - '{project-root}/_bmad-output/specs/spec-not-interested-skips-script/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-not-interested-skips-script/refusal-reasons.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A Pas intéressé visit still has to answer every required script question, so agents invent answers or fight the form, and the one thing worth learning (why the place said no) is never recorded (GH #248, epic #246 CAP-1/CAP-2).

**Approach:** On `not_interested`, the script's questions give way to one required choice among the 7 `REFUSAL_REASONS` (native radios, labels from `copy/field`), with Notes kept. `visit-draft.ts` refuses a missing reason and "Autre" with empty notes, and sends `refusalReason` with `answers: {}`. Same shape as the when step (#239, #244).

**Decisions (owner, 2026-09-30):**
- Pas intéressé always gets a step 2, even with no cached script: step 1 reads « Continuer », the step indicator shows « Étape 2 sur 2 · Raison du refus », and step 2 holds the radios and Notes. With no script, every other result keeps its one-screen form.
- The save summary gains a « Raison du refus » row with the chosen label, shown only for Pas intéressé.

## Boundaries & Constraints

**Always:** Native radios via the existing `FieldRadioGroup`/`FieldRadioOption` (ADR-0015, ADR-0026). The 7 values and order come from `REFUSAL_REASONS`; labels from `REFUSAL_REASON_LABELS` through `copy/field`; every new French string in `copy/field.ts` (INVARIANT 15). Rules live in `visit-draft.ts`; the resolver stays `toVisit`. Other outcomes behave exactly as today. The PR quotes the precache total against 1,000 KiB.

**Never:** No server, schema, migration or sync-contract change (story 1 shipped them). No admin change (stories 3–4). No reason on any other outcome. No change to how the script applies to Intéressé and Converti. No new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reason picked | `not_interested`, `too_many_devices`, script cached | Visit with `refusalReason: "too_many_devices"`, `answers: {}`, `scriptId` as today | none |
| No reason | `not_interested`, nothing ticked | Not saved | `refusalReasonRequired` under the radios, focus on the first radio |
| Autre, no note | `other`, notes blank or spaces | Not saved | `refusalOtherNeedsNote` under Notes, focus on Notes |
| Autre with note | `other`, notes "Déménage" | Saved with `other` and the trimmed note | none |
| Stale answers | answers typed under Intéressé, then Pas intéressé | `answers: {}`; an invalid stale answer never blocks | none |
| Reason then another result | reason picked, then Converti | `refusalReason` null/absent; script rules as today | none |
| No script | `not_interested`, no cached script | « Continuer » leads to step 2 with the radios and Notes; `scriptId` null | same errors |

</frozen-after-approval>

## Code Map

- `src/client/field/visit-draft.ts` -- `VisitDraft`, `emptyDraft`, `DraftErrors`, `withOutcome`, `toVisit`. `asksScript` (l.188) is `!hasWhenStep`; add `asksRefusalReason(outcome)` beside `hasWhenStep` as the one home of "not_interested asks a reason", and exclude it from `asksScript`. `withOutcome` drops the reason when the outcome changes.
- `src/client/field/VisitScreen.tsx` -- mirror `whenField` (l.306) as `refusalReasonField`; step-2 branch (l.620). A refusal must reach step 2 even with `!hasQuestions`: the « Continuer »/save switch (l.673), the step indicator (l.543) and the no-script inline Notes (l.611) key off `hasQuestions` today and need a "has step 2" that is true for a refusal; `focusFirstProblem` (l.214) gains reason then notes; `onSelect` of outcome cards (l.583) sets/clears the reason like `when`; summary `answerCount` (l.480) counts 0 for a refusal as for a when-step result.
- `src/client/field/SaveConfirmation.tsx` -- `SaveSummary`: add optional `refusalReason`; a « Raison du refus » row with the label, absent otherwise (rows pattern already there).
- `src/client/field/StepIndicator.tsx` -- `whenOnly` names step 2; generalise to a step-2 name so a refusal reads « Étape 2 sur 2 · Raison du refus ».
- `src/client/copy/field.ts` -- `copy.visit`: `refusalReason: "Raison du refus"`, `refusalReasonRequired: "Choisissez une raison du refus."`, `refusalOtherNeedsNote: "Précisez la raison dans les notes."`. `REFUSAL_REASON_LABELS` is already re-exported.
- `src/client/field/visit-draft.test.ts`, `src/client/field/VisitScreen.test.tsx` -- existing when-step tests (VisitScreen.test l.358–408, l.771, l.1021) are the pattern.
- Do not touch: `db.ts`/`sync.ts` (the outbox stores the `Visit` whole, `refusalReason` rides along), `src/shared`, `src/worker`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/field/visit-draft.ts` -- `refusalReason: RefusalReason | null` in the draft; `asksRefusalReason`; errors `refusalReason: "required"` and `notes: "requiredForOther"`; candidate sends `refusalReason` only for `not_interested`, `answers: {}` for it.
- [ ] `src/client/copy/field.ts` -- the three strings above.
- [ ] `src/client/field/StepIndicator.tsx` -- step-2 name for the refusal step.
- [ ] `src/client/field/VisitScreen.tsx` -- the reason radios in place of the questions, Notes kept, errors and focus, summary count.
- [ ] `src/client/field/SaveConfirmation.tsx` -- the « Raison du refus » row.
- [ ] `src/client/field/visit-draft.test.ts` -- every I/O matrix row, plus other outcomes unchanged.
- [ ] `src/client/field/VisitScreen.test.tsx` -- radios in `REFUSAL_REASONS` order with and without a script (no script: « Continuer » then step 2); the summary's reason row; both blocks with their message and focus; queued visit carries the reason and `answers: {}` after stale answers.
- [ ] `docs/domains/field-operations.md` -- Visit rules and "The script is a second step": `not_interested` asks a reason, not the script; link prospecting.md for the list.
- [ ] `docs/design.md` -- visit form sketch and "The script is the second screen": the refusal step.

**Acceptance Criteria:**
- Given any outcome other than Pas intéressé, when the existing visit tests run, then they pass unchanged.
- Given the field build, when `pnpm build` runs, then the precache total is at or under 1,000 KiB and is quoted in the PR.

## Implementation Notes

- Work only in the worktree `/home/m0/PROJECTs/captain-prospectus-248` (branch `feat/248-refusal-reason-step`); never touch `/home/m0/PROJECTs/captain-prospectus`. Do not commit; the orchestrator commits.
- Verification after review patches: typecheck, lint, 83 files / 2048 tests green; build precache 25 entries, 932.36 KiB / 1,000 KiB.
- The implementer hit a usage limit mid-patch; the orchestrator finished the design.md wireframe and the test patches (rows 5–8).

## Spec Change Log

## Review Triage Log

Pass 1 (thorough; blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: high 0, medium 0, low 10, false 6, maybe-false 0.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | blind, edge | Picking a non-Autre reason, or changing the result, clears a real `tooLong` notes error | low | patch | `clearErrors("notes")` ignores the error type; clear only `requiredForOther` |
| 2 | intent | New notes focus branch changes blocked-save behaviour for other outcomes' `tooLong` | low | patch | Frozen "Other outcomes behave exactly as today"; focus Notes only for `requiredForOther` |
| 3 | blind, intent | Stale comments: `focusFirstProblem` lists Pas intéressé as asking the script; `useWatch` "only two values"; "(SPEC CAP-6)" cited for the refusal rule | low | patch | Direct comment corrections |
| 4 | blind | design.md step-2 wireframe row one column too wide | low | patch | Border misaligned; fix the row |
| 5 | blind | Test name says answers "stay empty" while asserting `{ delivery: true }`; a test hardcodes a French label; duplicate no-script step-2 test | low | patch | Rename, use `REFUSAL_REASON_LABELS`, fold the duplicate |
| 6 | verification, edge | No screen test pins the summary's « 0 réponse » for a refusal after stale answers, nor `answers: {}` in the outbox for that path | low | patch | Add one test: answer under Intéressé, switch to Pas intéressé, save; assert `answers(0)` and `{}` |
| 7 | verification, blind | No test for the Autre error clearing on another pick; no no-script tests for both blocks | low | patch | Extend the Autre test; add no-script block cases |
| 8 | verification | Notes FormMessage ternary's `tooLong` side untested on screen | low | patch | One screen test for an over-long note showing `notesTooLong` |
| 9 | blind | The same "always step 2" rule is restated at length in VisitScreen.tsx comments | low | patch | Trim the code comments to a link to field-operations.md (a rule has one home) |
| 10 | blind | « 0 réponse » row next to the reason is noise | false | reject | design.md "Saving asks once" sets that a result sending no answers reads « 0 réponse » with a script; same precedent as the when step |
| 11 | blind | `scriptId` sent on a refusal with no answers | false | reject | Frozen matrix row: "`scriptId` as today"; unchanged when-step behaviour |
| 12 | blind | Autre gives no hint that a note is needed | low | reject | Fix adds UI beyond the intent; the blocked save names and focuses Notes |
| 13 | blind | StepIndicator/call site duplicate a three-way choice | false | reject | Call site picks the kind once; StepIndicator maps kind to label — no second copy of the rule |
| 14 | blind | Schema issue on `refusalReason` mapped to "required" | false | reject | Unreachable: the draft only holds `RefusalReason` values set by the radios |
| 15 | intent | "Sends" untested on the wire | false | reject | `unstamped` spreads the row (`sync.ts:108`); server storage pinned in `src/worker/sync.test.ts` by #247 |
| 16 | blind | "Absent for other outcomes" half of the summary test unasserted | false | reject | Covered by the null assertion added to the no-script rows test |

## Design Notes

The reason is a draft field, not an answer: it is not in the script, and `answersSchemaFor` must not see it. "Autre" requiring a note is a phone-side rule only (the server stays lenient, INVARIANT 5, per #247's review).

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: green
- `pnpm build` -- expected: green, precache line ≤ 1,000 KiB
