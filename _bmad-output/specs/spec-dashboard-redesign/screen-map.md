# Screen map

Today's screens, what replaces each one, and the reference to build from. The behaviour rules for
each new screen are in EXPERIENCE.md › Component Patterns and State Patterns. Only the six
key-screen mocks in `mockups/` show final tokens; every "Stitch" reference is light-only and
corrected by the spines (see `reconcile-stitch.md` in the UX run folder).

## Admin (`src/client/admin/`, lazy `AdminApp` chunk)

| Today | Route | New | CAP | Reference |
|---|---|---|---|---|
| — (the ink band's nav links in `App.tsx`) | all `/admin/*` | Sidebar + top bar shell | CAP-1 | `mockups/key-a1-dashboard.html` |
| — (no index route) | `/admin` | **Tableau de bord** (new, the admin home) | CAP-2 | `mockups/key-a1-dashboard.html` |
| `ProspectsScreen` | `/admin/prospects` | Prospects: search, badges, pagination | CAP-3 | Stitch A2, A3 |
| `import/ImportScreen` and its steps | `/admin/import` | Import with a numbered stepper | CAP-3 | Stitch A4–A7 |
| `DuplicatesScreen` | `/admin/doublons` | Doublons | CAP-3 | Stitch A8 |
| `OrphansScreen` | `/admin/a-rattacher` | À rattacher | CAP-3 | Stitch A9 |
| `VisitsScreen` | `/admin/visites` | Visites with a KPI strip and date range | CAP-3 | Stitch A10 |
| `scripts/ScriptsScreen` | `/admin/scripts` | Scripts with question cards | CAP-3 | Stitch A11, A12 |
| — | `/admin/tournee` *(assumed path)* | **Admin round view** (new) | CAP-4 | `mockups/key-admin-round.html` |
| Toaster, alerts, skeletons | — | Shared admin states | CAP-3 | Stitch A13 |

## Field (`src/client/field/`, entry chunk + lazy screens)

| Today | Route | New | CAP | Reference |
|---|---|---|---|---|
| Ink band + `SyncIndicator` in `App.tsx` | all `/tournee/*` | Field band, sync strip, tabs | CAP-5 | `mockups/key-f1-tournee.html`, `mockups/key-f8-sync.html` |
| `TodayScreen` | `/tournee` | Tournée du jour | CAP-6 | `mockups/key-f1-tournee.html` |
| — | `/tournee/carte` *(assumed path)* | **Carte** (new, lazy) | CAP-7 | `mockups/key-f2-carte.html` |
| `VisitScreen` | `/tournee/:id` | Visit steps 1–2 plus the save sheet or dialog | CAP-8 | `mockups/key-f3-f5-visit.html`, Stitch F4 |
| `AddProspectScreen` | `/tournee/nouveau` | Ajouter un prospect | CAP-9 | Stitch F6 |
| Not-found and offline sign-in states | — | Same states, new look | CAP-5 | Stitch F7 |
