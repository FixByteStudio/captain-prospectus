# Forged idea: Pas intéressé records a reason, not the script

**Status:** hardened · 2026-09-30

## Locked
- A `not_interested` visit skips the script's questions. The agent picks **one refusal reason** instead: one tap, "Autre" adds a note.
- **Rule for the list:** a reason is something the pitch cannot answer at the door. If the pitch answers it (research §5), it's not a refusal.
- **The list** (French labels, proposed English values):

  | Label | Value |
  |---|---|
  | Trop d'applis / de tablettes | `too_many_devices` |
  | Attend de voir (rien n'est lancé) | `wait_and_see` |
  | Méfiance sur les frais | `fee_distrust` |
  | Pas besoin, ça marche comme ça | `no_need` |
  | Hors cible / fermé | `out_of_target` |
  | Refus sans raison | `no_reason_given` |
  | Autre (+ note) | `other` |

- "Pas le temps" and "Voir avec le patron" are **not refusals**. They are À revoir (`follow_up`).

## Rejected, and why
- **Keep the full script for refusals:** a prospect who refuses won't answer six questions.
- **Free text only:** refusals can't be counted, and agents type "pas intéressé".
- **An admin-edited list:** it's a one-question script, so the script machinery comes back.
- **Contre les commissions:** the product charges 0 % commission on dishes, so that's the pitch.
- **Déjà sur les plateformes:** it's a situation, not a reason. There is no exclusivity, and the real no behind it is effort or trust.
- **Ne livre pas:** delivery isn't live. Click and collect and QR ordering at the table are for dine-in-only places.

## Context
- The owner confirms Captain Food takes Brussels restaurants. The research (`planning-artifacts/research/domain-captain-food-pitch-2026-09-30/`) says Tours only on this point.
- Why it matters: if refusals skip the script, the reason is the only record of why prospects say no.

## Open for the spec
- Is the reason required? The owner leans towards one required tap.
- Should `out_of_target` flag the prospect for the admin (bad data in the base)?
- It touches the visit schema, the sync payload (additive field; `sync-contract-change`), and `enforceRequired` in `src/shared/answers.ts` on both client and server. Check whether this needs an ADR under ADR-0024.
- On step 2, the reason should replace the questions, the same way the when step does for `no_contact`.
