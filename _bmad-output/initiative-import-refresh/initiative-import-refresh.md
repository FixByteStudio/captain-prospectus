---
tracker_id: "3"
remote: "https://github.com/FixByteStudio/captain-prospectus/milestone/3"
tracker_status: backlog
type: initiative
title: "The Import screens follow the 2026-10-10 UX update"
parent: none
covers: [R1, R2, R3, R4, R5, R6, R7, R8]
after: []
assignee: ""
risk: medium
---

# The Import screens follow the 2026-10-10 UX update

## Description

The admin Import's Source step and CSV path are redesigned after Stitch A4–A6: one rail for both paths, two source cards, a merged Fichier & colonnes step, Aperçu & validation with count cards and an error filter, and a Derniers imports table that needs a server import log. Zone stays as built apart from its rail. The work fits one epic, `epic-import-a4-a6`, whose Requirements hold the source's lines; this initiative's `covers` lists the same ids.

## Outcome

The owner imports a CSV or an area through screens that match `key-a4-a6-import.html`, and sees the last 5 imports on Source.

## Requirements

Held by the one epic: `epic-import-a4-a6/epic-import-a4-a6.md`, section Requirements (R1–R8).

## Done when

1. The CSV path matches the mockup on a seeded local build, in light and dark, at desktop and phone width.
2. Derniers imports lists real imports from the server's import log, under an accepted ADR.
3. `pnpm lint`, `typecheck`, `test` and `build` are green on `main`, and `docs/design.md` matches the shipped screens.

## Boundaries

The admin Import screen and the server import log. Not the field app, not Zone's behaviour, and not what EXPERIENCE.md › Anti-patterns drops for Import (full history page, row actions, RGPD panel, encoding chip, a « Terminé » step, per-row checkboxes, a created/updated forecast).

- Touch point: D1 schema and `POST /api/admin/prospects/batch` — the import log and its additive request field; owner: epic-import-a4-a6
- Touch point: `src/client/ui/progress.tsx`, also imported by the field route — an ink variant; owner: epic-import-a4-a6

## References

- design — docs/design.md, section "The CSV import"
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, sections Component Patterns and Inspiration & Anti-patterns
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md, section Components › Admin
- mockup — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-a4-a6-import.html

## Notes

- Decision (2026-10-10): one initiative with one epic; the work is unrelated to initiative-own-login and initiative-dashboard-redesign is closed.
