# A visited stop leaves the round

Answers action item 1 of `_bmad-output/implementation-artifacts/epic-117-retro-2026-09-29.md`.

## Decisions
- After Enregistrer, a visited stop leaves Tournée du jour, both before and after the sync. The one exception is a stop to come back to today (À relancer or Personne sur place with "Aujourd'hui"): it moves to the end of today's round, whatever its distance.
- À relancer and Personne sur place share one "when" step: native radios "Aujourd'hui" / "Choisir une date", same labels for both.
  - "Aujourd'hui" sends today's date for both results. À relancer keeps its required `followUpAt`, and the sync contract does not change.
  - "Choisir une date" reuses the existing native date input. Past days and today are disabled: the picker starts tomorrow, on the Brussels calendar day. The stop goes to Plus tard.
  - Personne sur place opens on "Aujourd'hui", and the radios replace its script questions.
  - À relancer opens with nothing ticked, and its script questions stay above the radios. Saving with nothing ticked shows "Choisissez quand relancer : aujourd'hui ou une date."
  - Notes stay for both. The save sheet is unchanged.
- Intéressé gets a new closed status, `interested` ("Intéressé"): `OUTCOME_TO_STATUS.interested → interested`. `follow_up` then means only Personne sur place and À relancer. Needs an ADR (ADR-0011, ADR-0024), plus the admin status edge, filters, pipeline and export.
- There is no backfill of existing `follow_up` rows, because nothing is deployed.
- Definitions go into the specs (glossary, `prospecting.md`), and the phone hints follow them:
  - Intéressé: "Ouvert à la discussion, pas encore inscrit sur la liste d'attente."
  - Converti: "Déjà inscrit sur la liste d'attente."
- Glossary:
  - **Waitlist / Liste d'attente**: prospects signed up to hear about the launch. Joining it is a conversion.
  - **Channel / Canal**: the way a prospect joins the waitlist; today, the WhatsApp group or the waitlist itself.
  - Hints name the commitment, never the channel.

## Rejected
- "Out today, back tomorrow" for Intéressé: the owner wants these leads out until a later feature decides how they are worked.
- Mapping Intéressé to `converted` would inflate the conversion rate; mapping it to `rejected` would file warm leads as refusals.
- "Aujourd'hui" sending no date: it breaks the required `followUpAt` for À relancer and forces a breaking sync-contract change (invariant 9).
- Defaulting À relancer to "Aujourd'hui": an agent in a hurry would file "come back Thursday" as today, and a forgotten choice would no longer block the save.
- A dialog after the save for Personne sur place: it adds a component stacked on the save sheet, a second form state and one more screen.
- "Pas encore dans le canal" as a hint: agents would need training to decode it, "Canal" is a Brussels place name, and it names the channel rather than the commitment.

## Constraints and notes
- The phone never reasons in statuses. The result the agent picked drives only the phone's next step (invariant 3).
- After the new status exists, a `follow_up` stop with `lastVisitAt` today and no future `next_visit_at` can only be a stop kept for today. The phone can place it at the end of the round from server data alone.
- The date rules live on the phone (the picker's `min` plus the client validator); the server does not reject a past `follow_up_at`.
- Assumption: a stop that leaves the round before the sync loses its row badge. The band's pending count still shows unsent visits.
- Out of scope: how Intéressé leads get worked (a future feature).
