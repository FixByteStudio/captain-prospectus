---
name: Captain Prospectus
status: final
updated: 2026-09-26
sources:
  - .memlog.md
  - DESIGN.md
  - docs/vision.md
  - docs/glossary.md
  - docs/domains/field-operations.md
  - docs/domains/prospecting.md
  - docs/design.md (screen sections superseded by this file)
---

# Captain Prospectus — Experience Spine

## Foundation

This is one product with two surfaces, built on shadcn/ui + Tailwind CSS v4 (ADR-0014). `DESIGN.md` is the visual identity reference; this file specifies behaviour, and only where it departs from shadcn's defaults.

- **Admin** is a responsive web dashboard. It is designed for a laptop, and also works on a tablet and a phone. It is online only (ADR-0019), uses TanStack Query (ADR-0013), and polls live data every 15 s (ADR-0010).
- **Field** is an offline-first PWA for phones and tablets. Dexie acts as a cache plus an outbox; agents only ever insert (ADR-0007, invariant 2). The admin goes out in the field too, and gets one extra tab.
- **Language.** Every user-facing string is French and lives in `src/client/copy.ts`. Code, database values and docs stay in English (invariant 15). The words come from the glossary.
- **Theme.** Light and dark, following the system, with a manual toggle on the admin side.
- **Dependencies before build.** None of these are UX decisions, but the screens below depend on them:

  | Screen or feature | Needs |
  |---|---|
  | Field map, swipe actions, daily progress | A new ADR that supersedes the 150 kB budget part of ADR-0015 |
  | Admin charts | Recharts via shadcn Chart in the admin chunk, justified in the PR that adds it |
  | Admin round view | Agent position at sync: security review, data-model change, additive sync-contract change, and probably an ADR (agent-position retention is still undecided in field-operations.md) |
  | Top-bar search and notifications | Designed now, built later, once their back end exists |

## Information Architecture

### Admin

The sidebar has three groups. A count badge shows the number waiting in a queue.

| Group | Surface | Purpose |
|---|---|---|
| **Pilotage** | Tableau de bord | How canvassing is going: KPIs, charts, per-agent activity, queues to process, latest visits. The admin's home. |
| **Prospects** | Prospects | The prospect ledger: filter, search, select, assign, export. |
| | Import | Create prospects from a CSV file or from an area on the map. |
| | Doublons *(badge)* | Merge prospects that look like the same place. |
| **Terrain** | Visites | Live feed of the visits agents have synced, with a KPI strip and a date range. |
| | À rattacher *(badge)* | Quarantined visits waiting to be attached to a prospect (ADR-0022). |
| | Scripts | The versioned questionnaire. |
| | Tournée du jour | **New.** A read-only view of any agent's round, ordered from their last synced position. |

- **Top bar, on every admin surface.** Sidebar toggle · breadcrumb · search · notifications · theme · avatar.
  - Search looks up prospects by name and opens the matching row in Prospects.
  - The avatar menu holds the email and "Se déconnecter".
  - `[OPEN QUESTION]` Notifications don't have a defined content yet. The À traiter queue already covers relances, visites à rattacher and doublons. Decide what the bell announces before building it.
- **Dialogs** stack one level deep. The confirmations are: saving a script version, deleting a quarantined visit, and the import result. The session-expired dialog takes that one level from whatever is open rather than stacking on it — an expired session has already made the dialog underneath unactionable (§ State Patterns).

### Field

| Surface | Reached from | Purpose |
|---|---|---|
| **Tournée du jour** | Tab "Tournée" (home) | The next stop, the rest of the round, and follow-ups not yet due |
| **Carte** | Tab "Carte" | Today's round on a map, with the next stop in a sheet |
| **Visite — étape 1: Résultat** | "Visiter" on a stop or a pin, or a swipe | Flyer, outcome, follow-up date, earlier visits |
| **Visite — étape 2: Questions** | "Continuer" | Script questions and notes (skipped when there is no script) |
| **Enregistrer cette visite ?** | "Enregistrer la visite" | Summary, then save to the outbox |
| **Ajouter un prospect** | Tab "Ajouter" | Add a place that isn't on the list |
| **Tableau de bord** | Tab, **admins only** | Opens the admin app (online only) |
| **Page introuvable / accès hors ligne** | Bad link, or first launch offline | Recover |

On a phone, the tabs sit at the bottom. From tablet width they move into the navy band. Tournée and Carte show a two-pane layout on tablet (see Responsive & Platform).

**Closure check.** Each stated need maps to a surface:
- Import → Import.
- Assign → Prospects.
- Watch visits → Tableau de bord and Visites.
- Repair → À rattacher and Doublons.
- Configure questions → Scripts.
- Walk the round → Tournée and Carte.
- Record a visit → Visite.
- Add a place → Ajouter.
- Admin in the field → Tableau de bord tab.
- Admin checks an agent's round → admin Tournée du jour.

Two surfaces have no stated need yet: notifications (open question) and search (to be built later).

→ Composition references (**the spines win on conflict**):
- Stitch, light mode: `stitch/admin/a1…a13`, `stitch/terrain/f1…f8`. They are illustrations; what was kept and dropped is in [`reconcile-stitch.md`](reconcile-stitch.md).
- Key screens rendered from the final tokens: seven files in `mockups/`, listed with what each shows in DESIGN.md › Sources and mockups.
- The earlier screenshots in `imports/current-*` show the app before this redesign. They are superseded and kept for history.

## Voice and Tone

Brand voice lives in `DESIGN.md`. The rules of microcopy:
- Use sentence case and active verbs.
- An error says what happened and what to do.
- An empty screen invites an action rather than shrugging.
- An action keeps its name through the whole flow: "Assigner" produces "Assigné".
- Numbers and dates use fr-FR formats.

| Do | Don't |
|---|---|
| "Visite enregistrée. Elle partira à la prochaine synchronisation." | "Succès ! ✓" |
| "Hors ligne. Vos visites sont conservées et partiront au retour du réseau." | "Erreur réseau" |
| "Aucun prospect. Importez un CSV pour commencer." | "Aucune donnée" |
| "Refus clair." | "Le prospect passe en Refusé." (the phone never predicts the status) |
| Leaving spec text off the screen | "48px targets", "Protocole ADR-0022", "REGISTRY: …" (Stitch leaks) |

**Approved new strings**, to be added to `copy.ts` at build. Placeholders are in `{}`.

| Area | Strings |
|---|---|
| Admin shell | Groups "Pilotage", "Prospects", "Terrain" · avatar menu "Se déconnecter" · search "Rechercher un prospect…" · "Notifications" · "Thème clair" / "Thème sombre" · aria "Ouvrir le menu" / "Réduire le menu" |
| Admin shell — réseau et session | Offline banner "Hors ligne. Les données affichées ne changent plus et se rafraîchiront au retour du réseau." · offline on an admin route after a reload "Hors ligne. Cette page a besoin du réseau. Votre tournée reste accessible." · session dialog "Votre session a expiré" / "Reconnectez-vous pour continuer." The buttons these need — "Se reconnecter", "Retour à la tournée" — and "Vous n'avez pas accès à cette page." are already in `copy.ts`. |
| Tableau de bord | "Tableau de bord" · "Où en est la prospection." · "7 jours" / "30 jours" / "90 jours" · "Prospects ouverts" · "Visites" · "Convertis" · "Taux de conversion" · "{+12,4 %} vs période précédente" · "Visites dans le temps" · "Pipeline par statut" · "{412} prospects" · "Activité par agent" (columns Agent · Visites · Convertis · À relancer · Prospects ouverts) · "À traiter" · "Relances dues" → "Voir" · "Visites à rattacher" → "Rattacher" · "Doublons" "{3} paires" → "Fusionner" · "Dernières visites" · "Tout voir" |
| Prospects, Visites | "Exporter en CSV" · Visites strip: "Taux de conversion", "Flyers remis", "Relances dues sous 7 jours", "Agents en tournée" |
| Field shell | Tabs "Tournée", "Carte", "Ajouter", "Tableau de bord" · strip button "Se reconnecter" (plus the existing "Mettre à jour") |
| Tournée / Carte | "{5} visites sur {17} aujourd'hui" · "Carte indisponible hors ligne. La liste reste à jour." · "Voir la liste" · aria "Me recentrer" |
| Outcome hints | Personne sur place: "Fermé ou personne pour répondre. On repassera." · Intéressé: "Ouvert à la discussion, pas encore d'accord." · Pas intéressé: "Refus clair." · À relancer: "Un rendez-vous à reprendre. Indiquez la date." · Converti: "Accord obtenu." |
| Visit | Step indicators "Étape 1 sur 2 · Résultat" / "Étape 2 sur 2 · Questions" · stepper aria "Diminuer" / "Augmenter" |
| Admin round view | "Agent" · "Choisir un agent" · "Position du {24/09/2026 15:24}" · "Aucune position reçue aujourd'hui. La tournée est triée par nom." · "{17} arrêts" |
| Save sheet | Overline "Validation" · "Enregistrer cette visite ?" · "{Curry House} · {Intéressé} · Flyer remis · {4} réponses" · "La visite reste sur ce téléphone jusqu'à la prochaine synchronisation." · "Modifier" / "Enregistrer" |

## Component Patterns

Behaviour only. Visual specs are in `DESIGN.md › Components`.

| Component | Where | Behavioural rules |
|---|---|---|
| **Period selector** | Tableau de bord header | "7 jours" / "30 jours" / "90 jours", defaulting to 30. It drives every panel that has a period (KPIs, the chart, Activité par agent). One selector only: the chart's own 7J/30J/90J switch in Stitch is dropped as a duplicate. |
| **Visites dans le temps** | Tableau de bord | Stacked bar per day over the selected period, fixed series order (Personne sur place at the bottom, Converti at the top) so the stack reads the same every time. A segment **≥ 22px tall prints its count**; shorter ones stay blank and are read from the tooltip or the visually hidden summary table. Hovering a bar shows every series for that day, zeros included, so a missing segment is never ambiguous. Clicking the legend does **not** toggle series: the counts are the point and a hidden series would make the day totals lie. Rendered in [`mockups/key-a1-outcome-chart.html`](mockups/key-a1-outcome-chart.html). |
| **KPI card** | Tableau de bord, Visites | Figure for the selected period and a delta against the previous period of the same length. Clicking a card opens the filtered list behind it: Prospects ouverts → Prospects filtered to open statuses; Visites → Visites; Convertis → Prospects filtered to Converti. |
| **À traiter queue** | Tableau de bord | Three rows, each with a count and a button to the screen that resolves it. A row whose count is 0 still shows, with the count in muted text and its button disabled. |
| **Dernières visites** | Tableau de bord | The last 5 visits by `received_at`, refreshed by the 15 s poll. A new row gets a brief wash, then settles. "Tout voir" goes to Visites. |
| **One toolbar slot** | Prospects (also Doublons and Visites filters) | The filter bar (search, Statut, Agent, Source) is **replaced in place** by the selection actions as soon as one row is ticked: "{n} sélectionnés", "Assigner à" select, "Assigner", "Désassigner", "Annuler". Same position and height, no floating bar. |
| **Row menu** | Prospects | "Assigner à ›", "Retirer l'assignation", "Changer le statut ›". Submenus open to the side. |
| **Top-bar search** | Admin | ⌘K / Ctrl+K opens a Command palette. It matches prospect names and opens the prospect's row in Prospects. *(Built later.)* |
| **Table pagination** | Prospects, Visites | 25 rows per page, with "Précédent", page numbers and "Suivant". The page scrolls; tables never get a scroll area of their own. |
| **Live feed** | Visites | Ordered by `received_at` (the server's clock), newest first. Notes show on a second line, in quotes. A visit to a merged prospect still appears, under the name it was made against. Arrivals are ambient: no toast. |
| **Import stepper** | Import | CSV path: Source · Fichier · Colonnes · Aperçu. Map path: Source · Zone. The file is read in the browser and never uploaded. Rejected CSV rows are listed first, struck through, with their reason. |
| **Map import** | Import › Zone | The map and the results sit side by side, so the admin can move a vertex and search again. The provider select sits above the map. Changing the provider clears the drawing. Actions sit under the map: vertex count, "Annuler le dernier point", "Effacer", then the gold "Rechercher dans la zone". Unnamed places are listed struck through and can't be imported. Places that look already listed are left out unless the single checkbox is ticked, and that checkbox resets on every new search. A cached result says so, with its age. |
| **Doublons pair** | Doublons | Two stacked rows with the distance shown once for the pair. "Garder" on either row keeps that one and merges the other into it, with no confirmation (merging keeps every visit). |
| **Repair row** | À rattacher | The outcome edge previews the effect, and the page lede says the effect has not happened yet. Candidate buttons show the distance inside the button, nearest first; the server proposes them. "Supprimer" sits far right and opens the destructive confirmation. |
| **Script editor** | Scripts | Question cards reorder with a drag handle **and with the keyboard** (dnd-kit keyboard sensor). A saved key is locked, and "Modifier la clé" unlocks it with a warning that stays visible. Save opens the confirmation that names the version it will create. The versions rail is read-only. |
| **Next-stop card** | Tournée du jour | The first stop in walking order. "Y aller" opens the phone's maps app with walking directions to the stop. "Visiter" opens Visite, step 1. |
| **Stop row** | Tournée du jour, Carte list | Swipe left → **Visiter**; swipe right → **Y aller**. Tapping a row expands it in place to show the same two buttons, so neither action needs a swipe. Swipes only start agent-allowed actions and never change shared data (invariant 2). |
| **Daily progress** | Tournée du jour | "{n} visites sur {total} aujourd'hui" with a bar. n = the agent's visits recorded today, including those not yet sent; total = n + stops still on today's list. Only the bar and the count: no percentage, no ETA, no "restants". |
| **Plus tard** | Tournée du jour | Follow-ups whose date hasn't come yet, each with "À relancer le {date}". They can't be visited from here. |
| **Carte sheet** | Carte | A bottom sheet shows the next stop (number, name, type, distance) with "Y aller" and "Visiter". Tapping another pin moves the sheet to that stop. The re-centre button follows the agent's position. The sheet always sits above the tab bar. |
| **Outcome cards** | Visite, step 1 | Single choice; required before "Continuer". Choosing "À relancer" reveals "Relancer le" with a native date input. The cards never show or imply a status (invariant 3). |
| **Step indicator** | Visite | "Étape 1 sur 2 · Résultat" and "Étape 2 sur 2 · Questions". When there is no script, the visit is one step with no indicator, and the button reads "Enregistrer la visite". |
| **Back links** | Visite | Step 1: "Retour à la tournée". Step 2: "Résultat", which goes back to step 1 with the draft intact. |
| **Number stepper** | Visite, step 2 | − / + change the value by 1. The number stays typeable, and the field never goes below 0. |
| **Save sheet / dialog** | Visite | "Enregistrer la visite" opens the summary. "Enregistrer" writes the visit to the outbox, returns to Tournée du jour and shows the existing "Visite enregistrée…" message. "Modifier" closes the sheet and leaves the form as it was. |
| **Ajouter un prospect** | Tab Ajouter | Nom and Type are required. "Utiliser ma position" fills the position and then reads "Actualiser". Adresse and Téléphone are optional. "Ajouter" writes the place to the outbox, and it joins the list at once. |
| **Sync dot and strip** | Every field screen | The sync state is a condition, not an event: a dot and count in the band, plus a strip only when there is something to say. Never a toast. Waiting-to-send, offline and failed states retry on their own and have no button. "Se reconnecter" and "Mettre à jour" are the only buttons. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Loading | Admin, every screen | Skeletons shaped like the content: 4 KPI blocks, the chart area, 6–8 table rows. |
| Load failed | Admin | An inline Alert where the content would be, e.g. "Impossible de charger les prospects. Réessayez.", with "Réessayer". |
| Action done / failed | Admin | A Sonner toast at bottom right: "3 prospects assignés", "Version 3 enregistrée et activée.", "L'assignation a échoué. Réessayez." Toasts are for things the admin *did*. |
| Offline | Admin | A full-width Alert takes the update banner's slot: "Hors ligne. Les données affichées ne changent plus et se rafraîchiront au retour du réseau." Panels keep their last-loaded values instead of each flipping to a Load-failed Alert. No button — the 15 s poll retries on its own, and the banner goes as soon as an answer comes back. A network drop while the admin chunk is still loading (ADR-0019: it is not precached) gets the same sentence with "Réessayer". |
| Offline, after a reload | Admin routes | "Hors ligne. Cette page a besoin du réseau. Votre tournée reste accessible." with "Retour à la tournée", in the field band. A reload with no network can only open the precached field shell (ADR-0019), where `/api/me` is unreachable and the cached identity opens the field shell no matter which role it records. This is not the permission-denied state below, and must not borrow its words. |
| Session expired | Admin | A blocking dialog, because a write on an expired session looks like it worked: "Votre session a expiré" / "Reconnectez-vous pour continuer." with "Se reconnecter" as its only action. Nothing behind it is usable, so it takes the one dialog level, and Esc and the scrim do not close it. "Se reconnecter" is the field strip's marker navigation, the only one that reaches Access through the precached shell (`identity-access.md`); being a real navigation it loses a half-filled import or script draft, so the dialog interrupts rather than waits. |
| Not an admin | Admin routes | A signed-in agent gets the field band and an empty state with a lock icon: "Vous n'avez pas accès à cette page." with "Retour à la tournée". The route never renders the admin shell, and the Worker answers 403 on every `/api/admin/*` call whatever the client renders (invariant 10, `identity-access.md`). |
| New build available | Admin, Field | A banner: "Une nouvelle version est disponible." with "Plus tard" and "Mettre à jour". The admin offline banner takes this slot ahead of it; they never both apply, since a build cannot be fetched offline. |
| Import running | Import › Aperçu | A progress bar with "Import en cours : {50} / {124}". Batches of 250 rows (invariant 13). The page can't be left without a browser confirmation. |
| Import done | Import | A dialog: "Import terminé" with "{118} prospects créés · {6} mis à jour · {4} lignes rejetées", then "Terminer" and "Voir les prospects". |
| Import failed mid-way | Import | An inline Alert naming how many rows went in. A retry re-sends from the start; it's safe because every write is idempotent (invariant 4). |
| Saving a script | Scripts | The dialog button shows a spinner and is disabled until the server answers, then the toast "Version {3} enregistrée et activée." |
| Search, no match | Top-bar search *(built later)* | "Aucun prospect ne porte ce nom." |
| Empty: no prospects | Prospects | "Aucun prospect. Importez un CSV pour commencer." with "Importer un CSV". |
| Empty: filters match nothing | Prospects | "Aucun prospect ne correspond à ces filtres." with "Effacer les filtres". |
| Empty queues | Doublons, À rattacher | "Aucun doublon détecté." / "Aucune visite à rattacher. Tout ce que les agents ont envoyé est arrivé à destination." (the healthy state) |
| Empty feed | Visites, Dernières visites | "Aucune visite reçue. Les visites apparaissent ici dès qu'un agent synchronise." |
| Empty round | Tournée du jour | "Aucun prospect à visiter. Synchronisez pour récupérer votre liste." |
| Position denied | Tournée du jour, Carte | Under the title: "Sans votre position, la tournée n'est pas triée par distance." with "Réessayer". Distances read "Position inconnue". |
| Offline | Field shell | The strip reads "Hors ligne. Vos visites sont conservées et partiront au retour du réseau." Everything except the map keeps working. |
| Offline map | Carte | Grey canvas with "Carte indisponible hors ligne. La liste reste à jour." and "Voir la liste". Tiles are never downloaded in bulk (OSM tile policy). |
| Waiting to send | Field shell, stop rows | Amber dot with a count, and the strip "{n} éléments en attente d'envoi". The row of a stop visited but not yet sent shows "Pas encore envoyé". |
| Session expired | Field shell | Red strip "Votre session a expiré. Reconnectez-vous pour synchroniser." with "Se reconnecter". The outbox is kept (invariant 5). |
| Update required (426) | Field shell | Strip "Une mise à jour est nécessaire. Vos visites sont conservées." with "Mettre à jour". The outbox is kept. |
| Sync failed | Field shell | Strip "La synchronisation a échoué. Nouvel essai automatique." No button. |
| Syncing | Field shell | A pulsing dot. No strip unless something is also waiting. |
| Outcome missing | Visite, step 1 | "Choisissez un résultat." under Résultat. The screen scrolls to it and focuses it. |
| Invalid answer | Visite, step 2 | Saving scrolls to the first invalid question and focuses it. With Personne sur place, no answer is required, and the note "Personne sur place : répondez seulement si vous savez." shows at the top. |
| Missing name | Ajouter | "Indiquez le nom de l'établissement." under Nom. |
| Not found / offline sign-in | Field | "Page introuvable." with "Retour à la tournée". "Impossible de vous identifier hors ligne. Connectez-vous une fois avec du réseau." |
| No agent position | Admin Tournée du jour | The list is ordered by name, with the notice "Aucune position reçue aujourd'hui…". Every position shows its age. |

## Interaction Primitives

- **Field is thumb-first.** Everything is a tap on a target of at least 48px; outcomes are at least 56px. There are swipes on stop rows, and each swipe action can also be reached by tapping. There is no long-press, no pull-to-refresh (sync runs on its own triggers), and no hover-only affordance.
- **Native controls on the field route** where the platform already has them: the date input, the radio and checkbox semantics under the styled cards (ADR-0015). Forms use react-hook-form with the shared validators (ADR-0018).
- **Admin is pointer- and keyboard-friendly.**
  - ⌘K / Ctrl+K opens search.
  - Tab order follows reading order.
  - Esc closes the top dialog, sheet or menu — except the session-expired dialog, which has nothing usable behind it (§ State Patterns).
  - Row checkboxes and the row menu are reachable from the keyboard.
  - Drawing a map zone needs a pointer, and the screen says so. The CSV path is the keyboard-accessible alternative.
- **Motion only where something changed**: the toolbar swap, a new row settling, the swipe reveal, the sheet sliding up. Under `prefers-reduced-motion` all of these are instant.
- **Confirmations.** Three, all dialogs or sheets: save the visit, save a script version, delete a quarantined visit. Merges, assignments and status changes are reversible or additive, so they don't ask.

## Accessibility Floor

Visual contrast is in `DESIGN.md` and asserted in `palette.test.ts`.

- WCAG 2.2 AA on both surfaces, in light and dark.
- Colour never carries meaning alone: status, outcome, delta and sync state each have a French label or a count.
- The focus ring is visible everywhere (`ring`, never gold).
- The selected outcome card, answer or chip also shows a check icon, not just a gold fill.
- Every icon-only button has an aria-label from `copy.ts` (menu toggle, search, notifications, theme, re-centre, stepper − / +).
- The sync strip is an `aria-live="polite"` region. Session expired and update required are `assertive`.
- On the admin side, the offline banner is an `aria-live="polite"` region too, announced once when it appears and once when it goes. The session-expired dialog is an `alertdialog` that takes focus and keeps it (§ State Patterns).
- New feed rows are announced politely, at most one announcement per poll.
- Charts come with a text equivalent: the Pipeline list already *is* text, and "Visites dans le temps" gets a visually hidden summary table.
- **Stacked segments are told apart by more than hue.** Each series is 3:1 against the card (`{colors.outcome-no-contact}` and the rest — see DESIGN.md), and neighbouring segments are separated by a 1px card-coloured stroke plus an in-segment count. Series are *not* 3:1 against one another and cannot be: five such series need an 81:1 luminance range, sRGB has 21:1. The stroke and the count are what satisfy WCAG 1.4.11 here, so neither is decorative and neither may be dropped for density. Each series' measured ratio is tabulated in [`mockups/key-a1-outcome-chart.html`](mockups/key-a1-outcome-chart.html).
- Script reordering works from the keyboard, and swipe actions have tap equivalents.
- Field text is at least 16px, and inputs are 16px so iOS never zooms.
- Screens reflow at 200 % text size without cutting off controls.

## Responsive & Platform

| Width | Admin | Field |
|---|---|---|
| < 768px (phone) | The sidebar becomes a Sheet behind the menu button. KPIs and panels stack in one column. Prospects becomes a list of rows (name, type, status, agent). The selection toolbar wraps onto two lines. | Bottom tabs. One pane. Sticky actions sit above the tab bar. |
| 768–1023px (tablet) | The sidebar collapses to icons. KPIs go 2×2; the chart and panels stack. | Tabs move into the navy band. Tournée: list left, next stop right. Carte: list left, map right. Visite: form left, history and map right. Save confirmation becomes a centred dialog. |
| ≥ 1024px | Full sidebar. The dashboard grid from DESIGN.md. | Same as tablet. |

The field PWA installs from the phone browser; on a phone, safe-area insets apply to the band and to the tab bar. The admin app is not cached for offline use (ADR-0019) — § State Patterns says what an offline admin sees, before and after a reload. The service worker never caches `/api/*` (invariant 8).

## Dashboard metrics

Each figure is defined once here, and the Worker computes it. "Period" is the dashboard selector or the Visites date range.

| Figure | Definition |
|---|---|
| Prospects ouverts | Live (non-merged) prospects whose status is new, assigned or follow_up. A snapshot, so it has no delta. |
| Visites | Visits whose `visited_at` falls in the period (clamped per invariant 12). |
| Convertis | Prospects that became converted during the period. |
| **Taux de conversion** | Prospects that became Converti during the period ÷ distinct prospects visited during the period. |
| Pipeline par statut | Count and share of live prospects in each status. A snapshot. |
| Activité par agent | Per agent: visits in the period, conversions in the period, follow_up prospects assigned to them now, open prospects assigned to them now. |
| Relances dues | follow_up prospects whose `next_visit_at` is today or earlier. |
| Flyers remis | Visits in the period with `flyer_given`. |
| Relances dues sous 7 jours | follow_up prospects whose `next_visit_at` falls within the next 7 days. |
| Agents en tournée | Agents who synced at least once today. |
| Delta | (period − previous period of the same length) ÷ previous period. Shows "—" when the previous period is 0. |

## Inspiration & Anti-patterns

- **Taken from the shadcn "SaaS AI" dashboard demo, in a minimal form:** sidebar navigation, KPI cards with sparklines and deltas, chart panels, tables (`imports/inspiration-shadcn-saas-ai-dashboard.png`).
- **Taken from Stitch and kept:**
  - The Visites KPI strip.
  - A one-line hint under each outcome.
  - The number stepper.
  - Prospect name search.
  - Status badges.
  - The next stop as a card.
  - The step indicator.
  - Script questions as cards.
  - The full top bar.
  - The bottom sheet for saving a visit.
- **Rejected from Stitch:**
  - Business-register matching (SIRET/BCE), automatic address lookup, NAF codes.
  - Route optimisation, printing a route sheet, battery and network readings.
  - Voice notes, prices shown to agents, an extra "Qualification terrain" import step.
  - Import history, the "Aperçu mobile agent" panel, a proximity-tolerance card.
  - A duplicate pending card on Tournée du jour.
  - Downloading map tiles in bulk for offline use.
- **Rejected on principle:**
  - Previewing the resulting status on the phone (invariant 3).
  - Any agent-side edit of shared data (invariant 2).
  - Toasts for lasting conditions such as sync state.

## Key Flows

### Flow 1 — A door on Rue du Midi (Léa, field agent, Tuesday 11:40, weak 4G)

→ Steps 1 and 3–5 appear in [`mockups/key-f1-tournee.html`](mockups/key-f1-tournee.html) and [`mockups/key-f3-f5-visit.html`](mockups/key-f3-f5-visit.html).

1. Léa opens the app. Tournée du jour shows "5 visites sur 17 aujourd'hui". The next stop is **1 · Curry House · Restaurant · 350 m**. The band shows an amber dot with "2": two visits from the morning are still waiting to send.
2. They tap "Y aller"; their maps app walks them there. Back in the app, they tap "Visiter".
3. Step 1: they tick "Flyer remis" and tap "Intéressé". The card turns gold, with a check. "Visites précédentes" shows a note from 12 September.
4. "Continuer" takes them to step 2. They answer four questions: Oui; Papier; 45 couverts with the stepper; Accueil 4. Then they type a note.
5. "Enregistrer la visite" opens the sheet: "Curry House · Intéressé · Flyer remis · 4 réponses".
6. **Climax:** they tap "Enregistrer". They're back on the round at once. Curry House is gone, the progress reads 6 of 17, the next stop is Bar des Marolles, and the band dot now shows "3". Nothing asks them to wait for the network. The visit is safe on the phone, and they're already walking.

Failure: the signal drops. The strip says "Hors ligne…", and everything above still works except the Carte tiles. When the network is back, the dot turns green without them doing anything.

### Flow 2 — Monday morning check (the admin, at a desk, 09:00)

→ Step 1 appears in [`mockups/key-a1-dashboard.html`](mockups/key-a1-dashboard.html).

1. The admin opens Tableau de bord on 30 jours: 386 visites (+12,4 %), 18 convertis, taux 10,6 %.
2. À traiter shows "Relances dues 6", "Visites à rattacher 2" and "Doublons 3 paires".
3. They click "Rattacher" and attach one visit to Pizza Roma (40 m). The À rattacher badge drops to 1.
4. In Prospects, they tick 12 new rows from last week's Ixelles import. The filter bar turns into the selection actions. They choose "Assigner à" lea@exemple.be, then "Assigner".
5. **Climax:** the toast "12 prospects assignés" appears, and back on Tableau de bord, Prospects ouverts and Léa's row in Activité par agent have both moved. The morning's work shows in the figures the admin started from.

### Flow 3 — Where is the round at? (the admin, mid-afternoon)

→ See [`mockups/key-admin-round.html`](mockups/key-admin-round.html).

1. From the sidebar, the admin opens Terrain › Tournée du jour and picks Léa.
2. The list is ordered from Léa's last synced position ("Position du 24/09/2026 15:24"), with the remaining stops as numbered pins on the map.
3. **Climax:** without calling Léa, the admin sees 11 stops left around the Marolles, and decides the 6 follow-ups due tomorrow can go to Karim instead.

Failure: Léa hasn't synced today. The list is ordered by name, with the no-position notice.

### Flow 4 — A place that isn't on the list (Karim, field agent)

1. Walking between stops, Karim spots a new friterie. They tap the Ajouter tab.
2. They type "Friterie des Minimes", pick "Restauration rapide" and tap "Utiliser ma position".
3. **Climax:** "Ajouter" puts it straight on their round, as the nearest stop. They tap "Visiter" without leaving the pavement.
