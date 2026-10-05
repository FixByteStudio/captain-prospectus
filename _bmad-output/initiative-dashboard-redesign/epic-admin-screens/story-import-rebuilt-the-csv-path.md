---
tracker_id: "180"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/180"
tracker_status: done
id: 6
type: story
title: "Import rebuilt: the CSV path"
parent: epic-admin-screens
covers: [CAP-3, CAP-11]
after: [5]
risk: medium
---

# Import rebuilt: the CSV path

## Description

Rebuild the Source, Fichier, Colonnes and Aperçu steps on the new design with the numbered stepper, keeping the file parsed in the browser and never uploaded, the rejected rows listed first and struck through with their reasons, the 250-row progress with its beforeunload confirmation, the Import terminé dialog and the mid-way failure Alert, fixing the fr-FR coordinates (#154) and the inline French aria-label at ImportScreen.tsx:107, and writing the docs/design.md section the CSV path has never had.

## Acceptance Criteria

Verify: DOM tests cover the stepper fork, a rejected-row preview, the running progress state and the result dialog; pnpm test is green.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-screens/epic-admin-screens.md
- _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/stitch/admin/a5_import_csv_fichier_et_colonnes
- _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/stitch/admin/a6_import_csv_aper_u_et_validation
- https://github.com/FixbyteStudio/captain-prospectus/issues/154

## Notes

- Open question: None of the nine import components has a DOM test today, so this entry writes the first ones and may find behaviour only the pure helpers currently pin.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
