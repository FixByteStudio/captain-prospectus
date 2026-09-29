# ADR-0027: An "Intéressé" visit gives the prospect its own closed status

- Status: proposed
- Date: 2026-09-29
- Deciders: mohss, Claude
- Amends: [ADR-0011](0011-server-derived-prospect-status.md) (the outcome-to-status mapping it points to)

## Context
- **The mapping.** `OUTCOME_TO_STATUS` (`src/shared/constants.ts`) turns three visit outcomes into `follow_up`:
  - `no_contact` (Personne sur place)
  - `interested` (Intéressé)
  - `follow_up` (À relancer)
- **Why that breaks the round.** `follow_up` is open, and the server sends every open prospect to its agent's today list ([prospecting](../domains/prospecting.md#open-vs-closed)). An Intéressé visit usually has no `follow_up_at`, so the prospect comes straight back to the round with nothing to show it was visited. The epic #117 retrospective found this (`_bmad-output/implementation-artifacts/epic-117-retro-2026-09-29.md`, F3).
- **The owner's decision.**
  - A visited stop leaves the round. Intéressé leads stay off it until a later feature decides how they are worked (`_bmad-output/forge/done-stop-leaves-the-round/forged-idea.md`).
  - The outcomes now have business meanings:
    - Intéressé: open to the discussion, not yet signed up to the waitlist.
    - Converti: already signed up to the waitlist.
    - The two must stay apart, because the dashboard's conversion rate counts only `converted`.
- **Constraints on the change.**
  - Invariant 3: status is computed by the server, never by a phone.
  - `prospects.status` is a Drizzle text enum. D1 has no CHECK constraint on it, so a new value needs no migration.
  - Nothing is deployed yet, so no stored `follow_up` row comes from a real Intéressé visit.

## Decision
We will add a sixth prospect status, `interested` (French label "Intéressé"), and change the mapping from `interested → follow_up` to `interested → interested`.

- **It is closed.** It is not in `OPEN_STATUSES`, so the prospect leaves every agent's today list, before and after the sync.
- **An admin can reopen it,** the same way as `rejected` (ADR-0025 applies unchanged).
- **A later visit still moves it.** If an agent visits an `interested` prospect after an admin reopens it, the server derives the new status from that visit as it does today. Converti gives `converted`, Pas intéressé gives `rejected`.
- **`follow_up` narrows.** From now on it means only `no_contact` and `follow_up` outcomes.
- **Existing rows are not backfilled.** Nothing has been deployed, so no stored row needs it.

## Alternatives considered
| Option | Why not |
|---|---|
| Map `interested` to `converted` | The dashboard's conversion rate would count people who never joined the waitlist, and the Intéressé/Converti difference the owner just defined would be lost. |
| Map `interested` to `rejected` | It files the warmest leads as refusals. The future feature would then have to tell them apart from real refusals by reading visit history. |
| Keep `follow_up` and hide the stop on the phone | A phone cannot decide a prospect is done (invariant 3). Another phone or a reload brings it back, and the admin cannot tell "interested" apart from "call back on a date". |
| Keep `follow_up` and have the server leave `interested` visits out of the today list | This is a hidden rule based on the last visit's outcome. The status would say "open" while the list says "closed", and every admin screen would need the same exception. |

## Consequences
- **Good.**
  - Intéressé leads leave the round and become a clean list the admin can filter by status.
  - The future feature starts from a status, not from reading visit history.
  - `follow_up` now means what it says: go back.
  - The conversion rate is unchanged.
- **Harder.** Every place that lists statuses must learn the sixth one:
  - `STATUSES` and `STATUS_LABELS`, the admin status edge and colour, the Prospects filter, the dashboard pipeline, the CSV export, and the manual-status `PATCH`.
  - An admin tab still running an older cached build has no label or colour for `interested` until it updates. It does not validate responses, so nothing crashes, but the row shows a blank status. Phones are not affected, because the sync pull sends only open statuses.
- **Stranded leads.** Until the future feature ships, Intéressé prospects wait with no owner, and only an admin who filters for them sees them.
- **Follow-up work**, in the change that implements this ADR:
  - `docs/domains/prospecting.md`: the mapping table, the lifecycle diagram and "Open vs closed".
  - `docs/data-model.md`: the `status` enum.
  - `docs/glossary.md`: the new status, plus "Waitlist" and "Channel".
  - The phone's outcome hints, from `forged-idea.md`.
