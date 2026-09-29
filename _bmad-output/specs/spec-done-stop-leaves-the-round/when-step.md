# The when step (CAP-2, CAP-5)

One step, shared by À relancer and Personne sur place. Every other result has no when step and sends no `followUpAt`.

## Placement

- **Step 2.** Personne sur place: the radios replace the script questions. À relancer: the script questions stay, and the radios sit below them. Notes stay for both.
- **No active script** (single screen): the radios sit above Notes.
- The follow-up date field leaves step 1 (`src/client/field/VisitScreen.tsx:486`); step 1's `form.trigger(["outcome", "followUpDate"])` no longer checks the date.
- `src/client/field/visit-draft.ts` holds the validator: the when choice and the after-today rule join its follow-up checks, and `withOutcome` still drops the date when the result changes to one without a when step.

## Controls

Native radios and the existing native date input (ADR-0015, ADR-0026).

| | À relancer | Personne sur place |
|---|---|---|
| Radio labels | "Aujourd'hui" / "Choisir une date" | same |
| Opens on | nothing ticked | "Aujourd'hui" |
| Date input | shown only with "Choisir une date"; `min` = tomorrow | same |

## What is sent

| Choice | `followUpAt` | Round |
|---|---|---|
| Aujourd'hui | today's date (Brussels calendar day) | End of today's round |
| Choisir une date | the chosen date, after today | Plus tard |

## Errors (French, in `copy/field`)

| Case | Message |
|---|---|
| À relancer saved with nothing ticked | "Choisissez quand relancer : aujourd'hui ou une date." |
| "Choisir une date" with no date | existing `followUpRequired` |
| Impossible date | existing `followUpInvalid` |
| Date not after today | "Choisissez une date à partir de demain." (proposed) |

## Rejected

- "Aujourd'hui" sending no date: breaks the required `followUpAt` for À relancer, forcing a breaking sync-contract change (invariant 9).
- À relancer opening on "Aujourd'hui": an agent in a hurry files "come back Thursday" as today.
- Separate labels per result ("Repasser aujourd'hui"): the result already names the kind of return.
