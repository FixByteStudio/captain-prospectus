# Glossary

Use these words in code, UI and docs. One concept, one name.

**Code, database values, docs and commits are English. The UI is French** ([ADR-0013](adr/0013-frontend-conventions.md)).
The French column is the only sanctioned translation of each term; every French string in the app
lives in `src/client/copy.ts` and the `copy/` modules it re-exports (field-reachable modules import
`copy/field`), so the whole UI vocabulary stays reviewable in one place.

| Term | French (UI) | Meaning | Not |
|---|---|---|---|
| **Prospect** | Prospect | A business we want to canvass (restaurant, café, food truck…) | lead, venue, entity |
| **Agent** | Agent | Field person doing visits | rep, user, worker |
| **Admin** | Admin | Person who imports, assigns, configures scripts | manager |
| **Visit** | Visite | One physical attempt at a prospect. A revisit is a new visit | check-in (that's the action) |
| **Outcome** | Résultat | Result of a visit: `no_contact`, `interested`, `not_interested`, `follow_up`, `converted` | result |
| **Refusal reason** | Raison du refus | Why a `not_interested` visit was refused, from a fixed list of 7 values ([prospecting](domains/prospecting.md#refusal-reasons)) | complaint, objection |
| **Status** | Statut | Lifecycle of a prospect: `new`, `assigned`, `follow_up`, `interested`, `converted`, `rejected` | state |
| **Script** | Script | Versioned list of questions an agent asks during a visit | survey, form |
| **Answers** | Réponses | Responses to a script, stored on the visit | |
| **Import** | Import | Bulk creation of prospects from CSV or map | upload |
| **Map import** | Import carte | Import from an OpenStreetMap area via Overpass | scrape |
| **Field prospect** | Prospect terrain | Prospect created by an agent on the ground (`source = field`) | |
| **Sync** | Synchronisation | One request that pushes pending local writes and pulls the agent's list | |
| **Dedupe key** | — (internal) | Stable key that makes re-imports update instead of duplicate | |
| **Today list** | Tournée du jour | The agent's open prospects, ordered by distance | route |
| **Carte** (screen) | Carte | The field tab at `/tournee/carte`: today's list drawn as numbered pins on a map | the `osm` import source below, which the admin side also labels "Carte" |
| **Flyer** | Flyer | The leaflet handed over during a visit | prospectus, brochure |
| **Dashboard** | Tableau de bord | The admin's landing screen at `/admin`: how canvassing is going over 7, 30 or 90 days | home, overview |
| **Open prospect** | Prospect ouvert | A live prospect (`merged_into IS NULL`) whose status is `new`, `assigned` or `follow_up` | active lead |
| **Personne sur place** (outcome `no_contact`) | Personne sur place | Closed, or nobody at all to speak to. The agent comes back; the script is not asked | absent |
| **À relancer** (outcome `follow_up`) | À relancer | Someone was there (staff or the boss), but the boss is busy, away, or not interested right now while keeping the door open for later. The agent comes back; the script is not asked | callback |
| **Intéressé** (status) | Intéressé | A closed status: open to the discussion, not yet signed up to the waitlist. It leaves the round until an admin reopens it ([ADR-0027](adr/0027-interested-is-its-own-closed-status.md)) | converted, follow-up |
| **Converti** (status) | Converti | Already signed up to the waitlist. Only this counts in the conversion rate | interested |
| **Waitlist** | Liste d'attente | The prospects signed up to hear about the launch. Joining it is a conversion | mailing list, newsletter |
| **Channel** | Canal | How a prospect joins the waitlist: today the WhatsApp group or the waitlist itself | medium, source (that's the import origin) |
| **Conversion rate** | Taux de conversion | Prospects converted in a period ÷ distinct prospects visited in it ([api.md › The dashboard](api.md#the-dashboard)) | win rate, close rate |

## Enum values

Stored in English, rendered in French. These are the only labels the UI may show for them.

| `outcome` | French |
|---|---|
| `no_contact` | Personne sur place |
| `interested` | Intéressé |
| `not_interested` | Pas intéressé |
| `follow_up` | À relancer |
| `converted` | Converti |

| `refusalReason` | French |
|---|---|
| `too_many_devices` | Trop d'applis / de tablettes |
| `wait_and_see` | Attend de voir (rien n'est lancé) |
| `fee_distrust` | Méfiance sur les frais |
| `no_need` | Pas besoin, ça marche comme ça |
| `out_of_target` | Hors cible / fermé |
| `no_reason_given` | Refus sans raison |
| `other` | Autre |

| `status` | French |
|---|---|
| `new` | Nouveau |
| `assigned` | Assigné |
| `follow_up` | À relancer |
| `interested` | Intéressé |
| `converted` | Converti |
| `rejected` | Refusé |

| `type` | French |
|---|---|
| `restaurant` | Restaurant |
| `fast_food` | Restauration rapide |
| `cafe` | Café |
| `bar` | Bar |
| `food_truck` | Food truck |
| `other` | Autre |

| `source` | French |
|---|---|
| `csv` | CSV |
| `osm` | Carte |
| `field` | Terrain |
