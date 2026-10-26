# Glossary

Use these words in code, UI and docs. One concept, one name.

**Code, database values, docs and commits are English. The UI is French** ([ADR-0013](adr/0013-frontend-conventions.md)).
The French column is the only sanctioned translation of each term; every French string in the app
lives in `src/client/copy.ts` and the `copy/` modules it re-exports (field-reachable modules import
`copy/field`), so the whole UI vocabulary stays reviewable in one place.

| Term | French (UI) | Meaning | Not |
|---|---|---|---|
| **Prospect** | Prospect | A business we want to canvass (restaurant, café, food truck…) | lead, venue, entity |
| **Agent** | Agent | Field person doing visits; the only role that does a tournée ([ADR-0037](adr/0037-admins-leave-the-field-side.md)) | rep, user, worker |
| **Admin** | Admin | Person who imports, assigns, configures scripts. An admin does no tournée; one who canvasses uses an agent account ([ADR-0037](adr/0037-admins-leave-the-field-side.md)). On Utilisateurs the admins' tab reads « Administrateurs » and the agents' « Agents » | manager |
| **User** | Utilisateur | Anyone who may sign in: an admin or an agent, one row of `users` ([ADR-0029](adr/0029-own-login-instead-of-cloudflare-access.md)). Never a synonym for agent | account, member |
| **Visit** | Visite | One physical attempt at a prospect. A revisit is a new visit | check-in (that's the action) |
| **Outcome** | Résultat | Result of a visit: `no_contact`, `interested`, `not_interested`, `follow_up`, `converted` | result |
| **Hors cible signalé** | Hors cible signalé | A prospect whose latest visit reported `out_of_target` and that no admin edit has reviewed since ([prospecting](domains/prospecting.md#refusal-reasons)) | to-fix item |
| **Refusal reason** | Raison du refus | Why a `not_interested` visit was refused, from a fixed list of 7 values ([prospecting](domains/prospecting.md#refusal-reasons)) | complaint, objection |
| **Status** | Statut | Lifecycle of a prospect: `new`, `assigned`, `follow_up`, `interested`, `converted`, `rejected` | state |
| **Script** | Script | Versioned list of questions an agent asks during a visit | survey, form |
| **Answers** | Réponses | Responses to a script, stored on the visit | |
| **Import** | Import | Bulk creation of prospects from CSV or map | upload |
| **Import log** | Journal des imports | The server's record of one import, built from its batches. Not the *Import* itself, which is the act | history |
| **Map import** | Import carte | Import from an OpenStreetMap area via Overpass | scrape |
| **Field prospect** | Prospect terrain | Prospect created by an agent on the ground (`source = field`) | |
| **Sync** | Synchronisation | One request that pushes pending local writes and pulls the agent's list | |
| **Data stage** | — (internal) | Whether stored data and installed phones must survive a change: `disposable` (no, the default before real field work) or `protected` (yes). Set by the owner in `CLAUDE.md` ([ADR-0033](adr/0033-rollout-rules-wait-for-protected-data.md)) | prod mode, environment, live |
| **Dedupe key** | — (internal) | Stable key that makes re-imports update instead of duplicate | |
| **Tournée** | Tournée | One agent's stops for one Brussels calendar day. A morning swipe freezes it from the agent's open work and numbers it nearest-next; the server keeps every swipe as inserts only and reads the earliest of the day ([ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md)) | route |
| **Stop** | Arrêt | One prospect in a tournée, with the number it took at the swipe, or the next number if it joined later. The number never changes; a stop that leaves unvisited leaves a gap. The field UI counts arrêts, never visites ([ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md)) | visite (on the field side), door |
| **Door-day** | — (internal; the admin UI still says « visites ») | One agent, one prospect and one Brussels day; its outcome is that day's latest visit. What the admin figures, the Visites ledger and Carnet count ([ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md)) | visit (a door-day can hold several) |
| **Today list** | Tournée du jour | The field screen ([Screens](#screens)): today's tournée's stops with no visit today, in number order, the next one on a card ([design](design.md#next-stop-card)) | route |
| **Carnet** | Carnet | The field tab ([Screens](#screens)): today's door-days, each with its number (none for a door-day outside the tournée) and latest outcome; reopening one saves a new visit ([design](design.md#carnet)) | history, journal, ma journée |
| **Admin round view** | Tournée du jour | The admin's read-only view of one agent's tournée ([Screens](#screens)), in the phone's stop numbers; the stored agent position only places the agent's marker ([design](design.md#the-admin-round-view), [ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md)) | tracking screen |
| **Agent position** | Position | The latest reading the phone took today, sent with a sync; one per agent, shown only in the admin round view and gone overnight ([ADR-0028](adr/0028-agent-position-at-sync.md)) | location history, tracking |
| **Carte** (screen) | Carte | The field tab ([Screens](#screens)): the Today list drawn as pins carrying their stop numbers | the `osm` import source below, which the admin side also labels "Carte" |
| **Flyer** | Flyer | The leaflet handed over during a visit | prospectus, brochure |
| **Dashboard** | Tableau de bord | The admin's landing screen ([Screens](#screens)): how canvassing is going over 7, 30 or 90 days | home, overview |
| **Open prospect** | Prospect ouvert | A live prospect (`merged_into IS NULL`) whose status is `new`, `assigned` or `follow_up` | active lead |
| **Personne sur place** (outcome `no_contact`) | Personne sur place | Closed, or nobody at all to speak to. The agent comes back; the script is not asked | absent |
| **À relancer** (outcome `follow_up`) | À relancer | Someone was there (staff or the boss), but the boss is busy, away, or not interested right now while keeping the door open for later. The agent comes back; the script is not asked | callback |
| **Intéressé** (status) | Intéressé | A closed status: open to the discussion, not yet signed up to the waitlist. It leaves the round until an admin reopens it ([ADR-0027](adr/0027-interested-is-its-own-closed-status.md)) | converted, follow-up |
| **Converti** (status) | Converti | Already signed up to the waitlist. Only this counts in the conversion rate | interested |
| **Waitlist** | Liste d'attente | The prospects signed up to hear about the launch. Joining it is a conversion | mailing list, newsletter |
| **Channel** | Canal | How a prospect joins the waitlist: today the WhatsApp group or the waitlist itself | medium, source (that's the import origin) |
| **Conversion rate** | Taux de conversion | Prospects converted in a period ÷ distinct prospects visited in it ([api.md › The dashboard](api.md#the-dashboard)) | win rate, close rate |

## Screens

Every client path is an English slug, whatever the French label on screen. A new screen takes the next slug in the same shape: `/round/…` for the field, `/admin/…` for the admin.

| Screen | French (UI) | Slug |
|---|---|---|
| Login | Connexion | `/login` |
| Today list | Tournée | `/round` |
| Carte | Carte | `/round/map` |
| Carnet | Carnet | `/round/logbook` |
| Add prospect | Ajouter | `/round/new` |
| Visit form | Nouvelle visite | `/round/:id` |
| Dashboard | Tableau de bord | `/admin` |
| Users | Utilisateurs | `/admin/users` |
| Prospects | Prospects | `/admin/prospects` |
| Import | Import | `/admin/import` |
| Duplicates | Doublons | `/admin/duplicates` |
| Visits | Visites | `/admin/visits` |
| Orphans | À rattacher | `/admin/orphans` |
| Scripts | Scripts | `/admin/scripts` |
| Admin round view | Tournée du jour | `/admin/round` |

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
