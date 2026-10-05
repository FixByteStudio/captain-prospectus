---
tracker_id: "175"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/175"
tracker_status: done
id: 1
type: story
title: "Admin screen primitives and shared states"
parent: epic-admin-screens
covers: [CAP-3]
after: [1.3, 1.9]
risk: low
---

# Admin screen primitives and shared states

## Description

Add the PageHeader and Panel primitives the six screens compose from, extend the already-adopted --text-title token to the admin headings that still spell their own, give the admin side its shared Loading skeleton, Load-failed Alert and action-toast conventions from EXPERIENCE.md's three 'Admin, every screen' rows, and land the three fixes every rebuilt screen depends on: cn() rebuilt on extendTailwindMerge so a font-size token stops being read as a colour (#136), the admin Input at 16px text-body-field (#92), and Progress forwarding value to the Radix root (#147).

## Acceptance Criteria

Verify: A DOM test asserts cn("text-success","text-meta") keeps the colour and another asserts Progress renders a determinate value; the six admin screens render the shared skeleton and load-failed Alert; pnpm test is green and no admin screen file still spells its own heading or panel chrome.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-screens/epic-admin-screens.md
- https://github.com/FixbyteStudio/captain-prospectus/issues/136
- https://github.com/FixbyteStudio/captain-prospectus/issues/92
- https://github.com/FixbyteStudio/captain-prospectus/issues/147
- _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/stitch/admin/a13_tats_syst_me_admin

## Notes

- Open question: epic-field-screens can run beside this epic and rebuilds the field files that share cn() and Input; this entry's verify is scoped to the admin screens so the two do not fight over the same assertion.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
