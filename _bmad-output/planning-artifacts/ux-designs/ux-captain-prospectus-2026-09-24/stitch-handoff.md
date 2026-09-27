# Stitch handoff — Captain Prospectus

Design handoff for [Google Stitch](https://stitch.withgoogle.com). Everything
below is assembled from this run's `.memlog.md`; where it and a Stitch output
disagree, the memlog (and later `DESIGN.md` / `EXPERIENCE.md`) wins.

## How to run it

1. Make **two Stitch projects**:
   - `Captain Prospectus — Admin`, in **Web** mode.
   - `Captain Prospectus — Terrain`, in **App** (mobile) mode.
2. In each project, paste **Prompt 0 (design system)** first. Attach
   `docs/brand/logo-form.png` (the logo) to both. To the Admin project also
   attach `imports/inspiration-shadcn-saas-ai-dashboard.png`.
3. Then paste the screen prompts **one at a time**, in order: A1–A13 into Admin,
   F1–F8 into Terrain. Each one assumes the shell from the first prompt of its
   project.
4. When a screen looks right in light, ask Stitch: *"Make a dark mode version of
   this screen using the dark tokens from the design system."* Both themes are
   required.
5. For admin screens, also ask for the **tablet** and **phone** layouts (see
   "Responsive" in A1).
6. Export from Stitch: per-screen HTML, a PNG of each screen, and the DESIGN.md
   Stitch generates. Save them to this folder:
   - `stitch/admin/` — `a01-tableau-de-bord.html`, `a01-tableau-de-bord.png`, …
   - `stitch/terrain/` — `f01-tournee.html`, …
   - `stitch/DESIGN.stitch.md`
7. Come back and run `/bmad-ux` in **Update** mode. I'll reconcile the outputs
   into `DESIGN.md` and write `EXPERIENCE.md`.

Items marked **[ASSUMPTION]** are my fill-ins for gaps you did not decide.
Change them in the prompt before you paste, or tell me after.

---

## Prompt 0 — Design system (paste first in both projects)

```
Captain Prospectus is a B2B field-canvassing app used in Brussels. An admin imports
restaurants, cafés, bars and food trucks (from a CSV file or from an area drawn on a
map), assigns them to field agents, and watches visits come in. Field agents walk a
daily round on their phone, visit each place, hand over a flyer and record the outcome.
The admin also goes out in the field sometimes.

ALL USER-FACING TEXT IS IN FRENCH. Use exactly the French strings I give in quotes.
Sentence case everywhere. Dates like "24/09/2026 15:24", numbers in fr-FR ("1 284").

Visual style: a minimal shadcn/ui dashboard (Tailwind CSS v4, shadcn/ui components,
Lucide icons). Think of the shadcn "SaaS dashboard" demos, but quieter: fewer
decorations, more whitespace, and one accent colour.

Brand (fixed, do not change):
- Logo: the attached mark (a ship's wheel around a map pin) with the wordmark
  "Captain Prospectus".
- Navy #1B2A4A is the ink. Gold #C9A227 is the primary action colour. The page is
  off-white #F6F7F0.

Colour tokens (light / dark). Provide both themes; dark follows the system.
- background #F6F7F0 / #101726
- card #FFFFFF / #182031
- foreground #1B2A4A / #E7EAF0
- secondary (and muted, accent) #E8EAEF / #222B3D
- muted-foreground #5A6478 / #97A2B8
- border (and input) #D7DAE2 / #2B3547
- primary (gold) #C9A227 / #D9B43C, with a 1px border primary-edge #A8801A / #E6C65C
- primary-foreground #1B2A4A / #141C2E
- ring (focus) #1B2A4A / #E7EAF0
- success #1F6F4A / #4FA97D
- warn #9A6B12 / #D98A3C
- destructive #8C2F39 / #D2757E
- sidebar/band #1B2A4A / #0B1120, text on it #EEF0F4, muted text on it #95A0B8

Gold rules: text on a gold button is navy, never white. Never use gold as text on a
light surface. The focus ring is navy (light) / near-white (dark), never gold.

Prospect status (always show the French label; colour must never carry meaning alone):
- "Nouveau" neutral grey · "Assigné" slate · "À relancer" warn · "Converti" success ·
  "Refusé" destructive.
Visit outcome labels: "Personne sur place", "Intéressé", "Pas intéressé", "À relancer",
"Converti".
Prospect types: "Restaurant", "Restauration rapide", "Café", "Bar", "Food truck", "Autre".
Sources: "CSV", "Carte (OSM)", "Carte (Google)", "Terrain".

Typography: Archivo (variable) for everything, no second typeface and no monospace.
Sizes: 12px meta and table headers · 14px admin body and cells · 16px field body and
all inputs · 20px screen titles · 28px key figures. Figures use tabular numerals and
are right-aligned in tables.

Shape and spacing: radius 6px (cards 12px). Touch targets 48px minimum on the field
side; the five outcome choices are 56px tall. Table rows 44px.

Every map shows the attribution "© les contributeurs OpenStreetMap".
```

---

## Admin project (Web)

### A1 — Shell + Tableau de bord

```
Screen: "Tableau de bord" — the admin's home. Desktop 1440px wide.

Shell (reused by every admin screen):
- Left sidebar, collapsible to icons. Top: logo + "Captain Prospectus".
  Nav groups [ASSUMPTION on grouping]:
  · "Pilotage": "Tableau de bord"
  · "Prospects": "Prospects", "Import", "Doublons" (count badge 3), "À rattacher"
    (count badge 2)
  · "Terrain": "Visites", "Scripts", "Tournée du jour"
  Bottom of the sidebar: the signed-in email "admin@exemple.be", with a small
  green/amber sync dot.
- Thin top bar: sidebar toggle, page title, light/dark toggle.

Content, top to bottom:
1. Header: title "Tableau de bord", subtitle "Où en est la prospection.", and on the
   right a period selector: "7 jours" / "30 jours" / "90 jours" (30 selected).
2. Four KPI cards in a row, each with an icon, a label, a big figure, a delta vs the
   previous period (green or red) and a small sparkline or mini-bars:
   - "Prospects ouverts" 214 (Nouveau + Assigné + À relancer)
   - "Visites" 386, +12,4 % vs période précédente
   - "Convertis" 41, +8,0 %
   - "Taux de conversion" 10,6 % [ASSUMPTION: Convertis ÷ prospects visités]
3. Two panels side by side:
   - Wide: "Visites dans le temps": stacked bars per day, one colour per outcome
     (5 outcomes, with a legend), and a 7J / 30J / 90J switch.
   - Narrow: "Pipeline par statut": the 5 statuses as a horizontal bar list with
     count and share, total 412 prospects.
4. Two panels side by side:
   - "Activité par agent": a table with the columns "Agent", "Visites", "Convertis",
     "À relancer", "Prospects ouverts". Two agents: "lea@exemple.be" and
     "karim@exemple.be", plus the admin.
   - "À traiter": three action rows, each with a count and a button:
     "Relances dues" 6 ("Voir"), "Visites à rattacher" 2 ("Rattacher"),
     "Doublons" 3 paires ("Fusionner").
5. "Dernières visites": the last 5 visits (time, prospect, outcome, "Flyer remis",
   agent) and a "Tout voir" link. New visits arrive live.

Responsive: on tablet the sidebar collapses to icons and the KPI cards go 2×2; on
phone the sidebar becomes a drawer behind a menu button, and cards and panels stack
in one column.
```

### A2 — Prospects

```
Screen: "Prospects" in the admin shell ("Prospects" active).
Header: title "Prospects", count "412 prospects"; buttons "Exporter en CSV"
(secondary) and "Importer un CSV" (gold primary).
Filter bar: selects "Statut" ("Tous les statuts"), "Agent" ("Tous les agents"),
"Source" ("Toutes les sources").
Table in a card, with the columns: checkbox | "Nom" | "Type" | "Adresse" | "Statut" |
"Agent" | "Dernière visite" | row menu (…). Use realistic Brussels places, e.g.
"Pasta Presto", "Chez Léa", "Street Food Bruxelles", "Café de la Gare",
"Le Comptoir Bruxellois", "Sushi Sablon". An empty cell shows "—".
Show a second state: 3 rows selected. The filter bar is replaced in place by
"3 sélectionnés", a select "Assigner à" ("Choisir un agent"), and the buttons
"Assigner", "Désassigner", "Annuler".
Row menu items: "Assigner à ›", "Retirer l'assignation", "Changer le statut ›".
Phone: the table becomes a list of rows (name, type, status, agent).
```

### A3 — Prospects: empty and no-results states

```
Two small states of the Prospects screen:
1. No data: "Aucun prospect. Importez un CSV pour commencer." with an
   "Importer un CSV" button.
2. Filters match nothing: "Aucun prospect ne correspond à ces filtres." with
   "Effacer les filtres".
```

### A4 — Import: source

```
Screen: "Importer des prospects", step 1 of a stepper. The CSV path runs
"Source · Fichier · Colonnes · Aperçu"; the map path runs "Source · Zone".
Question: "D'où viennent les prospects ?" Two large choices:
- "Un fichier CSV" — "Un export de tableur, lu dans votre navigateur."
- "Une zone sur la carte" — "Les commerces qu'OpenStreetMap ou Google connaissent dans
  la zone que vous dessinez."
```

### A5 — Import CSV: fichier + colonnes

```
Two steps of the CSV import.
Fichier: a drop zone with a "Choisir un fichier CSV" button and the hint "Le fichier est lu
dans votre navigateur. Il n'est jamais envoyé ni conservé."
Colonnes: "prospects-ixelles.csv — 128 lignes". Lede: "Indiquez quelle colonne
correspond à quel champ." One row per field, each with a select of the file's
headers (plus "Ne pas importer") and the first row's value underneath: "Nom *",
"Type", "Latitude", "Longitude", "Adresse", "Téléphone", "Site web", "Cuisine",
"Identifiant source". Buttons: "Retour", and gold "Voir l'aperçu".
```

### A6 — Import CSV: aperçu + terminé

```
Aperçu: two big figures, "124 lignes à importer" and "4 lignes rejetées" (in
destructive colour). Table with the columns "Nom", "Type", "Adresse", "Coordonnées",
"Remarque". Rejected rows come first, struck through, with "Nom manquant" or
"Valeur invalide"; some ready rows show "Sans coordonnées". Buttons: "Retour", and
gold "Importer 124 lignes". Show an in-progress variant: a progress bar and
"Import en cours : 50 / 124".
Result dialog: "Import terminé" — "118 prospects créés · 6 mis à jour · 4 lignes
rejetées" — buttons "Terminer" and gold "Voir les prospects".
```

### A7 — Import carte: zone + résultats

```
Screen: map import step "Zone". Two columns.
Left: a "Données" select ("OpenStreetMap" / "Google Places") with the hint "Gratuit et
sans limite. Couverture variable selon la ville." Lede: "Dessinez une zone : cliquez
pour poser chaque sommet." A large Leaflet/OSM map of central Brussels with a drawn
polygon. Under the map: "6 sommets", and the buttons "Annuler le dernier point",
"Effacer", and gold "Rechercher dans la zone".
Right, results panel: "38 lieux trouvés", "5 semblent déjà dans la liste" (warn),
"2 sans nom", and a note "Résultat en cache, actualisé sous 7 jours." Below, a
candidate list (name, type, address), where:
- a new place gets a success mark;
- a place that looks already listed gets a warn mark and "Semble déjà dans la liste :
  Chez Léa";
- an unnamed place is struck through as "Sans nom".
A checkbox under the list reads "Importer aussi les 5 lieux qui semblent déjà dans la
liste", with the hint "Un doublon importé se fusionne ensuite depuis l'écran
Doublons." Buttons: "Retour", and gold "Importer 31 prospects".
Also show the Google variant of the lede: "Dessinez un cercle : cliquez pour placer
le centre, puis pour fixer le rayon." and "Rayon 400 m".
```

### A8 — Doublons

```
Screen: "Doublons", count "3 paires". Lede: "Ces prospects semblent désigner le même
endroit. C'est ici qu'on les réunit."
Each pair is a group of two stacked rows with the columns "Nom" (name + address),
"Statut", "Agent", "Visites", "Distance" (one value for the pair, e.g. "12 m"). Each
row has a "Garder" button, which keeps that one and merges the other into it.
Empty state: "Aucun doublon détecté."
```

### A9 — À rattacher

```
Screen: "Visites à rattacher", count "2 visites". Lede: "Ces visites sont conservées,
mais elles ne comptent pas encore. Rattachez chacune au bon prospect."
Each item shows the date and time, the outcome, "Flyer remis", the agent, the reason on
the right ("Prospect introuvable" or "Prospect d'un autre agent"), and the notes in
quotes. Actions:
- one button "Rattacher à Pizza Roma";
- or "Rattacher à" followed by candidate buttons "Pizza Roma · 40 m", "Roma Express · 120 m";
- and "Supprimer" on the right.
Confirm dialog: "Supprimer cette visite ?" — "C'est la seule copie : le téléphone de
l'agent ne l'a plus. Elle sera définitivement perdue." — "Annuler" and destructive
"Supprimer définitivement".
Empty: "Aucune visite à rattacher. Tout ce que les agents ont envoyé est arrivé à
destination."
```

### A10 — Visites

```
Screen: "Visites", count "47 visites", lede "Les visites arrivent ici dès qu'un agent
synchronise." On the right, a date range ("30 derniers jours") and a secondary
"Exporter en CSV" button.
A live feed. Each row: received time "23/09/2026 15:24", prospect name, outcome,
"Flyer remis" when given, agent; notes on a second line in quotes. The newest row
has a subtle highlight as it just arrived. Newest first.
Empty: "Aucune visite reçue. Les visites apparaissent ici dès qu'un agent
synchronise."
```

### A11 — Scripts

```
Screen: "Scripts". Lede: "Le questionnaire posé à chaque visite. L'enregistrement crée
une nouvelle version et l'active aussitôt ; les versions précédentes restent pour les
visites déjà répondues."
Main column: "Nom du script" input ("Questionnaire par défaut"); "Questions" with an
"Ajouter une question" button; a sortable list of question cards. Each card has a drag
handle, a number, a label input ("Proposez-vous la livraison ?"), a type select
("Oui / non", "Choix unique", "Choix multiple", "Texte", "Nombre", "Note (1 à 5)"),
an "Obligatoire" checkbox, a delete icon, and a "Clé" field. When the key is locked
(e.g. "has_delivery"), it shows a "Modifier la clé" button and "Cette clé existe déjà
dans une version enregistrée." The "Choix unique" card lists its choices ("Aucun",
"Papier", "Une autre application"), each with a delete icon, and "Ajouter un choix".
Footer: "L'enregistrement crée une nouvelle version et l'active immédiatement." and
gold "Enregistrer une nouvelle version".
Right rail "Versions": "Version 2 · Active" and "Version 1 · Inactive", each with a date
and "4 questions".
```

### A12 — Scripts: confirm dialog

```
Dialog: "Enregistrer une nouvelle version ?" — "Cela crée la version 3 et l'active pour
toutes les prochaines visites." — "Annuler" and gold "Enregistrer".
```

### A13 — Admin states

```
One board of shared admin states:
- a loading skeleton for a table and for the KPI cards;
- an error alert "Impossible de charger les prospects. Réessayez.";
- toasts at the bottom right: "3 prospects assignés", "Version 3 enregistrée et
  activée.", "L'assignation a échoué. Réessayez.";
- the update banner "Une nouvelle version est disponible." with "Plus tard" and gold
  "Mettre à jour".
```

---

## Terrain project (App, phone 390×844; also show tablet for F1)

### F1 — Shell + Tournée du jour

```
Screen: "Tournée du jour" — the agent's round for today. Phone, one-handed use
outdoors in the sun: large text (16px body), 48px targets.

Shell (reused by every field screen):
- Top bar: logo mark, "Captain Prospectus", and on the right a sync dot with a
  pending count (e.g. amber dot "2").
- A sync strip under the top bar, only when there is something to say (see F8).
- Bottom tab bar [ASSUMPTION on tabs]: "Tournée" (active), "Carte", "Ajouter". An
  admin also gets a 4th tab, "Tableau de bord".

Content:
1. Title "Tournée du jour", subtitle "17 arrêts".
2. Daily progress: "5 visites sur 17 aujourd'hui", with a progress bar or ring.
3. The next stop, given prominence: number "1", "Curry House", "Restaurant",
   "Rue du Midi 42", "350 m"; two big buttons, "Y aller" (secondary) and gold
   "Visiter".
4. The rest of the round: a numbered list (2, 3, 4…) with name, type and distance,
   e.g. "Bar des Marolles · Bar · 500 m". One row shows a warn badge "Pas encore
   envoyé".
   Rows are swipeable: show one row mid-swipe, revealing "Visiter" on one side and
   "Y aller" on the other.
5. A "Plus tard" section: follow-ups not due yet, each with "À relancer le
   02/10/2026".
Variant: position denied. Under the title: "Sans votre position, la tournée n'est pas
triée par distance." with a "Réessayer" link, and "Position inconnue" instead of the
distances.
Empty state: "Aucun prospect à visiter. Synchronisez pour récupérer votre liste."
Tablet: a two-pane layout, the list on the left and the next stop on the right.
```

### F2 — Carte

```
Screen: "Carte" tab — today's round on a map. A full-bleed OSM map of Brussels with
numbered pins in walking order (1 highlighted in gold) and the agent's position as a
blue dot. At the bottom, a sheet with the next stop ("1 · Curry House · Restaurant ·
350 m") and the buttons "Y aller" and gold "Visiter". A button to re-centre on me.
Attribution: "© les contributeurs OpenStreetMap".
Offline variant: grey tiles with the notice "Carte indisponible hors ligne. La liste
reste à jour." and a "Voir la liste" link. [ASSUMPTION: this copy is new]
```

### F3 — Visite, étape 1: résultat

```
Screen: a visit, step 1. Back link "Retour à la tournée". Title "Curry House",
subtitle "Restaurant".
- A large "Flyer remis" checkbox row, with the hint "Cochez si vous avez laissé un
  flyer sur place."
- "Résultat": five full-width 56px radio cards: "Personne sur place", "Intéressé",
  "Pas intéressé", "À relancer", "Converti". Each has a small colour cue matching the
  status it leads to.
- When "À relancer" is picked, a "Relancer le" date field appears under it (native
  date input).
- "Visites précédentes": a short history (date, outcome, notes), or "Première visite
  à cet endroit."
- A sticky bottom button, gold "Continuer" (full width, above the tab bar).
Error: under Résultat, "Choisissez un résultat."
```

### F4 — Visite, étape 2: questions

```
Screen: a visit, step 2. Back link "← Résultat". Title "Curry House".
"Questions": a script of 4 questions:
- "Proposez-vous la livraison ?" with "Oui" / "Non" as big radio buttons;
- "Quel logiciel de caisse utilisez-vous ?" as a single choice ("Aucun", "Papier",
  "Une autre application");
- "Combien de couverts ?" as a number input;
- "Accueil" as a rating from 1 to 5.
Then "Notes", a multi-line text area.
When the outcome was "Personne sur place", this note shows at the top: "Personne sur
place : répondez seulement si vous savez."
A sticky gold button, "Enregistrer la visite".
```

### F5 — Confirmation d'enregistrement

```
Dialog / bottom sheet over F4: "Enregistrer cette visite ?" [ASSUMPTION: copy is new],
with a summary: "Curry House · Intéressé · Flyer remis · 4 réponses". Buttons
"Modifier" and gold "Enregistrer".
After saving, back on the Tournée, a confirmation: "Visite enregistrée. Elle partira à
la prochaine synchronisation."
```

### F6 — Ajouter un prospect

```
Screen: "Ajouter un prospect" (the "Ajouter" tab).
- "Nom", placeholder "Le nom sur la devanture".
- "Type": six large radio chips: "Restaurant", "Restauration rapide", "Café", "Bar",
  "Food truck", "Autre".
- "Position": a small map preview with a pin, the coordinates "50,8466 · 4,3528", and
  the button "Utiliser ma position" (after use it reads "Actualiser").
- "Adresse (facultatif)" and "Téléphone (facultatif)".
- A sticky gold "Ajouter" button.
Error: "Indiquez le nom de l'établissement." under Nom.
```

### F7 — Page introuvable / accès

```
Small states: "Page introuvable." with a "Retour à la tournée" button; "Impossible de
vous identifier hors ligne. Connectez-vous une fois avec du réseau."
```

### F8 — Sync states

```
One board showing the field top bar and sync strip in each state:
- all synced: green dot, no strip;
- pending: amber dot "3" and a strip "3 éléments en attente d'envoi";
- offline: "Hors ligne. Vos visites sont conservées et partiront au retour du réseau.";
- session expired: "Votre session a expiré. Reconnectez-vous pour synchroniser.";
- update needed: "Une mise à jour est nécessaire. Vos visites sont conservées.";
- failed: "La synchronisation a échoué. Nouvel essai automatique.";
- syncing: a pulsing grey dot.
The strip is persistent and sits under the top bar; it is not a toast.
```

---

## Out of the prompt, on purpose

- **Build rules.** Before any screen is built from these mockups, it goes through
  the repo's `frontend-design` skill (ADR-0014). Every French string then moves to
  `src/client/copy.ts`.
- **Admin charts.** These need a chart library in the admin chunk. The dependency
  has to be justified in the PR that adds it (CLAUDE.md).
- **The 150 kB field budget.** It still stands until the separate ADR that
  supersedes the budget part of ADR-0015 lands. The field map, swipe actions and
  daily progress all depend on that ADR.
- **Rules the mockups must respect.** Swipe actions only start allowed agent actions
  (Visiter, Y aller); agents never edit shared data (invariant 2). Every map carries
  the OSM attribution (invariant 11).
