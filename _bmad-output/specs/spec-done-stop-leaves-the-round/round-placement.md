# Round placement after Enregistrer

Where a stop sits on Tournée du jour once its visit is saved. "Before sync" reads the outbox (the outcome the agent picked); "after sync" reads server data only (`status`, `lastVisitAt`, `nextVisitAt`).

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
- `docs/design.md:1253-1257` — drop "never hides the stop … or moves it in the walking order".
- `docs/domains/field-operations.md` › Today list — add the visited-today rule.
- `spec-gh-118` Design Notes — a note pointing to this decision.
- `docs/domains/prospecting.md` — mapping table, lifecycle diagram, "Open vs closed" (ADR-0027 follow-up).
- `docs/data-model.md` — `status` enum.
- `docs/glossary.md` — `interested` status, Waitlist, Channel.

## Code that locks in today's behaviour (retro action item 3)

- `src/client/field/today.ts` `buildTodayList` — flags `visitQueued` but keeps the stop in `now`.
- `src/client/field/progress.ts:27-35` — double-count workaround; simplify its `total` union if the new placement makes it plain.
- `src/client/field/TodayScreen.test.tsx:148`, `:160` — assert the visited stop stays as next stop; replace with the Flow 1 climax (next-stop card names a different stop).
