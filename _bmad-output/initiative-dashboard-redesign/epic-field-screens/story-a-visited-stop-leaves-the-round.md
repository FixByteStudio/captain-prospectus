---
tracker_id: "239"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/239"
tracker_status: done
id: 14
type: story
title: "A visited stop leaves the round"
parent: epic-field-screens
covers: [CAP-6, CAP-7, CAP-8]
after: [13]
risk: medium
---

# A visited stop leaves the round

## Description

Relies on entry 13 so a follow_up visited today can only be a stop kept for today; places each saved stop per round-placement.md before and after the sync in buildTodayList, so Carte's sheet follows, with a stop kept for today sorted last; adds the shared when step on step 2 for À relancer and Personne sur place per when-step.md, the picker starting tomorrow, and revisits the À relancer hint's 'Indiquez la date.'; simplifies progress.ts's total union if the placement allows; replaces TodayScreen.test.tsx:148 and :160 with the Flow 1 climax; reconciles EXPERIENCE.md, DESIGN.md, docs/design.md, docs/domains/field-operations.md and a note under spec-gh-118-tournee-du-jour.md.

## Acceptance Criteria

Verify: DOM tests show the next-stop card names a different stop after a queued Intéressé visit and it stays absent after the pull, Carte's sheet follows, a pulled prospect with lastVisitAt and nextVisitAt today sorts last, Personne sur place opens on 'Aujourd'hui' and sends today's Brussels date, À relancer cannot be saved with nothing ticked, the picker's min is tomorrow and a typed date not after today shows the copy/field message; the PR quotes the precache total against 1,000 KiB.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-field-screens/epic-field-screens.md
- _bmad-output/specs/spec-done-stop-leaves-the-round/SPEC.md, CAP-1, CAP-2 and CAP-5
- _bmad-output/specs/spec-done-stop-leaves-the-round/round-placement.md
- _bmad-output/specs/spec-done-stop-leaves-the-round/when-step.md
- _bmad-output/implementation-artifacts/epic-117-retro-2026-09-29.md, action items 2 and 3
- _bmad-output/implementation-artifacts/spec-gh-118-tournee-du-jour.md
- _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, Flow 1
- _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md, Stop row

## Notes

- Open question: Two spec assumptions are unconfirmed: the when choice sits above Notes on the no-script single screen, and the wording 'Choisissez une date à partir de demain.'

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
