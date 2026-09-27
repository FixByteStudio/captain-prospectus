# Epic 174 Context: Every admin screen runs on the new design

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Rebuild the six existing admin screens — Prospects, Import, Doublons, À rattacher, Visites and Scripts — in the new design, one screen per story, with every current behaviour kept. Two gain capability: Prospects gains name search, and Visites gains a four-card KPI strip and a date range. Everything renders inside the new admin shell and composes from shared admin primitives and shared loading / load-failed / toast conventions. The epic succeeds when the existing admin tests still pass in what they assert, each screen meets its behavioural pattern rows in light and dark at desktop, tablet and phone widths, the new figures and filters match what D1 holds, and `docs/design.md`'s admin sections describe the shipped screens. The dashboard and the admin round view are out of scope; this epic consumes the dashboard's aggregate endpoint and its Prospects URL filters and must not break either.

## Stories

- Story 174.1: Admin screen primitives and shared states
- Story 174.2: Name search, the visits date range and the export filters
- Story 174.3: The Visites strip figures in the dashboard aggregate
- Story 174.4: Visites rebuilt: ledger, KPI strip and date range
- Story 174.5: Prospects rebuilt: name search, pagination and CSV export
- Story 174.6: Import rebuilt: the CSV path
- Story 174.7: Import rebuilt: the map path
- Story 174.8: Doublons rebuilt
- Story 174.9: À rattacher rebuilt
- Story 174.10: Scripts rebuilt
- Story 174.11: The six screens at 1280, 820 and 390, light and dark
- Story 174.12: Refactor sweep

## Requirements & Constraints

- **Nothing is lost.** Each rebuilt screen keeps every behaviour it has today, and its existing tests keep asserting the same things. One approved exception: repointing the dashboard's Visites KPI card at the new selected range changes what the dashboard screen test asserts.
- **Server changes are additive, read-only and pre-approved only where listed.** This epic owns name search on prospects (case-insensitive, bound as a parameter), a `from`/`to` window on the visits feed over `received_at`, the same filters on the prospects CSV export so an export always matches the filtered list, and an additive extension of the dashboard aggregate for the strip's figures. Nothing else may touch the API, the sync contract or the data model. A reversed range answers 400.
- **CPU budget.** The dashboard aggregate already uses 7.9–8.2 ms of the 10 ms per-request ceiling, so the strip figures must be measured and the number quoted; if they do not fit, they need their own endpoint.
- **"Agents en tournée"** is the distinct agents with a visit *received* today. There is no sync timestamp, and none is being added.
- **Pagination and export** are 25 rows per page with "Précédent", page numbers and "Suivant" (the page scrolls; tables never get their own scroll area), plus a CSV export button, on Prospects and Visites. Both export endpoints cap at 500 rows and flag truncation, and the screens must handle that answer.
- **Filter state** on Prospects is read from the URL (status, several statuses, `dueBefore`), a contract the dashboard's links depend on and this rebuild must preserve.
- **Copy and tokens.** Every French string lives in `copy.ts`; components never inline one, and vendored shadcn English gets translated. Tokens only — no hardcoded colour or spacing, no second component framework. Numbers and dates are fr-FR with tabular figures. Admin inputs are 16px so iOS never zooms.
- **Docs in the same change set.** Each screen rewrites or writes its `docs/design.md` section as it lands. Prospects, Doublons and the CSV import path have never had one. `docs/design.md` keeps the rules the UX spines do not cover — the map import's provider and circle rules, "Working with shadcn in this repo", and Icons.
- **Precedence on conflict:** the UX spines (look, then behaviour) win over `docs/design.md`, over the Stitch references and over any mock. The one reversal is the settled "Agents en tournée" definition.
- **Admin stays online-only** and out of the precache; admin-only modules never reach a precached chunk. Precache headroom is roughly 100 KiB of the 1,000 KiB ceiling, and a moved shared helper has previously landed in the field entry chunk.
- **Accessibility floor:** WCAG 2.2 AA in both themes, colour never alone (every status, outcome and delta carries a French label or count), a visible non-gold focus ring, an aria-label from `copy.ts` on every icon-only button, and keyboard reach for row checkboxes, row menus and script reordering. Drawing a map zone needs a pointer, and the CSV path is the stated keyboard alternative.

## Technical Decisions

- **Shared primitives first.** A PageHeader and Panel that all six screens compose from, one title token instead of per-screen headings, and the shared skeleton / inline load-failed Alert with "Réessayer" / bottom-right action toast conventions. Three pre-existing defects are fixed here because every rebuilt screen depends on them: the class-merge helper mistaking a font-size token for a colour, the admin input's text size, and Progress not forwarding its value to the Radix root.
- **One sequential lane.** All six screens touch the same three modules (the admin query layer, `copy.ts` and the admin worker routes), so entries 4–10 are chained rather than parallel. Splitting those modules first was considered and rejected on precache grounds.
- **Visites is the tracer bullet** (entry 4): the thinnest screen, but it crosses the worker param, the query layer, the screen, `copy.ts`, `docs/design.md` and a DOM test.
- **The Visites date range is a 7/30/90 selector, not an arbitrary range.** The feed receives the matching `from`/`to` and the strip reads the period-scoped aggregate, so both halves of the screen show one window and the aggregate keeps a fixed, affordable shape.
- **The strip figures extend the existing aggregate additively** rather than being computed from the 500-row-capped feed. Three figures are new: flyers given, distinct agents with a visit received today, and a seven-day follow-up window (the existing due count is due-today-or-earlier, which the strip does not ask for). The new gap row needs the owner's own go-ahead, which is why that story is a human-in-the-loop one.
- **Scripts ships question cards**, and `docs/design.md`'s "no steps, no cards" line is rewritten. The "no raised surface" principle governs cards around data tables, which the ledger screens remain; a script question is an editable unit that reorders as a unit, and the card makes the drag target legible. The drag handle is the only reorder affordance, and reorder also works through the dnd-kit keyboard sensor.
- **Testing reality.** The DOM harness is happy-dom, which evaluates neither media queries nor computed colour, so responsive and theme conformance is a human pass (entry 11) rather than an assertion. Several targets — the import components, Doublons, Scripts and its question rows — have no DOM test today, so their rebuild writes the first ones and may uncover behaviour only pure helpers currently pin.
- **Ownership boundaries to respect while rebuilding.** The map canvas drives Leaflet imperatively and must keep ownership of the canvas. The script editor's seed-once effect that stops a background refetch clobbering an in-progress edit must survive. The Doublons pair count still has to feed the sidebar badge and the dashboard queue row.
- **Bugs folded into the screen that owns them:** the fr-FR coordinate handling and an inline French aria-label on the CSV path; hand-spelled status edges, the toolbar overflow below 480px and near-invisible dark-mode shapes on the map path; the À rattacher sidebar badge counting only the queue's first page; and the script editor overflowing at 390px.

## UX & Interaction Patterns

- **One toolbar slot.** The filter bar is *replaced in place* by the selection actions as soon as a row is ticked — same position, same height, no floating bar. Scoped to Prospects, Doublons and the Visites filters; what the slot holds on Doublons, which has no filters today, is decided in that story.
- **Prospects.** Name search lives in that one slot; removable chips carry several statuses and the due-date filter; the row menu opens its submenus to the side; below 768px the table becomes a list of rows. Two distinct empty states: no prospects at all (invite a CSV import) and filters matching nothing (offer to clear them).
- **Visites** is a ledger ordered by the server's clock, newest first, notes quoted on a second line, a visit to a merged prospect still shown under the name it was made against. Arrivals are ambient — a brief wash, never a toast. Each strip card opens the list behind it. The strip is four compact KPI cards in one row with no icon tile and no sparkline: overline label, display figure, meta context line.
- **Import** keeps its numbered stepper (done steps navy with a check, current gold, future secondary) and forks CSV / map after Source. The file is parsed in the browser and never uploaded; rejected rows are listed first, struck through, with their reason; the run shows batch progress and blocks leaving the page without a browser confirmation; it ends in a result dialog, or an inline Alert naming how many rows went in when it fails mid-way (a retry is safe because writes are idempotent).
- **Map import.** Map and results side by side so a vertex can be moved and searched again; the provider select above the map, and changing it clears the drawing; one action row under the map with the vertex count, undo-last-point, clear, then the gold search; unnamed places struck through and not importable; already-listed places excluded unless one checkbox is ticked, which resets on every new search; a cached answer says so with its age; attribution through the tile layer's own control.
- **Doublons.** A pair reads as one unit: two stacked rows with the distance shown once. "Garder" on either row keeps that one and merges the other, with no confirmation, because a merge keeps every visit. Row actions are secondary, never gold. Healthy empty state.
- **À rattacher** reads as a forecast, not a record: the lede says the effect has not happened yet, the outcome edge previews what repairing would do, both reasons share one dense row shape with no per-row dialog, server-proposed candidates are nearest first with the distance inside the button, a visit with no position says so explicitly, and "Supprimer" sits far right behind the destructive confirmation.
- **Scripts.** A saved key is locked and unlocked only by an explicit action carrying a standing warning, not a toast. The versions rail is read-only. One primary action opens a confirmation that names the version it will create, and its button spins and stays disabled until the server answers, then a toast names the saved version.
- **Shared visual rules.** Ledger rows show status as both a 4px edge and a badge, with overline headers on a secondary header row, numbers right-aligned and "—" for an empty cell. Gold is one main action per view plus what is selected, always a fill with navy text and its edge — repeated row actions are secondary. Converti is always green; cards with no status carry no coloured edge. Empty states are an icon tile, a title, one sentence and one button. Motion only where something changed, and instant under reduced motion.

## Cross-Story Dependencies

- Story 1 waits on the shared shell's sidebar and top-bar stories and gates every screen rebuild. It is scoped to the admin screens deliberately, because the field-screens epic can run beside this one and rebuilds the field files that share the same class-merge helper and Input.
- Story 2 has no predecessor and can start immediately; story 3 needs story 2 plus the dashboard endpoint story, and its owner sign-off gates story 4.
- Stories 4 → 5 → 6 → 7 → 8 → 9 → 10 run strictly in sequence on the shared modules. Story 4 also decides what the export button does with a truncated answer, and story 5 follows that decision. Story 5 additionally needs the dashboard story that established the Prospects URL filter contract.
- Story 5 is the largest single entry and carries the toolbar swap, pagination, export, both empty states and the sub-768px list; if the responsive list and the export cannot land together they split off rather than shrink.
- Story 11 is a person checking every pattern row per screen, per width, per theme after story 10, filing an issue for each miss and signing off the epic's conformance criterion. Story 12 waits on all eleven.
- This epic consumes the dashboard epic's aggregate endpoint and URL filters, and must leave both intact. It does not depend on, and does not serve, the admin round view.
- Open: whether the new server-gap row is folded back into the spec once this epic lands.
