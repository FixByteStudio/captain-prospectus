---
title: 'Tableau de bord at /admin (GH #107, #90)'
type: 'feature'
created: '2026-09-26'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: []
baseline_commit: 'a96ab86d634dd309569f14ee94ec5a12549776eb'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/admin` renders an empty frame, and so does any unknown `/admin/*` path (#90). The admin has no screen that says how canvassing is going. This story is epic #104's tracer bullet: it defines the endpoint, the contract and the Brussels day boundary that stories 4 to 10 extend.

**Approach:** Add a read-only `GET /api/admin/dashboard?period=7|30|90` that returns Visites (with its previous period and delta) and Prospects ouverts (a snapshot, so no delta, per EXPERIENCE.md › Dashboard metrics and the mockup). Periods are Europe/Brussels calendar days, and one shared pure function defines them. `/admin` becomes Tableau de bord: header, period selector (default 30), those two KPI cards, skeletons and a load-failed alert. Unknown admin paths show `copy.errors.notFound`. Every admin mutation invalidates the dashboard query.

**Decisions (2026-09-26, user):** the sidebar gains a Pilotage group with Tableau de bord at `/admin`, matched exactly, so it is never current on another admin path. The spec is kept whole despite running past 1,600 tokens.

## Boundaries & Constraints

**Always:** A period of N days runs from Brussels midnight N−1 days ago to Brussels midnight tomorrow (exclusive). The previous period is the N days before that. Daylight-saving days are 23 h or 25 h, never `N × 24 h`. Delta = (value − previous) ÷ previous, and it is `null` when previous is 0; the UI shows "—" for `null`. Visites counts every row in `visits` (merged prospects' visits included, quarantined visits excluded) by clamped `visited_at`. Prospects ouverts counts live (`merged_into IS NULL`) prospects in `OPEN_STATUSES`. The zod contract lives in `src/shared/schemas.ts` (zod/mini). French strings go only in `copy.ts`. Update `docs/api.md` and `docs/design.md` in the same change.

**Never:** No Convertis, Taux de conversion, sparklines, mini-bar, chart, pipeline, agent table, À traiter or Dernières visites (stories 5–9). No polling on the dashboard query. No clickable cards (story 10). Do not change the field tab's target (story 11). No new npm dependency: `radix-ui` already ships ToggleGroup. No schema change or migration.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default period | `GET /api/admin/dashboard` | `period: 30` | — |
| Bad period | `?period=14` or `?period=abc` | 400 | shared `validate` |
| Agent caller | role agent | 403 | `requireAdmin` |
| Boundary | visit at exactly `from` / at `from − 1` | counted in current / in previous | — |
| Previous empty | no visits in previous period | `delta: null`, card shows "—" | — |
| Flat | value equals previous (> 0) | `delta: 0`, neutral chip "0,0 %" | — |
| Snapshot | same data, period 7 / 30 / 90 | `openProspects` identical | — |
| DST | `now` in the week after 29 Mar or 25 Oct 2026 | `from` is Brussels 00:00 exactly | — |
| Load fails | request errors | Alert with "Réessayer" that refetches | — |
| Unknown path | `/admin/inconnu` | `copy.errors.notFound` inside the admin frame; breadcrumb falls back to the app name | — |
| Sidebar current | `/admin` / `/admin/prospects` | Tableau de bord current / only Prospects current | — |

</frozen-after-approval>

## Code Map

- `src/shared/period.ts` (new) -- `brusselsPeriod(now, days) → { from, to, previousFrom }` and `deltaOf(value, previous) → number | null`. Pure, using `Intl.DateTimeFormat` with `timeZone: "Europe/Brussels"` (the formatter is cached in module scope, per invariant 13). Brussels midnight never falls in a DST gap, so a two-pass offset lookup is exact. This file is the one home of the boundary.
- `src/shared/constants.ts` -- `DASHBOARD_PERIODS = [7, 30, 90] as const`, `DASHBOARD_DEFAULT_PERIOD = 30`. Reuse `OPEN_STATUSES`.
- `src/shared/schemas.ts` -- `dashboardQuerySchema` (coerced, only the three values, default 30) and `dashboardResponseSchema`: `{ period, from, to, visits: { value, previous, delta }, openProspects }`, plus exported types. Follow `visitsSinceQuerySchema`'s style.
- `src/worker/routes/admin.ts` -- `adminRoutes.get("/dashboard", validate("query", …))`. Visits takes one statement with `SUM(CASE …)` over `visited_at >= previousFrom AND visited_at < to`, which uses `visits_visited_idx`. Open prospects takes one count. Follow the `add-api-route` skill.
- `src/worker/dashboard.test.ts` (new) -- copy `call()` and `beforeEach` from `admin.test.ts:31,67`. Insert rows directly through `getDb`, at instants computed with `brusselsPeriod(Date.now(), p)`.
- `src/client/ui/toggle-group.tsx`, `toggle.tsx`, `card.tsx` (vendored) -- shadcn new-york, repointed at `radix-ui` and `@/lib/utils` (docs/design.md › Working with shadcn).
- `src/client/admin/dashboard/DashboardScreen.tsx`, `KpiCard.tsx` (new) -- layout from `key-a1-dashboard.html`. Title (`typography.title`) and subtitle on the left, the ToggleGroup on the right. Cards are 4-up at `lg`, 2×2 at `md` and 1 column below (only 2 cards exist now, in the same grid). KpiCard: overline label, a 32px `secondary` icon tile (Lucide `Store` for Prospects ouverts, `MapPin` for Visites), a `.tnum` figure, and a delta chip (Badge: `success` + ArrowUp when up, `destructive` + ArrowDown when down, neutral when 0 or "—") followed by "vs période précédente". No coloured edge.
- `src/client/format.ts` -- `formatDelta(delta: number | null)`, giving "+12,4 %", "−3,0 %", "0,0 %" or "—" (French decimals, signed).
- `src/client/admin/queries.ts` -- `adminKeys.dashboard(period)` = `["admin","dashboard",period]` and `useDashboard(period)` with `placeholderData: keepPreviousData`. `useImportBatches` also invalidates `["admin","dashboard"]` (it is not a `useMutation`).
- `src/client/admin/query-client.ts` (new) -- `createAdminQueryClient()` with the defaults moved out of `AdminApp.tsx:25`, plus a `MutationCache` whose `onSuccess` invalidates `["admin","dashboard"]`, so a future mutation cannot forget.
- `src/client/admin/AdminApp.tsx` -- `<Route index>` → DashboardScreen and `<Route path="*">` → a paragraph with `copy.errors.notFound`.
- `src/client/admin/nav.ts` -- first group `copy.nav.groups.pilotage` ("Pilotage") holding `{ label: copy.nav.dashboard, path: "/admin", icon: LayoutGrid, end: true }`. `NavItem` gets an optional `end`, and `isCurrent(pathname, path, end?)` matches exactly when it is set. `AdminSidebar.tsx:66` and `breadcrumbFor` pass it; the NavLink gets `end` too. Update the doc comment and `nav.test.ts` (`ADMIN_APP_ROUTES` + the index).
- `src/client/copy.ts` -- `nav.groups.pilotage` and `nav.dashboard`, plus a `dashboard` block: title, subtitle, `periods` (`7 jours` / `30 jours` / `90 jours`), `periodLabel` (the group's aria name), `openProspects`, `visits`, `vsPrevious`, `loadFailed` ("Impossible de charger le tableau de bord."), `retry`. Strings from EXPERIENCE.md › Approved new strings.
- `docs/api.md` -- a row under Admin, plus a "## The dashboard" section: period bounds, the delta rule and the two definitions. Stories 4–10 extend it.
- `docs/design.md` -- the Layout sidebar paragraph gains Pilotage, and a "### Tableau de bord" section under Layout: the header, selector, KPI card anatomy, grid, loading and failure states.

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/period.ts`, `period.test.ts` -- boundary, previous period and DST cases from the matrix, with fixed instants on both sides of Brussels midnight in winter and summer; `deltaOf` covers 0, flat, up and down
- [ ] `src/shared/constants.ts`, `schemas.ts` -- the periods and the contract
- [ ] `src/worker/routes/admin.ts`, `src/worker/dashboard.test.ts` -- the route; tests for each period's value and previous at the boundaries, `delta: null`, the snapshot staying identical across periods (converted, rejected and merged excluded), 400 and 403
- [ ] `src/client/format.ts`, `format.test.ts` -- `formatDelta`
- [ ] `src/client/ui/toggle-group.tsx`, `toggle.tsx`, `card.tsx` -- vendor, translating any English strings they ship with
- [ ] `src/client/admin/query-client.ts`, `query-client.test.ts`, `queries.ts`, `AdminApp.tsx` -- client factory, hook, routes; the test runs a mutation through the cache and sees the dashboard query invalidated
- [ ] `src/client/admin/dashboard/*`, `src/client/copy.ts` -- screen, cards, skeletons, alert
- [ ] `src/client/admin/nav.ts`, `nav.test.ts`, `AdminSidebar.tsx` -- Pilotage group and exact-match index item
- [ ] `src/client/admin/AdminApp.test.tsx` (dom) -- `/admin` shows the "Tableau de bord" heading; `/admin/inconnu` shows `copy.errors.notFound` (stub `fetch`)
- [ ] `docs/api.md`, `docs/design.md` -- DoD

**Acceptance Criteria:**
- Given seeded local data, when `/admin` opens in `pnpm dev`, then both cards render for 30 jours, and choosing 7 or 90 jours changes Visites and its delta while Prospects ouverts stays put.
- Given a successful assign on Prospects, when the admin returns to `/admin`, then Prospects ouverts refetches rather than showing its cached figure.
- Given `pnpm build && pnpm check:precache`, then it passes, and the field precache total is unchanged except for shared bytes; quote it against 1,000 KiB (baseline 676.74 KiB).

## Implementation Notes

- Implemented by a subagent from this spec. All Verification commands re-run by the orchestrator: 50 files / 1090 tests, typecheck and lint clean, `check:precache` 680.89 KiB of 1,000 (baseline 676.74; +0.86 KiB entry JS from shared/copy/format, +3.3 KiB shared Tailwind CSS from the new classes).
- Matrix audit: every row has a passing covering test (`period.test.ts`, `dashboard.test.ts`, `format.test.ts`, `nav.test.ts`, `query-client.test.ts`, `DashboardScreen.test.tsx`, `AdminApp.test.tsx`). "Flat" is covered in two halves: the worker gives `delta: 0`, and `deltaTone`/`formatDelta` give neutral "0,0 %".
- Deviation: the delta chip uses two new Badge variants, `tint-success` and `tint-destructive` (colour on its tint, pairs `palette.test.ts` already asserts), rather than `success`/`destructive`: the existing `destructive` is a solid fill, which DESIGN.md reserves for actions. Tone follows the rounded figure, so "0,0 %" never gets an arrow.
- Found in passing (not fixed): `cn()`'s tailwind-merge treats the custom `text-meta`/`text-overline` tokens as colours and drops an earlier `text-*` colour. `App.tsx:318` still redirects `/` for an admin to `/admin/prospects`.
- Review pass 1: 11 patches applied by the same implementer; orchestrator re-ran Verification: 51 files / 1101 tests, typecheck and lint clean, `check:precache` 680.91 KiB. Found-in-passing issues GH #135 (`/` redirect) and GH #136 (`cn()` text tokens).
- Browser check in `pnpm dev` at 1280/820/390 px, light and dark; the chip states were checked against a faked response, because the local seed has no visits (story 4).

## Spec Change Log

## Review Triage Log

Pass 1 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: 0 high, 1 medium, 12 low, 5 false, 0 maybe-false. 11 patched, 3 deferred, 10 rejected.

- `medium` / **patch**: edge-case-hunter + blind-hunter. A failed refetch while data exists (a remount after invalidation, or a retry) sets `isError`, and `DashboardScreen` swaps the good figures for the Alert. TanStack v5 keeps `data` in the error state, and the epic says the panels keep their last values. Fix: show the Alert whenever `isError`, with the cards under it when data exists.
- `low` / **patch**: edge-case-hunter. `isCurrent(…, end)` accepts `/admin/`, but NavLink `end` does not (react-router `lib.js:388`: `locationPathname === toPathname`). The item gets the gold fill without `aria-current`, and `nav.test.ts` pins the divergence. Fix: exact match only.
- `low` / **patch**: edge-case-hunter + blind-hunter. `tenths()` uses `Math.round`, so halves round toward +∞: −0.0005 is flat while +0.0005 is up, and ±0.0125 is asymmetric. Fix: round the absolute value and re-apply the sign.
- `low` / **patch**: blind-hunter. The `sr-only` loading text sits inside the `aria-busy` grid with no live region. Fix: `role="status"` outside the grid, as in VisitsScreen.
- `low` / **patch**: blind-hunter. `admin.ts:196`, `format.ts:50` and `period.ts:92` cite EXPERIENCE.md, which is not in the repo; no other src file cites it. Fix: point to `docs/api.md` › The dashboard.
- `low` / **patch**: blind-hunter. With `staleTime` 0, the dashboard refetches on mount anyway, and the cached figures still show first. "Refetched rather than served from the cache" (queries.ts, query-client.ts, design.md › Freshness) overclaims. Fix: reword. The sub-claim that read-only mutations (area searches) also invalidate is **rejected**: the cost is one extra refetch, and the intent says every mutation.
- `low` / **patch**: verification-gap (pre-verified). The keep-previous-data path is untested: deleting `keepPreviousData` passed all tests. Fix: add a test with a held second answer.
- `low` / **patch**: verification-gap (pre-verified). Chip tone is untested at render: swapping up and down in `TONE` passed. Fix: assert variant and arrow for up, down and null.
- `low` / **patch**: verification-gap (pre-verified). `useImportBatches`' dashboard invalidation is untested: removing it passed. Fix: a hook test.
- `low` / **patch**: blind-hunter. The `stubFetch` doc comment names a `byPeriod` parameter that is actually `respond`.
- `low` / **patch**: blind-hunter. The glossary has no entry for Tableau de bord or Prospects ouverts (open prospect), terms stories 4–10 will keep using.
- `low` / **defer**: blind-hunter + intent-alignment R1. `App.tsx:318` still redirects an admin at `/` to `/admin/prospects`. This predates the story, and the frozen intent names `/admin`, not `/`. GH #135.
- `low` / **defer**: blind-hunter. `cn()` (tailwind-merge without `extendTailwindMerge`) reads `text-meta`/`text-overline`/`text-display`/`text-title` as colours and drops a text colour. This predates the story (`src/client/lib/utils.ts`). GH #136.
- `low` / **defer**: verification-gap (filed defer). Nothing pins that AdminApp's provider is `createAdminQueryClient()`: reverting the line passed. The factory itself is pinned.
- **rejected** (`low`, unlikely, and the fix adds schema complexity): edge-case-hunter + blind-hunter. `z.coerce.number()` accepts `30.0`, `3e1` and ` 30`. Each still resolves to one of the three periods, so the answer is correct.
- **rejected** (`low`, unlikely, and the fix needs clock injection): edge-case-hunter, blind-hunter and verification-gap. The worker test can flake if a run straddles Brussels midnight.
- **rejected** (`false`): edge-case-hunter. `brusselsPeriod` with `days <= 0` is unreachable: the only caller is behind `dashboardQuerySchema`, which allows 7, 30 or 90.
- **rejected** (`false`): blind-hunter. "The response is never schema-checked, so a wrong type passes" does not hold: the `toEqual` checks on exact numbers fail on a string, a null or a missing `openProspects`.
- **rejected** (`false`): blind-hunter. The period missing from the URL breaks no stated requirement; resetting to the default of 30 is what the intent says.
- **rejected** (`low`, no order dependence shown): blind-hunter. AdminApp's module-scope client is shared across the two AdminApp tests. The second test reads no cached query.
- **rejected** (`low`, unlikely, and the fix changes `isCurrent` for every item): intent-alignment R5. On `/admin/prospects/xyz` the page says introuvable while Prospects is highlighted, by the pre-existing prefix rule.
- **rejected** (`false`): intent-alignment R3. A partial today against N whole days is the frozen Always rule, documented in api.md.
- **rejected** (descriptive): intent-alignment R2, R4 and R6. The diff implements the snapshot reading the intent states; a failed import still invalidating is harmless; the split test surfaces are covered by the rows above.

## Design Notes

**The server computes the delta.** "Each figure is defined once, and the Worker computes it" (EXPERIENCE.md). `deltaOf` sits in `src/shared` only so the worker test and later stories share it. The client just formats it.

**Prospects ouverts carries no delta.** The story's "with their deltas" is read against the metric definition and the mockup, which draws an empty delta row for Prospects ouverts. The worker test asserts that the figure is identical across the three periods instead.

## Verification

**Commands:**
- `pnpm test` -- expected: all projects pass
- `pnpm typecheck` -- expected: clean
- `pnpm lint` -- expected: clean
- `pnpm build && pnpm check:precache` -- expected: exit 0; total quoted

**Manual checks:**
- `pnpm dev`: `/admin` at 1280, 820 and 390 px in light and dark; `/admin/inconnu` shows "Page introuvable."
