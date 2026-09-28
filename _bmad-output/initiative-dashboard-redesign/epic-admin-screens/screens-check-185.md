# The six screens at 1280, 820 and 390, light and dark (#185)

The owner's checklist for epic #174's **Done when 2**: each rebuilt admin
screen meets its [EXPERIENCE.md](../../planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md) Component Patterns, State
Patterns and Responsive & Platform rows, in light and dark, at desktop,
tablet and phone widths. Prepared by backlog 015; signing it off is #185.

## How to use it

Open each screen at 1280, 820 and 390 px wide, in light then dark, and tick
a box when the row holds at that width and theme. A miss gets a
`found-in-passing` issue and its number beside the box. "Source" is the
row's line in EXPERIENCE.md.

- **pinned by** — a DOM test already proves the structure, text or ARIA
  (paths from `src/client/admin/`). It cannot see layout or colour, so the
  row still needs your look at every width and theme; the note says what to
  look at when there is something specific.
- **owner, on device** — needs media queries or computed colour, which
  happy-dom does not evaluate.
- **miss → #N** — the screen does not meet the row today; the issue says
  why. The code was left alone.
- **n/a** — the row describes another width.

Not applicable to these six screens: Period selector, Visites dans le temps,
À traiter queue and Dernières visites (the dashboard, epic #104); Top-bar
search and Search, no match (built later).

Not covered here: § Accessibility Floor and § Interaction Primitives (focus
ring, keyboard reach, reduced motion, 200 % text). They are outside this
story's rows; say if you want them added before sign-off.

## Shell (all six screens)

| Row | Source | Status | 1280 light | 1280 dark | 820 light | 820 dark | 390 light | 390 dark |
|---|---|---|---|---|---|---|---|---|
| Offline banner | EXPERIENCE.md:164 | miss → #209 (not built) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Offline, after a reload | EXPERIENCE.md:165 | miss → #209 (not built) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Session expired dialog | EXPERIENCE.md:166 | miss → #209 (not built) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Not an admin | EXPERIENCE.md:167 | pinned by `../App.test.tsx › answers an agent on an admin route with the forbidden state, inside the field frame`; owner, on device: lock icon and look | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| New build available | EXPERIENCE.md:168 | pinned by `../App.test.tsx › hands the banner to the admin frame as its updatePrompt prop`; owner, on device | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Phone: sidebar is a Sheet behind the menu button | EXPERIENCE.md:228 | owner, on device | n/a | n/a | n/a | n/a | [ ] | [ ] |
| Tablet: sidebar collapses to icons | EXPERIENCE.md:229 | owner, on device | n/a | n/a | [ ] | [ ] | n/a | n/a |
| Desktop: full sidebar | EXPERIENCE.md:230 | owner, on device | [ ] | [ ] | n/a | n/a | n/a | n/a |

## Prospects

| Row | Source | Status | 1280 light | 1280 dark | 820 light | 820 dark | 390 light | 390 dark |
|---|---|---|---|---|---|---|---|---|
| One toolbar slot | EXPERIENCE.md:134 | pinned by `ProspectsScreen.test.tsx › replaces the filters in place with the selection's actions, and Annuler brings them back`; owner, on device: same position and height, no floating bar | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Row menu | EXPERIENCE.md:135 | pinned by `ProspectsScreen.test.tsx › offers Assigner à, Retirer l'assignation and Changer le statut in the row menu` and `ProspectsScreen.test.tsx › leaves Retirer l'assignation out of the row menu of an unassigned prospect`; code and spine differ on the second → #210; owner, on device: submenus open to the side | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Table pagination | EXPERIENCE.md:137 | pinned by `ProspectsScreen.test.tsx › pages over the server's own total, disables the ends, and shows the range`; owner, on device: the page scrolls, the table has no scroll area | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Loading | EXPERIENCE.md:161 | miss → #206 (3 skeleton rows, not 6–8) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Load failed | EXPERIENCE.md:162 | pinned by `ProspectsScreen.test.tsx › shows the shared Alert and refetches on « Réessayer »`; owner, on device: the Alert's look | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Action done / failed | EXPERIENCE.md:163 | pinned by `ProspectsScreen.test.tsx › toasts what the admin did when the selection is assigned`, `ProspectsScreen.test.tsx › toasts the unassignment and hands the slot back to the filters` and `ProspectsScreen.test.tsx › toasts the failure when the assignment is refused, and keeps the selection to retry`; owner, on device: bottom right | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Empty: no prospects | EXPERIENCE.md:174 | pinned by `ProspectsScreen.test.tsx › invites a CSV import when there are no prospects at all`; owner, on device: icon tile | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Empty: filters match nothing | EXPERIENCE.md:175 | pinned by `ProspectsScreen.test.tsx › says a filter matched nothing without naming a search` and `ProspectsScreen.test.tsx › names the search when it matches nothing, and offers to clear it`; owner, on device: icon tile | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Phone: a list of rows; the selection toolbar wraps onto two lines | EXPERIENCE.md:228 | pinned by `ProspectsScreen.test.tsx › renders a list of rows instead of a table`; owner, on device: the toolbar wrap | n/a | n/a | n/a | n/a | [ ] | [ ] |

## Import

| Row | Source | Status | 1280 light | 1280 dark | 820 light | 820 dark | 390 light | 390 dark |
|---|---|---|---|---|---|---|---|---|
| Import stepper | EXPERIENCE.md:139 | pinned by `import/ImportScreen.test.tsx › forks to Fichier · Colonnes · Aperçu on the CSV path, Source marked done`, `import/ImportScreen.test.tsx › forks to Zone, two steps only, on the map path` and `import/ImportScreen.test.tsx › lists the rejected row first, struck through, with its reason; a ready row shows fr-FR coordinates`; owner, on device: step colours | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Map import | EXPERIENCE.md:140 | pinned by `import/MapStep.test.tsx › puts the provider above the map, and under it the vertex count, undo, clear, then the gold search (#185)`, `import/MapStep.test.tsx › switching provider clears the drawing and both results`, `import/MapStep.test.tsx › excludes an unnamed candidate from the tally, the count and the import`, `import/MapStep.test.tsx › keeps a likely duplicate out unless ticked, and resets the tick on a new search` and `import/MapStep.test.tsx › shows the cached answer's age, in days, hours or under an hour, and a plain line with no age`; owner, on device: map and results side by side from 1024px, stacked below | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Loading (map search in flight: « Recherche… ») | EXPERIENCE.md:161 | owner, on device | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Load failed (map search) | EXPERIENCE.md:162 | pinned by `import/MapStep.test.tsx › shows a failed search as a destructive Alert under the map (#185)` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Import running | EXPERIENCE.md:169 | pinned by `import/ImportScreen.test.tsx › blocks leaving the page while running, disables Retour and Importer, and shows batch progress` and `import/ImportScreen.test.tsx › sends 300 rows as 250 then 50, reading 250 / 300 in between` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Import done | EXPERIENCE.md:170 | pinned by `import/ImportScreen.test.tsx › ends in a result dialog naming created, updated and rejected, and Terminer returns to Source`; owner, on device: « Voir les prospects » | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Import failed mid-way | EXPERIENCE.md:171 | pinned by `import/ImportScreen.test.tsx › names the rows already sent when a later batch fails, and Réessayer re-sends from the start` and `import/MapStep.test.tsx › names how many rows already went in when a later batch fails, and Réessayer re-sends` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

## Doublons

| Row | Source | Status | 1280 light | 1280 dark | 820 light | 820 dark | 390 light | 390 dark |
|---|---|---|---|---|---|---|---|---|
| Doublons pair | EXPERIENCE.md:141 | pinned by `DuplicatesScreen.test.tsx › shows a pair as one list item, with the distance once`, `DuplicatesScreen.test.tsx › keeps B: posts survivorId B, mergedId A, toasts and refetches` and `DuplicatesScreen.test.tsx › keeps A: posts survivorId A, mergedId B` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| One toolbar slot (count and relaunch) | EXPERIENCE.md:134 | pinned by `DuplicatesScreen.test.tsx › relaunches the search on click, disabling the button while fetching` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Loading | EXPERIENCE.md:161 | pinned by `DuplicatesScreen.test.tsx › shows no pair count while the first sweep is still in flight` and `ScreenState.test.tsx › shows the skeleton, marked busy, while pending with no data` (shared); a list, not a table: the 6–8-row rule is for tables; owner, on device: skeleton shape | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Load failed | EXPERIENCE.md:162 | pinned by `DuplicatesScreen.test.tsx › shows the load-failed state, and its retry asks again` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Action done / failed | EXPERIENCE.md:163 | pinned by `DuplicatesScreen.test.tsx › keeps B: posts survivorId B, mergedId A, toasts and refetches` and `DuplicatesScreen.test.tsx › toasts a failure and keeps the pair on a 500`; owner, on device: bottom right | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Empty queues | EXPERIENCE.md:176 | pinned by `DuplicatesScreen.test.tsx › shows the healthy empty state with the toolbar count at 0` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

## À rattacher

| Row | Source | Status | 1280 light | 1280 dark | 820 light | 820 dark | 390 light | 390 dark |
|---|---|---|---|---|---|---|---|---|
| Repair row | EXPERIENCE.md:142 | pinned by `OrphansScreen.test.tsx › shows both reasons in one row shape: evidence, « Rattacher à » and « Supprimer »`, `OrphansScreen.test.tsx › offers the server's candidates nearest first, the distance inside each button`, `OrphansScreen.test.tsx › discards only after the destructive confirmation` and `OrphansScreen.test.tsx › counts the whole queue in the header, pages past the first included`; owner, on device: outcome edge colour, « Supprimer » far right | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Loading | EXPERIENCE.md:161 | `ScreenState.test.tsx › shows the skeleton, marked busy, while pending with no data` (shared primitive only); a list, not a table: the 6–8-row rule is for tables; owner, on device: skeleton shape | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Load failed | EXPERIENCE.md:162 | pinned by `OrphansScreen.test.tsx › shows the load-failed Alert, and « Réessayer » fetches again` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Action done / failed | EXPERIENCE.md:163 | pinned by `OrphansScreen.test.tsx › attaches to the chosen candidate and says so, after the row has left the queue`, `OrphansScreen.test.tsx › reports a repair the server refused` and `OrphansScreen.test.tsx › reports a discard the server refused` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Empty queues | EXPERIENCE.md:176 | pinned by `OrphansScreen.test.tsx › shows the healthy empty state, with no count` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

## Visites

| Row | Source | Status | 1280 light | 1280 dark | 820 light | 820 dark | 390 light | 390 dark |
|---|---|---|---|---|---|---|---|---|
| Live feed | EXPERIENCE.md:138 | pinned by `VisitsScreen.test.tsx › quotes a visit's notes on a second line, and a visit without notes has none`, `VisitsScreen.test.tsx › shows a visit to a merged prospect under the name it was made against` (the client renders the name the server sends; `../../worker/admin.test.ts › still shows a visit whose prospect was merged away afterwards` pins the server), `VisitsScreen.test.tsx › announces an arrival in the live region, never as a toast` and `visits/feed.test.ts › keeps the newest first`; owner, on device: the arrival wash | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| One toolbar slot (filter bar: period, count, export) | EXPERIENCE.md:134 | owner, on device: same position and height as on Prospects; no row selection here, so nothing replaces it | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| KPI card (strip) | EXPERIENCE.md:131 | pinned by `VisitsScreen.test.tsx › shows each strip card's figure and link target` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Phone: the strip stacks in one column | EXPERIENCE.md:228 | owner, on device | n/a | n/a | n/a | n/a | [ ] | [ ] |
| Tablet: the strip goes 2×2 | EXPERIENCE.md:229 | owner, on device | n/a | n/a | [ ] | [ ] | n/a | n/a |
| Table pagination | EXPERIENCE.md:137 | pinned by `VisitsScreen.test.tsx › pages 60 held visits 25 at a time, Précédent/Suivant disabled at the edges` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Loading | EXPERIENCE.md:161 | miss → #207 (ledger is a text line); owner, on device: strip skeleton | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Load failed | EXPERIENCE.md:162 | pinned by `VisitsScreen.test.tsx › shows the strip's load-failed Alert with a retry, leaving the ledger unaffected` (strip); miss → #208 (ledger) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Action done / failed | EXPERIENCE.md:163 | pinned by `VisitsScreen.test.tsx › warns that the export failed on a server error` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Empty feed | EXPERIENCE.md:177 | pinned by `VisitsScreen.test.tsx › shows the empty-feed copy and no pager for an empty window` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

## Scripts

| Row | Source | Status | 1280 light | 1280 dark | 820 light | 820 dark | 390 light | 390 dark |
|---|---|---|---|---|---|---|---|---|
| Script editor | EXPERIENCE.md:143 | pinned by `scripts/ScriptsScreen.test.tsx › reorders from the keyboard and saves the new order`, `scripts/ScriptsScreen.test.tsx › shows a saved key as locked text until Modifier la clé, then keeps the warning up`, `scripts/ScriptsScreen.test.tsx › names the version the confirmation will create` and `scripts/ScriptsScreen.test.tsx › shows the active version as numbered cards and every version in a read-only rail`; owner, on device: drag by pointer, card look | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Saving a script | EXPERIENCE.md:172 | pinned by `scripts/ScriptsScreen.test.tsx › spins and locks the dialog while the save is in flight, then toasts the version` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Loading | EXPERIENCE.md:161 | `ScreenState.test.tsx › shows the skeleton, marked busy, while pending with no data` (shared primitive only); owner, on device: skeleton shape | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Load failed | EXPERIENCE.md:162 | pinned by `scripts/ScriptsScreen.test.tsx › shows the load-failed alert with a retry that refetches` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Action done / failed | EXPERIENCE.md:163 | pinned by `scripts/ScriptsScreen.test.tsx › toasts the server's message for a failed save and closes the dialog` and `scripts/ScriptsScreen.test.tsx › toasts saveFailed when the save never reaches the server` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

## Found in passing

- #206 — Prospects' loading skeleton has 3 rows, not 6–8.
- #207 — the Visites ledger shows a text line while loading, not a skeleton.
- #208 — the Visites ledger's load failure is a bare line, with no Alert or « Réessayer ».
- #209 — the admin offline banner, the blocking session-expired dialog and
  the offline-after-reload page are specified but not built.
- #210 — the row menu hides « Retirer l'assignation » for an unassigned
  prospect; EXPERIENCE.md lists it unconditionally.

## Sign-off

- [ ] Every box above ticked, n/a, or carrying an issue number
- [ ] Epic #174 Done when 2 signed off (owner)
