---
title: 'The import rail is shared by both paths'
type: 'feature'
created: '2026-10-10'
status: 'done'
route: 'oneshot'
route_source: 'auto'
baseline_commit: 'a54ad1606a5f2283f1aa7c733c13345ab79065e9'
review: 'none'
review_source: 'auto'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

Issue #365 (story 2 of epic-import-a4-a6, R1 and R7): the import stepper becomes the full-width rail of DESIGN.md › `import-rail` on both paths, directly under the top bar and above the screen title. Overline « Étape {n} » / « En cours » above each label, gold line after a done step, preview label « Aperçu & validation », phone width names only the current step.

</frozen-after-approval>

## Implementation Notes

- Files: `ImportStepper.tsx` (rewritten), `ImportScreen.tsx` (rail moved above `ScreenHeader`), `copy/admin.ts` (`current`, `upcoming(n)`, new preview label), `ImportScreen.test.tsx`.
- The done line uses `bg-primary-edge`, not `bg-primary`: `palette.test.ts` rule 4 fails a bare gold fill without an edge, and the mockup's 2px line has no room for one. Visibly gold, one step darker than the mockup.
- Not done: no review subagent was run, and the local-build visual check (light, dark, 390px) was not made.
