---
tracker_id: "363"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/363"
tracker_status: in-progress
type: epic
title: "The Import screens follow Stitch A4–A6"
parent: initiative-import-refresh
covers: [R1, R2, R3, R4, R5, R6, R7, R8]
after: []
assignee: ""
risk: medium
status: in-progress
---

# The Import screens follow Stitch A4–A6

## Description

The admin Import's Source step and CSV path are rebuilt to the 2026-10-10 UX update: one rail for both paths, two source cards, a merged Fichier & colonnes step with Statut chips, Aperçu & validation with count cards and an error filter, a floating progress card while the import runs, and a Derniers imports table fed by a new server import log. Zone stays as built apart from its rail. `docs/design.md` › The CSV import already describes the target (commit 06884ed).

## Outcome

The owner imports a CSV or an area through screens that match `key-a4-a6-import.html` in light, dark and at phone width, and sees the last 5 imports on Source.

## Requirements

Source: `docs/design.md` › The CSV import (as of 06884ed), with the copy in EXPERIENCE.md › Component Patterns and the look in DESIGN.md › Components › Admin.

- R1: One rail for both paths. Each step is a 32px circle, then an overline (« Étape 1 », or « En cours » on the current step) above its label; the line after a done step is gold. Done is ink with a `Check` and a visually hidden « (terminée) », current is gold with `aria-current="step"`, future is `secondary`; the `nav` stays labelled « Étapes ». The CSV path is Source · Fichier & colonnes · Aperçu & validation, the map path Source · Zone. No « Terminé » step.
- R2: Source is two equal cards: icon tile, tag pill, title with a format chip, explainer, four `CircleCheck` bullets that state only what the app does today, the step count and one button. « Importer un fichier » (gold) opens the file picker straight away and lands on Fichier & colonnes; « Dessiner une zone » (secondary) opens Zone. An unreadable or empty file stays on Source with a destructive Alert under the cards.
- R3: Derniers imports lists the last 5 imports under the cards, newest first, read-only: Date & heure · Source (CSV / Carte OpenStreetMap / Carte Google) · Fichier ou zone (the file name, « {7} sommets » or « Rayon {300} m ») · Volume (« +{118} créés · {6} mis à jour · {4} rejetés ») · Par (the admin's email) · Statut (« Terminé » on the success tint, « Interrompu » on the warn tint). With none, one muted line: « Aucun import pour l'instant. ». Nothing records an import today, so an ADR comes first.
- R4: Fichier & colonnes opens with a file card (icon tile, name, size and line count chips, the in-browser hint with a `Lock`, a secondary « Changer de fichier »), then the mapping table: Champ (icon, label, hint) · Colonne du fichier (a Select that includes « Ne pas importer ») · Exemple · Statut. Statut is one chip per row, the field's own first: « Requis » (Nom), « Coordonnées GPS » (Latitude, Longitude), « Clé unique » (Identifiant source); otherwise « Détecté » when guessed and « Optionnel » when none is chosen. A file column that feeds no field closes the table as a muted « Ignoré » row. The head counts configured fields, the foot counts lines and mapped columns. The bottom bar holds Retour, « Étape 2 sur 3 » and the gold « Voir l'aperçu », disabled until Nom has a column.
- R5: Aperçu & validation opens with a `secondary` summary banner (« {124} valides sur {128} lignes », the separator as a chip) and two KPI count cards with their share as a tinted chip. The ledger keeps `STATUS_EDGE`: rejected rows first, struck through, with their reason chip; ready rows read « Prêt », or « Sans coordonnées » on the warn tint. « Toutes les lignes » / « Voir les {4} erreurs » filters it. Coordinates go through `formatCoordinate`, counts through `formatCount`. No per-row checkboxes, no created/updated forecast.
- R6: While the import runs, a progress card floats bottom right over the bottom bar: « Import en cours », « {done} / {total} » in `.tnum`, and a `Progress` bar in ink, not gold. Both import progress bars have an accessible name (GH #231). Retour and « Importer {n} lignes » stay disabled until the server answers the last batch; the `beforeunload` guard holds while `isRunning`. The « Import terminé » dialog and the failed-mid-way Alert with « Réessayer » are unchanged.
- R7: At phone width the cards stack, the rail names only the current step, the mapping table becomes one block per field, and Derniers imports becomes two-line rows without Par.
- R8: `docs/design.md` matches the shipped screens.

## Done when

1. On a seeded local build, the CSV path runs Source → Fichier & colonnes → Aperçu & validation → « Import terminé », matching `key-a4-a6-import.html` in light and dark at 1280px and at phone width.
2. The map path shows the same rail (Source · Zone); Zone is otherwise unchanged and its import still runs.
3. After a CSV import and a map import, Derniers imports lists both, newest first, with source, file or zone, volume, admin and status; an import whose batch failed reads « Interrompu ».
4. A screen reader announces a name on both import progress bars, and #231 is closed.
5. `pnpm lint`, `typecheck`, `test` and `build` are green on `main`; `docs/design.md`, `api.md`, `data-model.md` and `domains/ingestion.md` match what shipped.

## Boundaries

The admin Import screen (`src/client/admin/import/`), the batch import route and a new import log in D1. Not Zone's or `MapCanvas`'s behaviour, not the field app beyond the shared `Progress` variant, and not what EXPERIENCE.md › Inspiration & Anti-patterns drops for Import.

## References

- design — docs/design.md, section "The CSV import"
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, sections Component Patterns, Import rows of the copy table, and Inspiration & Anti-patterns
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md, components `source-card` and `import-rail`, section Components › Admin
- mockup — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-a4-a6-import.html
- domain — docs/domains/ingestion.md, section CSV import
- issue — https://github.com/FixByteStudio/captain-prospectus/issues/231

## Notes

- Decision (2026-10-10): entry 1 (the `docs/design.md` sync) shipped as 06884ed before this breakdown; it is recorded as done.
- Decision (2026-10-10): the tracer bullet is entry 2, the rail on both paths. It is client-only because the one new contract waits on the owner's ADR (entry 3).
- Decision (2026-10-10): two lanes. Screens run 2 → 4 → 5 → 6 → 10 → 8; the server runs 3 → 7 beside them and shares no file with entries 2–6 and 10.
- Decision (2026-10-10): the import log is three entries: the ADR (hitl), the server log (7), then the Derniers imports panel (8).
- Decision (2026-10-10): Aperçu & validation (6, R5) and the running import's progress card with #231 (10, R6) are separate entries.
- Decision (2026-10-10): a closing refactor sweep (9).
- Decision (2026-10-10): GH #362 (Google map imports refused by `prospectBatchSchema`) is fixed on its own, not inside entry 7. Done when 3 cannot show « Carte Google » until it closes.
- Source conflict: R4 — `docs/design.md` says Retour on the Fichier & colonnes bottom bar is outline; DESIGN.md › Components › Admin and the mockup show it secondary. Decision (2026-10-10): follow DESIGN.md and the mockup; entry 5 corrects design.md.
- Unknown: whether the server can tell an import is « Interrompu » without a closing call from the client; entries 7 and 8 wait on the ADR (entry 3).
- Decision (2026-10-10): entry 8 (#372) is split in two: 8 sends the import log from both paths, and new entry 11 shows Derniers imports on Source and owns the imports query and its invalidation. Entry 9 waits on 11 too.
