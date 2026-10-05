---
tracker_id: "179"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/179"
tracker_status: done
id: 5
type: story
title: "Prospects rebuilt: name search, pagination and CSV export"
parent: epic-admin-screens
covers: [CAP-3, CAP-11]
after: [4, 2.10, 4.13]
risk: high
---

# Prospects rebuilt: name search, pagination and CSV export

## Description

Rebuild Prospects on the new design keeping the URL filter contract 2.10 established, add the name search into the one toolbar slot that is replaced in place by the selection actions, add 25-row pagination and a CSV export button, keep the removable chips for several statuses and dueBefore and the row menu with its side submenus, render as a list of rows below 768px, and write the docs/design.md Prospects section the file has never had while rewriting One toolbar slot.

## Acceptance Criteria

Verify: The existing ProspectsScreen.test.tsx stays green in what it asserts, and new DOM tests pin q= reaching the request, pagination, the export button and both empty states; pnpm test is green.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-screens/epic-admin-screens.md
- _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/stitch/admin/a2_prospects
- _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/stitch/admin/a3_prospects_tats_vides_recherche_infructueuse
- https://github.com/FixbyteStudio/captain-prospectus/issues/136

## Notes

- Open question: This is the largest entry: 483 lines of screen plus a 204-line test, and it carries the toolbar swap, pagination, export, both empty states and the sub-768px list. If the responsive list and the export cannot land in one session, they split off rather than shrink.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
