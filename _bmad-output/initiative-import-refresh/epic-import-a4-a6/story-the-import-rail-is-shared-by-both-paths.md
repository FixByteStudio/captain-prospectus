---
tracker_id: "365"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/365"
tracker_status: backlog
id: 2
type: story
title: "The import rail is shared by both paths"
parent: epic-import-a4-a6
covers: [R1, R7]
risk: low
refined: true
---

# The import rail is shared by both paths

## Description

The import stepper becomes the full-width rail of DESIGN.md › `import-rail` on both the CSV and map paths. It is a band directly under the top bar, above the screen title. Each step's overline (« Étape {n} », or « En cours » on the current step) sits above its label, and the line after a done step is gold. The preview step's label becomes « Aperçu & validation ». The CSV path keeps its four steps until entry 4 replaces Fichier and Colonnes with « Fichier & colonnes ». At phone width the rail names only the current step, and the other labels stay for screen readers.

## Acceptance Criteria

Verify: ImportScreen tests assert, on each path, that the `aria-current="step"` step has the « En cours » overline, the others have « Étape {n} », done steps keep the hidden « (terminée) », and the preview label reads « Aperçu & validation ». On a local build, the rail under the top bar matches the mockup on both paths in light, dark and at 390px, where only the current step's label shows.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md, component `import-rail` and section Components › Admin › Import stepper
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, section Component Patterns, copy row "Import › Stepper"
- mockup — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-a4-a6-import.html, sections 1–4 (4 is the phone)

## Notes

- Decision (2026-10-10): the rail breaks out of the admin page padding inside the Import screen; the admin layout does not change (epic Boundaries).
- Decision (2026-10-10): the preview label becomes « Aperçu & validation » in this story; entry 4 only merges Fichier and Colonnes.
- Files named at inception: `src/client/admin/import/ImportStepper.tsx`, its placement in `ImportScreen.tsx`, and `adminCopy.import.steps` in `src/client/copy/admin.ts`.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
