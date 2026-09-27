# Epic 2 Context: The admin opens on Tableau de bord

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

`/admin` has no index route today. This epic makes Tableau de bord that index: a period selector (7/30/90 days, default 30), four KPI cards with deltas and sparklines, a stacked visits-by-outcome chart, pipeline by status, per-agent activity, an À traiter queue and a live Dernières visites feed, computed server-side from one new aggregate endpoint within the Workers Free CPU budget. It folds in four related issues: the empty `/admin` route (#90), an outcome-token contrast fix and admin-chunk build guard (#100), keeping admin-only modules out of the field precache (#95), and fixing the field dashboard tab to reflect identity rather than network state (#93). Success is CAP-2's criterion: every figure matches its definition for all three periods, and Flow 2 (the Monday check) runs end to end.

## Stories

- 2.1: Outcome tokens and admin-chunk guard (#100, #95)
- 2.2: Visits index on `visited_at` (G2)
- 2.3: Tableau de bord at `/admin` (tracer bullet, #90)
- 2.4: Seed 180 days of dashboard data
- 2.5: Convertis and Taux de conversion KPIs
- 2.6: Visites dans le temps (stacked outcome chart)
- 2.7: KPI sparklines
- 2.8: Pipeline par statut and Activité par agent
- 2.9: À traiter, Dernières visites and the CPU budget check
- 2.10: Dashboard links open filtered lists (G3, G10)
- 2.11: Bug — Tableau de bord tab ignores a lost network (#93)
- 2.12: Refactor sweep

## Requirements & Constraints

Each figure must equal its definition against seeded D1, for 7/30/90-day periods, deltas included: Prospects ouverts (live non-merged, status new/assigned/follow_up, snapshot, no delta) · Visites (`visited_at` in period) · Convertis (became Converti in period, via a `converted` outcome or a manual status change) · Taux de conversion (Convertis ÷ distinct prospects visited) · Pipeline par statut (count + share per status, snapshot) · Activité par agent (per agent: visits, conversions, current follow_up and open counts) · Relances dues (follow_up, `next_visit_at` ≤ today; sous 7 jours = within 7 days) · Flyers remis (`flyer_given` visits in period) · Agents en tournée (distinct agents with a visit `received_at` today, existing feed) · Delta ((period − previous)/previous; "—" when previous is 0).

Other constraints: "today"/periods are Europe/Brussels calendar days, defined once and reused throughout · the query stays within Workers Free's 10 ms CPU, via the `visited_at` index · Recharts, cmdk, TanStack Query stay in the admin chunk only, enforced by a build guard; field precache ≤1,000 KiB, changed only by the #93 fix; Recharts' PR states size, maintenance, why the platform can't do it · response is a zod/mini schema in `src/shared/schemas.ts`, documented in `docs/api.md` (additive) · multi-row queries respect D1's 100-param limit (`chunk()`) · all copy is French, in `copy.ts`; enum values stay English · `docs/design.md`'s dashboard section is rewritten to match the shipped screen · `palette.test.ts` asserts outcome/warn/success colours at 3:1 against their own theme's card.

## Technical Decisions

- New endpoint `GET /api/admin/dashboard?period=7|30|90`, read-only SQL, zod contract in `src/shared`; TanStack Query invalidates it on every admin mutation, polls at 15 s.
- Server-gaps delivered here: G1 (endpoint), G2 (index), G3 (`dueBefore` on prospects list), G10 (multi-value `status`, additive). G6 (Agents en tournée = visits received today) is already settled, just consumed.
- G2's migration is additive, works with the deployed Worker (expand/contract); migration-guard reviews it.
- Depends on epic-shared-shell for the admin shell/tokens.
- Out of scope: the Visites KPI strip (epic-admin-screens reuses G1), Prospects rebuild, notifications.

## UX & Interaction Patterns

- **Period selector**, in the header, drives every panel with a period; one selector only.
- **KPI card** — label, figure, delta vs. previous period, sparkline/mini-bar. Prospects ouverts shows a stacked Nouveau/Assigné/À relancer bar instead of a delta; Taux de conversion a gold progress bar. Clicking opens the filtered list.
- **Visites dans le temps** — stacked bar per day, fixed series order (Personne sur place bottom, Converti top). Segments ≥22px print their count; shorter ones read from the tooltip. Hover shows every series for the day, zeros included; no legend toggle. Needs a hidden summary table and a 1px card-coloured stroke between segments.
- **À traiter** — three rows (Relances dues, Visites à rattacher, Doublons), shown at 0 too (muted, disabled).
- **Dernières visites** — last 5 by `received_at`, 15 s poll, brief wash on new rows, one polite announcement per poll, "Tout voir" → Visites.
- Loading = skeletons shaped like content; load-failure = inline Alert with retry; offline keeps last-loaded values.
- Responsive: ≥1024px full grid (4 KPIs; chart+pipeline 2:1; per-agent+À traiter 1:1; Dernières visites full width); tablet KPIs 2×2; phone one column.

## Cross-Story Dependencies

- 2.1 first (only story touching `app.css`/precache guard); blocks everything else here and in epic-field-screens touching it.
- 2.2 alone touches `drizzle/`; its CPU payoff is checked in 2.9, not 2.2.
- 2.3 (tracer bullet) follows 2.1; 2.4–2.10 build on its endpoint/route in sequence.
- 2.11 follows 2.3 (tab now opens `/admin`), blocks epic-field-screens' 4.4 (both touch `tabs.ts`).
- 2.12 follows every other story.
- Epic waits on epic-shared-shell; epic-admin-screens reuses G1, must keep 2.10's URL filters.
