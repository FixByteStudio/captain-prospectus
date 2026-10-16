# Round placement after Enregistrer

Where a stop sits on Tournée du jour once its visit is saved. "Before sync" reads the outbox (the outcome the agent picked); "after sync" reads server data only (`status`, `lastVisitAt`, `nextVisitAt`).

> **Superseded by [ADR-0036](../../../docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md) (story 1.5, #501).** Tournée and Carte now list the day's numbered tournée and read the outbox only: every saved stop leaves Tournée the moment its visit is queued, whatever its outcome. The « Plus tard » and « end of today's round » rows below no longer exist anywhere: `buildTodayList` is deleted, and the admin round view lists the tournée's stops in their numbers (story 1.12, #508). A follow-up due on a later day comes back as a stop in that day's tournée; one due today is reopened from Carnet, which saves a new visit. The table below is the pre-ADR-0036 record.

| Result and choice | Server status | Before sync | After sync |
|---|---|---|---|
| Intéressé | `interested` (closed) | Leaves the round | Absent (closed) |
| Converti | `converted` (closed) | Leaves the round | Absent (closed) |
| Pas intéressé | `rejected` (closed) | Leaves the round | Absent (closed) |
| À relancer or Personne sur place + Choisir une date | `follow_up` | Plus tard | Plus tard (`nextVisitAt` after today) |
| À relancer or Personne sur place + Aujourd'hui | `follow_up` | End of today's round | End of today's round: `follow_up`, `lastVisitAt` on today's Brussels day, `nextVisitAt` today |

"End of today's round" ignores distance: the stop sorts after every stop not visited today.

## Docs to reconcile (retro action item 2)

Each must state the table above and stop contradicting it:

- `_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md` — state table (line 182) loses to Flow 1 climax (line 289, "gone").
- `DESIGN.md` › Stop row (line 387).
- ~~`docs/design.md:1253-1257`~~ — closed by ADR-0036: design.md › Next-stop card says a saved stop leaves Tournée.
- ~~`docs/domains/field-operations.md` › Today list~~ — closed by ADR-0036: the visited-today rule is stated there.
- `spec-gh-118` Design Notes — a note pointing to this decision.
- `docs/domains/prospecting.md` — mapping table, lifecycle diagram, "Open vs closed" (ADR-0027 follow-up).
- `docs/data-model.md` — `status` enum.
- `docs/glossary.md` — `interested` status, Waitlist, Channel; À relancer and Personne sur place by who was at the door (CAP-4).
- `docs/domains/field-operations.md` › Visit rules — script questions only on results with no when step (CAP-6).

## Code that locks in today's behaviour (retro action item 3)

- ~~`src/client/field/today.ts` `buildTodayList`~~ — deleted (ADR-0036, story 1.12).
- ~~`src/client/field/progress.ts`~~ — deleted; the counter is `tourneeCounter` in `src/client/field/tournee-stops.ts` (story 1.7).
- ~~`src/client/field/TodayScreen.test.tsx:148`, `:160`~~ — replaced: "a queued visit takes the stop off Tournée whatever its outcome" asserts the Flow 1 climax.
