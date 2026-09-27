# Epic 104 Context: The admin opens on Tableau de bord

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make `/admin` land on Tableau de bord, one screen that tells the admin how canvassing is going and what to do next, for the last 7, 30 or 90 days. It shows a period selector, 4 KPI cards with deltas and sparklines, visits by outcome over time, the pipeline by status, per-agent activity, an À traiter queue and Dernières visites. The figures come from a new read-only aggregate endpoint backed by a new `visits(visited_at)` index. The epic also absorbs four issues: the empty `/admin` (#90), the outcome colour tokens (#100), keeping admin-only modules out of the field precache (#95), and the Tableau de bord field tab ignoring a lost network (#93). It succeeds when every figure on a seeded D1 matches its metric definition for all three periods, deltas included.

## Stories

- Story 104.1: Outcome tokens and admin-chunk guard
- Story 104.2: Visits index on visited_at
- Story 104.3: Tableau de bord at /admin
- Story 104.4: Seed 180 days of dashboard data
- Story 104.5: Convertis and Taux de conversion
- Story 104.6: Visites dans le temps
- Story 104.7: KPI sparklines
- Story 104.8: Pipeline par statut and Activité par agent
- Story 104.9: À traiter, Dernières visites and the CPU budget
- Story 104.10: Dashboard links open filtered lists
- Story 104.11: Tableau de bord tab ignores a lost network (bug)
- Story 104.12: Refactor sweep

## Requirements & Constraints

**Metric definitions.** The Worker computes each figure, and each one is defined only once:
- **Prospects ouverts:** live (non-merged) prospects with status new, assigned or follow_up. It is a snapshot with no delta; its card shows a Nouveau/Assigné/À relancer mini-bar instead.
- **Visites:** visits whose clamped `visited_at` falls in the period.
- **Convertis:** prospects that became converted during the period, counted once per prospect. A conversion comes from a visit with outcome `converted` or from a manual change to Converti (`prospects.status_set_at`).
- **Taux de conversion:** Convertis ÷ distinct prospects visited in the period.
- **Pipeline par statut:** the count and share of live prospects in each status. It is a snapshot.
- **Activité par agent:** for each agent, the visits and conversions in the period, plus the follow_up prospects and open prospects assigned to that agent now.
- **Relances dues:** follow_up prospects whose `next_visit_at` is today or earlier.
- **Delta:** (period − previous period of the same length) ÷ previous period. It shows "—" when the previous period is 0. A 90-day period therefore reads 180 days of data.

**Other requirements:**
- Periods and "today" are Europe/Brussels calendar days (an assumption). Story 3 defines the boundary once, and every later story reuses it.
- The aggregate query must stay within Workers Free's 10 ms CPU per request on the seeded data (invariant 13). Story 9 measures and records this.
- Dernières visites shows a new synced visit within one 15 s poll.
- Recharts, cmdk, TanStack Query and every other admin-only module live only in the `AdminApp-*` chunk, and the build fails if one appears in a precached chunk. The field precache changes only by #93's fix, and PRs quote the total against the 1,000 KiB ceiling and the entry chunk.
- Recharts is the only new dependency. Its PR states its size, its maintenance, and why the platform can't do the job.
- `docs/design.md` gets a dashboard section that matches the shipped screen, in the same change set.
- Out of scope: the Visites KPI strip (a later epic reuses this endpoint), the Prospects rebuild, and notifications.

## Technical Decisions

- **G1, the endpoint:** `GET /api/admin/dashboard?period=7|30|90`. It is read-only and computes every metric in SQL. Its zod contract goes in `src/shared/schemas.ts` (zod/mini) and it is documented in `docs/api.md`. It is built with the `add-api-route` skill. No new column is needed: "became Converti" is derived from visits plus `status_set_at`. Stories 5 to 9 extend the payload additively.
- **G2, the index:** a single index on `visits(visited_at)`, since the existing indexes lead with `prospect_id` or `agent_email`. Add it in `schema.ts` and run `pnpm db:generate`, as an additive expand-only migration that the deployed Worker ignores (`d1-migration` skill). The migration-guard subagent reviews it (high risk). `EXPLAIN QUERY PLAN` must show that a `visited_at` range count uses it.
- **G3 and G10, Prospects filters:** `GET /api/admin/prospects` gains `dueBefore=<ms>` (on `next_visit_at`), and `status` accepts several values. Both are additive, bound as parameters, and within 100 bound parameters (invariant 7). A single `status` value behaves as it does today.
- The existing surface serves the remaining data. The À rattacher count is `remaining` on `/api/admin/visits/orphaned`, the Doublons count is `pairs` on `/api/admin/prospects/duplicates`, and Dernières visites reads the existing visits feed (latest 5 by `received_at`).
- The client uses TanStack Query (admin only) with 15 s polling (ADR-0010). Every admin mutation invalidates the dashboard query. The admin chunk is online-only and never precached (ADR-0019).
- The chart is shadcn Chart (Recharts), vendored into `src/client/ui/` and admin chunk only. The endpoint returns visits per day by outcome.
- **Outcome tokens (#100):** the `app.css` `outcome-*` values follow DESIGN.md: no-contact `#8A92A4`/`#7C87A0` (dark), interested `#2E3F63`/`#AEBBDB`, not-interested `#5B5F63`/`#8E9399`. follow_up uses `warn` and converted uses `success`. `palette.test.ts` asserts that each of these and `warn`/`success` reaches 3:1 against the card of its own theme, never series against series.
- **Precache guard (#95):** `check-precache.mjs` must detect which modules a minified chunk holds. The method is still open: the build manifest, a Rollup module-map plugin, or a marker string.
- Every French string goes in `copy.ts`. Unknown `/admin/*` paths show `copy.errors.notFound` (#90).

## UX & Interaction Patterns

- **Layout at ≥ lg:** 4 KPI cards in a row, then the chart and the pipeline at 2:1, then Activité par agent and À traiter at 1:1, then Dernières visites across the full width. At md–lg the KPIs go 2×2 and the panels stack. On a phone everything is one column.
- **Period selector:** 7, 30 or 90 jours, defaulting to 30. It is the only selector and drives the KPIs, the chart and Activité par agent.
- **KPI card:** an overline label, a 32px icon tile, the figure, and a delta chip (success when up, destructive when down, with an arrow and a signed figure) followed by "vs période précédente". Across the bottom is a 32px sparkline; Taux de conversion shows a thin gold progress bar there. Cards have no coloured edge. Clicking a card opens its filtered list: Prospects ouverts goes to Prospects on the open statuses, Visites to Visites, and Convertis to Prospects on Converti.
- **Visites dans le temps:** a stacked bar per day in a fixed order, from Personne sur place at the bottom to Converti at the top.
  - A 1px card-coloured stroke separates neighbouring segments.
  - A segment at least 22px tall prints its count. In light mode the count is navy on no-contact and card-coloured on the others; in dark mode it is primary-foreground-dark on all five.
  - The tooltip lists every series, zeros included, and the legend sits above the plot and never toggles series.
  - A visually hidden summary table gives the text equivalent.
  - The stroke and the count are required for accessibility, so neither can be dropped.
- **Pipeline par statut:** one row per status with the label, count and share, and a 6px bar in the status colour below it.
- **À traiter:** three rows (Relances dues, Visites à rattacher, Doublons). Each has an icon tile, a count and a secondary button. At 0 the count is muted and the button disabled. Relances dues' "Voir" opens its filtered list.
- **Dernières visites:** 5 rows with outcome badges, which have ink labels and a 4px outcome edge. A new row gets a brief wash, and each poll makes at most one polite announcement. "Tout voir" opens Visites. When empty: "Aucune visite reçue…".
- **Loading and failure:** skeletons shaped like the content while loading. If loading fails, an inline Alert with "Réessayer". When offline, the banner keeps the panels' last values.
- **Field tab (#93):** Tableau de bord shows only for an admin with a network. It follows online and offline events instead of the identity snapshot taken at mount, and it opens `/admin`.
- The mockups `key-a1-dashboard.html` and `key-a1-outcome-chart.html` are the visual reference, at 1280, 820 and 390 px, in light and dark.

## Cross-Story Dependencies

- Story 1 depends on shared-shell story 1.3 and runs first. While it runs, no other story touches `app.css`, and only story 2 touches `drizzle/`. Epic-field-screens' first stories also wait on story 1.
- Story 3 is the tracer bullet. It waits on story 1 and on shared-shell 1.4, and it defines the endpoint, the zod contract and the Brussels day boundary that stories 4 to 10 extend.
- The admin lane runs in sequence because every story in it shares `admin.ts` and the dashboard screen: 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Story 9 also needs story 2, the index.
- Story 11 waits on story 3. Epic-field-screens' Carte story (4.4) waits on story 11, since both edit `tabs.ts`.
- Story 12 comes last and waits on every other story.
- A later epic (epic-admin-screens) reuses G1 for the Visites strip and must keep Prospects' URL filters from story 10.
