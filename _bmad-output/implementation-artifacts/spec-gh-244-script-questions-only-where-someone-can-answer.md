---
title: 'Script questions only where someone can answer'
type: 'bugfix'
created: '2026-09-30'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: 'a8b59ca1f1201bb8d89286cfa0e65f33cf2caf31'
context:
  - '{project-root}/_bmad-output/specs/spec-done-stop-leaves-the-round/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-done-stop-leaves-the-round/when-step.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** À relancer still shows the script's questions on step 2 and requires the required ones, but À relancer means the boss was busy, away, or not ready to talk, so nobody able to answer may have been there and agents would invent answers (GH #244, RETROSPECTIVE.md F1).

**Approach:** Treat À relancer exactly like Personne sur place (SPEC CAP-6): step 2 is the when step and Notes, no script answers are shown, validated or sent, and the step indicator reads « Quand ? »; script questions and their required rule apply only to Intéressé, Pas intéressé and Converti. Define both results by who was at the door in the glossary and `prospecting.md` (CAP-4), replace `field-operations.md`'s "required unless `no_contact`" rule, and keep the À relancer hint « Un rendez-vous à reprendre. » (owner).

</frozen-after-approval>

## Implementation Notes

Oneshot: the rule already has one home, `hasWhenStep` in `visit-draft.ts`; the change swaps three `no_contact`-only checks for it, then moves tests and docs. Baseline is the branch's merge-base with `origin/main`; the branch's first commit (`823574a`) is this story's retro and spec update.

- Changed: `visit-draft.ts` (`asksScript = !hasWhenStep(outcome)` gates validation and the sent answers), `VisitScreen.tsx` (step 2 hides `ScriptQuestions` and the indicator reads « Quand ? » for both when-step results; save sheet counts 0), `StepIndicator.tsx` (comment). Tests: the two À relancer step-2 tests from #239 now assert no questions and a save with answers `{}`; draft tests for À relancer unanswered, stale answer, and Intéressé still blocking.
- Docs: `field-operations.md` (Rules and the step-2 section), `glossary.md` and `prospecting.md` (definitions by who was at the door), `docs/design.md`, `EXPERIENCE.md`. Glossary "avoid" column: `absent` for Personne sur place, `callback` for À relancer (not "appointment", since the kept hint says « rendez-vous »).
- Verification: typecheck, lint, 2019/2019 tests, build green; precache 25 entries, 929.73 KiB of 1,000 KiB.

## Review Triage Log

- Quick lens. 4 findings, all patched:
  - medium: `field-operations.md` step-2 section still said only `no_contact` drops the questions, contradicting the new Rules bullet. Rewritten for both results.
  - low: `VisitScreen.tsx` focus comment described À relancer questions above the radios. Now says only non-when-step results ask the script.
  - low: the À relancer draft test answered the only required question, so it never proved the waiver. It now sends `answers: {}`, and a second test covers a stale invalid answer.
  - low: stale `toStep2` comment in `VisitScreen.test.tsx`. Updated.
- The reviewer also noted that the PR must quote the precache figure, which it will.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: all green
- `pnpm build` -- expected: precache ≤ 1,000 KiB; quote it in the PR
