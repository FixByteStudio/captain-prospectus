---
title: 'Escape dismisses the leave dialog without navigating'
type: 'chore'
created: '2026-10-11'
status: 'done'
baseline_commit: '220d6551c2389e189b872869180ee18c33723e5d'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** #86 listed four top-bar and tab-bar handlers with no DOM test. 01dec59 covered the three top-bar ones. The last was the leave dialog's `onOpenChange`, which has since moved from `FieldTabs.tsx` to `LeaveGuardProvider` (`leave-guard.tsx:69-74`, #74). Deleting it now fails `leave-guard.test.tsx`'s cancel case, but no test dismisses the dialog by Escape. A change that keeps Annuler working but breaks Escape could therefore leave an agent stuck on the dialog, or navigate them away from an unsaved form, and CI would stay green.

**Approach:** Extend `FieldTabs.test.tsx`, as #86 suggests. Open the dialog with a tab tap on a dirty form, press Escape, then assert that the dialog closed, the router stayed put, and a second tap asks again, so the pending action was dropped rather than kept. Radix's AlertDialog never closes on an overlay tap, so there is no overlay path to test.

</frozen-after-approval>

## Tasks & Acceptance

**Execution:**
- [x] `src/client/field/FieldTabs.test.tsx` -- add an Escape case next to the cancel case -- pins the dismiss path #86 left open

**Acceptance Criteria:**
- Given a dirty form and the leave dialog open from a tab tap, when the agent presses Escape, then the dialog closes, the pathname is unchanged, and tapping a tab again reopens the dialog.
- Given `onOpenChange` removed from `leave-guard.tsx`, when the `dom` tests run, then the new case fails.

## Implementation Notes

Oneshot: one test case in one file. Mutation check before writing: deleting `onOpenChange` already fails `leave-guard.test.tsx` › "never runs proceed when the dialog is cancelled", so #86's comment ("deleting it still passes CI") predates #74. The gap left is the Escape path itself.

After review, the second tap goes to Carte and is confirmed, because re-tapping Ajouter could not tell a dropped pending action from a kept one.

## Review Triage Log

Quick review, pass 1: 1 medium patched.

- medium, patch -- the "asks again" half re-tapped the same tab, so a provider that kept the first pending action across a dismiss (own `isOpen` state, `pending` never cleared) passed all 21 field tests and ran the stale action on the next Quitter. The second tap now goes to Carte, Quitter follows it, and the pathname must be `/tournee/carte`. That mutant now fails only this case.

## Verification

**Commands:**
- `pnpm vitest run src/client/field/FieldTabs.test.tsx` -- expected: all pass
- same, with `onOpenChange` deleted from `leave-guard.tsx` -- expected: the Escape case fails
