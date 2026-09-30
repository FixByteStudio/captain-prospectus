# Refusal reasons

**The rule:** a refusal reason is something the pitch can't answer at the door. If the pitch has a ready answer (`planning-artifacts/research/domain-captain-food-pitch-2026-09-30/research.md` §5), the agent should give it, and it's not a reason.

## The list

Order on screen = order below. Values are stored forever: never rename one, never reuse one with another meaning.

| Label (`copy/field`) | Value | What it tells the admin |
|---|---|---|
| Trop d'applis / de tablettes | `too_many_devices` | effort: one more device on the counter |
| Attend de voir (rien n'est lancé) | `wait_and_see` | trust: pre-launch, no restaurants yet |
| Méfiance sur les frais | `fee_distrust` | "free" isn't believed (HubRise, the cost-sharing fallback) |
| Pas besoin, ça marche comme ça | `no_need` | happy as they are |
| Hors cible / fermé | `out_of_target` | the base is wrong: closed, or no longer a food business. Flags the prospect for an admin to fix |
| Refus sans raison | `no_reason_given` | nothing to learn |
| Autre | `other` | the rest; the note is required and says what |

## Not refusals

| Heard at the door | Where it goes | Why |
|---|---|---|
| "Pas le temps, là" | À revoir (`follow_up`) | a timing problem, not a no |
| "Faut voir avec le patron" | À revoir (`follow_up`) | the decision-maker wasn't asked |
| "Contre les commissions" | not a reason | 0 % commission on dishes is the pitch |
| "Déjà sur Uber Eats / Deliveroo" | not a reason | there's no exclusivity; the real no behind it is effort or trust |
| "On ne livre pas" | not a reason | delivery isn't live; click and collect and QR at the table are for these places |
