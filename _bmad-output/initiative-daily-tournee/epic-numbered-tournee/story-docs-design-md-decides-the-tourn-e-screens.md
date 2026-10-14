---
tracker_id: "497"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/497"
tracker_status: backlog
id: 1
type: story
title: "docs/design.md decides the tournée screens"
parent: epic-numbered-tournee
covers: [R2, R3, R4, R5, R6, R7, R8, R9, R13, R16]
hitl: true
risk: medium
refined: true
---

# docs/design.md decides the tournée screens

## Description

docs/design.md decides the screens ADR-0036 adds or changes, and the owner approves them. Each section below names the entry that builds it, so no field or Visites story has to invent a screen:

- **Before the swipe (entries 3, 4).** This is a new section under The field side. It covers the two no-tournée messages: nothing assigned, and never loaded with a connection needed. It covers the start screen with the date and the stops, and the unsent-visits strip on it. It covers the location alert dialog: « Activer », the Réglages › Localisation line, and how it looks while readings repeat until one is precise enough. It covers the swipe « Commencer la tournée »: the track, its keyboard and screen-reader button, and the disabled state before a position exists.
- **Next-stop card and Tournée (entries 5, 6, 7).** The header's « 5 arrêts » and « 2 portes sur 5 aujourd'hui » become the counter « {n} sur {total} » in arrêts. The card reads « Arrêt {n} » by swipe number, and the rows keep their numbers with gaps. A joiner carries « Nouveau ». Every saved stop leaves the list, and the « Plus tard » section goes.
- **Carte (entry 5).** The pins carry swipe numbers. This replaces the promise that a refused position degrades the order, in Carte's « Position denied… » paragraph. After the swipe, the order is fixed. With no position, only the distances read « Position inconnue ».
- **Carnet (entry 8).** A new section covering the row (number, name, latest outcome), the empty day, a closed prospect's row, and how a reopened stop's second visit shows. The Tab bar section moves from four possible slots to five.
- **Midnight (entry 9).** What the agent sees when the gates come back, including a visit form open across midnight.
- **Admin Visites ledger (entry 11).** The live feed section gets one row per door-day with its latest outcome, and opening a row shows its visit history. The CSV export stays one row per visit.

EXPERIENCE.md follows: the states table's « Position denied » row, the Carte sheet row, and the new screens. docs/glossary.md follows: Tournée, Arrêt, Carnet and door-day. It also reworks the « Today list » and « Admin round view » rows, which already use « Tournée du jour » for the live ordered list.

The French strings are decided here, and the build entries add them to `copy/field.ts` and `copy/admin.ts`. This entry changes no code.

## Acceptance Criteria

Verify: The owner approves the design.md sections in review. Entries 3 to 9 and 11 each have a section to build against, and each section names its entry. Every new string is written out in French. Neither design.md nor EXPERIENCE.md still promises a stop order taken from the live position, or a count in visites on the field side. The glossary defines Tournée, Arrêt, Carnet and door-day, and no other row defines « Tournée » differently.

## References

- adr — docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md, section Decision
- parent — _bmad-output/initiative-daily-tournee/epic-numbered-tournee/epic-numbered-tournee.md
- design — docs/design.md, sections The field side, Next-stop card, Carte, Tab bar, The live feed
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, states table
- glossary — docs/glossary.md, rows Today list and Admin round view
- copy — src/client/copy/field.ts, `positionDenied` and `distanceUnknown` (the strings the Carte paragraph quotes)
- history — _bmad-output/party-mode/2026-10-14-quinze-sur-vingt.html

## Notes

- Boundary: the admin round view section (design.md › The admin round view) changes with entry 12, which builds it (R15, R16). The recap card and dashboard copy keep their words, and only what they count changes (entries 10, 12).
- Open question: where Carnet sits in the tab bar. The ADR lists Tournée, Carte, Carnet, Ajouter, and an admin's bar adds Tableau de bord as a fifth tab. Five tabs at 390 px is about 78 px each, above the 48 px minimum. Starting proposal, for Sally and the owner: Tournée · Carte · Carnet · Ajouter, with Tableau de bord last for an admin.
- Decision (2026-10-14, refinement): the line-1723 reference is replaced by its section and paragraph, since line numbers drift. R5 and R8 join `covers` because entries 5 and 9 are built to this design.
- Run with Sally (bmad-agent-ux-designer). The owner approves in the PR.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
