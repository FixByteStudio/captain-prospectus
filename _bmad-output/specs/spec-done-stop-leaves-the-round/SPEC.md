---
id: SPEC-done-stop-leaves-the-round
companions:
  - round-placement.md
  - when-step.md
  - ../../../docs/adr/0027-interested-is-its-own-closed-status.md
sources:
  - ../../forge/done-stop-leaves-the-round/forged-idea.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# A visited stop leaves the round

## Why

A pain to solve. After Enregistrer, the stop just visited stays on Tournée du jour as next stop 1, and after the sync it comes back with no marker at all, because Intéressé, Personne sur place and À relancer all map to the open `follow_up` status. Field agents re-meet the door they are standing at, and EXPERIENCE.md Flow 1 ("Curry House is gone") cannot happen, so epic #117 was rejected at its retrospective (`_bmad-output/implementation-artifacts/epic-117-retro-2026-09-29.md`, F1–F3). This spec answers that retro's action item 1. Nothing is deployed yet, so the status model can still change for free.

## Capabilities

- **CAP-1**
  - **intent:** After Enregistrer, a visited stop leaves Tournée du jour and the next-stop card, before and after the sync, unless the agent chose to come back today, in which case it moves to the end of the round.
  - **success:** For every result and choice, the stop lands where `round-placement.md` says, before the sync (visit in the outbox) and after it (server data only). With a queued Intéressé visit, the next-stop card names a different stop (Flow 1 climax). The same holds on Carte's sheet.
- **CAP-2**
  - **intent:** On À relancer and Personne sur place, the agent says when to come back, today or on a chosen date, through one shared step.
  - **success:** Both results show the radios "Aujourd'hui" / "Choisir une date" on step 2, with the placement, defaults, payload and errors in `when-step.md`. The À relancer hint reads "Un rendez-vous à reprendre." (the when step now asks the date). Personne sur place opens on "Aujourd'hui"; À relancer opens with nothing ticked and cannot be saved that way. "Aujourd'hui" sends today's date for both. The save sheet is unchanged.
- **CAP-3**
  - **intent:** An Intéressé visit gives the prospect its own closed status, `interested` ("Intéressé"), that admins can see, filter, reopen and export.
  - **success:** `OUTCOME_TO_STATUS.interested` is `interested`, not in `OPEN_STATUSES`; the sync pull no longer returns the prospect. The admin status edge and colour (faded green: `converted`'s green at partial strength, token `--color-status-interested`), Prospects filter, dashboard pipeline, CSV export and manual-status `PATCH` accept and show it. The dashboard conversion rate still counts only `converted`. A later visit after an admin reopens it derives status as usual (ADR-0027).
- **CAP-4**
  - **intent:** Agents and admins share one definition of Intéressé, Converti and the waitlist.
  - **success:** `docs/glossary.md` and `docs/domains/prospecting.md` define them, and the phone hints (`OUTCOME_HINTS`) read exactly:
    - Intéressé: "Ouvert à la discussion, pas encore inscrit sur la liste d'attente."
    - Converti: "Déjà inscrit sur la liste d'attente."
    - Glossary adds **Waitlist / Liste d'attente** (prospects signed up to hear about the launch; joining it is a conversion) and **Channel / Canal** (how a prospect joins the waitlist; today the WhatsApp group or the waitlist itself).
    - `docs/glossary.md` and `docs/domains/prospecting.md` define the two results that share the when step by who was at the door:
      - **Personne sur place**: closed, or nobody at all to speak to.
      - **À relancer**: someone was there (staff or the boss), but the boss is busy, away, or not interested right now while keeping the door open for a later discussion.
- **CAP-6**
  - **intent:** The script's questions are asked only where someone could answer them, so an agent never has to invent an answer.
  - **success:** Script questions show, and required ones block the save, only for Intéressé, Pas intéressé and Converti. À relancer and Personne sur place never show, require or send script answers (`answers: {}`); their step 2 is the when step and Notes (`when-step.md`). `docs/domains/field-operations.md` states this rule in place of "required unless the outcome is `no_contact`".
- **CAP-5**
  - **intent:** A chosen follow-up date is always after today.
  - **success:** For both results, the "Choisir une date" picker disables past days and today (`min` is tomorrow on the Brussels calendar day), and the client validator rejects a typed date that is not after today with a French message from `copy/field` (`when-step.md`).

## Constraints

- The phone never reasons in statuses (invariant 3). The result the agent picked drives only the phone's next step; the phone never sends, shows or implies a derived status.
- After-sync placement uses server data alone: a `follow_up` stop with `lastVisitAt` on today's Brussels day and no `nextVisitAt` after today was kept for today and goes to the end of the round. This holds only once `interested` no longer maps to `follow_up`.
- No sync contract change (invariant 9): "Aujourd'hui" sends a date so À relancer keeps its required `followUpAt`, and the date rules live on the phone only; the server does not reject a past `follow_up_at`.
- Hints name the commitment, never the channel.
- A result whose door may have had nobody able to answer (À relancer, Personne sur place) never asks the script: required answers there would push agents to invent them (RETROSPECTIVE.md, F1).
- Field-route radios and date input stay native (ADR-0015, ADR-0026); the PR quotes the precache total against the 1,000 KiB ceiling. Every new string lives in `copy/field` (invariant 15).
- ADR-0027 is accepted by the owner: the implementing PR flips its status to accepted and commits it with the status change.
- The docs in `round-placement.md` › Docs to reconcile change in the same work, so the UX contract stops contradicting itself.

## Non-goals

- How Intéressé leads get worked afterwards (a future feature); until then they wait, visible only to an admin who filters for them.
- Backfilling existing `follow_up` rows: nothing is deployed.
- Bringing Intéressé back to the round the next day.
- A dialog after the save for Personne sur place.
- Script answers on À relancer and Personne sur place visits: no admin view or export reads script answers, so hiding the questions loses nothing.
- A separate fix for the retro's F5 (second visit to a queued stop): only a stop kept for today stays visitable, and that is intended.
- Changing the `/api/agent/sync` payload; `lastVisitAt` is already on the wire.

## Success signal

On a phone with no signal, an agent records Intéressé at Curry House and the next-stop card shows Bar des Marolles; after the sync, Curry House is still absent and an admin finds it under the Intéressé status filter. A Personne sur place left on "Aujourd'hui" sits last on the round before and after the sync, an À relancer cannot be saved until the agent picks "Aujourd'hui" or a date from tomorrow, and neither result ever asks a script question.

## Assumptions

- A stop that leaves the round before the sync loses its row badge; the band's pending count still shows unsent visits.
- An admin tab on an older cached build shows a blank status for `interested` until it updates; phones are unaffected since the pull sends only open statuses (ADR-0027).
- Owner-confirmed (#239): with no active script there is no step 2; the when choice sits on the single screen, above Notes. The message for a typed date that is not after today is "Choisissez une date à partir de demain."
- On main (`db0c866`) the step indicator names Personne sur place's step 2 « Quand ? »; À relancer's step 2 now has the same content and takes the same name.
