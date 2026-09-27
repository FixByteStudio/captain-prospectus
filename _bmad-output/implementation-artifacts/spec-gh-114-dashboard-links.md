---
title: 'Dashboard links open filtered lists (GH #114)'
type: 'feature'
created: '2026-09-27'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: []
baseline_commit: '5b358f40467c817e05a5ff329789c61dd2e66767'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tableau de bord's figures are dead ends: the KPI cards are not links, and Relances dues' Voir opens Prospects unfiltered, because `GET /api/admin/prospects` takes one `status` and no due date (server-gaps G3, G10), and Prospects keeps its filters in component state, not the URL.

**Approach:** `GET /api/admin/prospects` gains `dueBefore=<ms>` (`next_visit_at < dueBefore`) and a comma-separated multi-value `status`, both additive and bound as parameters. Prospects reads and writes its filters in the URL (`useSearchParams`). The Prospects ouverts, Visites and Convertis cards and Relances dues' Voir link to their lists.

**Decisions (2026-09-27, user):**
1. Visites links to `/admin/visites` unfiltered: the card counts `visited_at` in the period, the feed does not filter by date, so its count need not equal the figure; design.md says so. The date range stays with epic-admin-screens (G5).
2. Convertis links to `?status=converted`: the card counts prospects that became converted in the period, the list every prospect converted now; the counts may differ, and design.md says so.
3. Activité par agent rows stay unlinked; the stale "(story 10)" notes in design.md and `AgentActivityTable.tsx` are reworded.

## Boundaries & Constraints

**Always:** A single `status` value behaves as today; an unknown one still 400s. Duplicate statuses collapse; at most `STATUSES.length` values bind, far under 100 (invariant 7). `dueBefore` is epoch ms, and a null `next_visit_at` is never due. The contract is zod/mini in `schemas.ts`, documented in `docs/api.md`. Relances dues' link uses `brusselsPeriod(Date.now(), period).to` from `src/shared/period.ts`, the dashboard's own boundary, so its list total equals `followUpsDue`. Prospects ouverts links to `status=new,assigned,follow_up` built from `OPEN_STATUSES`. A whole KPI card is one link with an accessible name (label plus figure) and a visible focus ring. Changing a filter in Prospects rewrites the URL (replace, not push) and clears the selection. A URL filter the selects cannot show (several statuses, `dueBefore`) stays visible as a removable chip; "Effacer les filtres" clears the URL. Strings in `copy.ts`, colours from tokens. The PR quotes `check:precache`'s total against 1,000 KiB.

**Never:** No schema change, migration or new dependency. No change to the export's filters, the dashboard endpoint, or the field route. No Prospects rebuild (epic-admin-screens) beyond reading the URL and showing the chips.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Several statuses | `status=new,assigned,follow_up` | live prospects in any of the three; `total` = dashboard `openProspects` | — |
| One status | `status=assigned` | as today | — |
| Duplicates | `status=new,new` | same as `status=new` | — |
| Bad value | `status=new,parti` or `status=` or `status=new,` | — | 400 `validation` |
| Due | `status=follow_up&dueBefore=T`; `next_visit_at` T−1, T, null | only T−1 | — |
| Bad dueBefore | `dueBefore=abc` or `-1` | — | 400 `validation` |
| Deep link | open `/admin/prospects?status=converted` | Status select shows Converti; list filtered | — |
| Chip | URL with several statuses or `dueBefore` | chip shown; its × drops that filter from the URL | — |
| Relances dues Voir | 13 due on the seed | Prospects total reads 13 | — |

</frozen-after-approval>

## Code Map

Work in the `/home/m0/PROJECTs/captain-prospectus-114` worktree (branch `feat/114-dashboard-links`); every path below is relative to it. This spec lives in the main checkout's untracked `_bmad-output`. Do not commit or push.

- `src/shared/schemas.ts:248` -- `prospectsQuerySchema`: `status` becomes `z.optional(z.pipe(z.string(), z.transform(split on ",")), z.array(statusSchema).check(z.minLength(1)))` then dedupe; `dueBefore: z.optional(z.coerce.number().check(z.int(), z.nonnegative()))`. Leave `prospectsExportQuerySchema:696` alone.
- `src/worker/routes/admin.ts:548` -- `status ? inArray(prospects.status, status)`; `dueBefore !== undefined ? lt(prospects.nextVisitAt, dueBefore)` (as `followUpsDue` at :279). Same `where` feeds rows and `total`.
- `src/worker/admin.test.ts:89` -- new cases per matrix rows 1–6; bound-parameter check with `db.select().from(prospects).where(...).toSQL().params` or by asserting a quote in a value cannot 500.
- `src/client/admin/queries.ts:34,70` -- `ProspectFilters.status?: Status[]`, `dueBefore?: number`; `toQueryString` joins statuses with ",". Add `prospectsHref(filters)` (exported, pure) that both the dashboard and Prospects use, so the link and the list parse one format; add `parseProspectFilters(URLSearchParams)` beside it, validating through `prospectsQuerySchema`'s pieces (drops what fails rather than throwing).
- `src/client/admin/ProspectsScreen.tsx:48` -- `useSearchParams` replaces `useState<ProspectFilters>`; `setFilter` writes the URL (`{ replace: true }`); the Status select shows the single value or `ANY`-with-chip for several; `filtered` includes `dueBefore`; clear drops every param. Chips: `ui/badge` + ghost icon `Button` (Lucide `X`).
- `src/client/admin/dashboard/KpiCard.tsx:36` -- optional `to` prop: wraps the `Card` in a react-router `Link` (`block rounded-xl focus-visible:ring-*`, hover `bg-accent`-ish token per design.md), `aria-label` label + value.
- `src/client/admin/dashboard/DashboardScreen.tsx:116` -- pass `to` to three cards and `dueBefore` to `TodoPanel` (from `brusselsPeriod(Date.now(), period).to`).
- `src/client/admin/dashboard/TodoPanel.tsx:48` -- Voir → `prospectsHref({ status: ["follow_up"], dueBefore })`; drop the "until story 10" comment.
- `src/client/copy.ts` -- `prospects.filters.severalStatuses(labels)`, `prospects.filters.dueBefore(date)`, `prospects.filters.remove(label)`, `dashboard.openList(label, value)`.
- Tests: `DashboardScreen.test.tsx` (card hrefs, Voir href), a new `ProspectsScreen.test.tsx` (deep link sets filters and request URL; chip removal; select change rewrites URL), `queries.test.tsx` (`toQueryString`/`parseProspectFilters` round-trip).
- `docs/api.md:26,71`, `docs/design.md:356,363` + Prospects section, `AgentActivityTable.tsx:19` -- the two params; card links and which counts match (decisions 1–2); chips; drop both "story 10" notes.

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/schemas.ts`, `src/worker/routes/admin.ts`, `src/worker/admin.test.ts` -- multi `status`, `dueBefore`, matrix rows 1–6
- [ ] `src/client/admin/queries.ts`, `queries.test.tsx` -- filter type, `prospectsHref`, `parseProspectFilters`
- [ ] `ProspectsScreen.tsx`, `ProspectsScreen.test.tsx`, `copy.ts` -- URL filters, chips, matrix rows 7–8
- [ ] `KpiCard.tsx`, `DashboardScreen.tsx`, `TodoPanel.tsx`, `DashboardScreen.test.tsx` -- links
- [ ] `docs/api.md`, `docs/design.md` -- Definition of Done

**Acceptance Criteria:**
- Given `pnpm db:seed:local` and `pnpm dev`, when the admin clicks Prospects ouverts or Relances dues' Voir, then Prospects' count equals the figure clicked, at 7, 30 and 90 days; Visites and Convertis land on their lists (decisions 1–2).
- Given a filtered Prospects, when the page is reloaded or the URL shared, then the same filters and count come back.
- Given `pnpm build && pnpm check:precache`, then it passes and the PR quotes the total against 1,000 KiB.

## Implementation Notes

- Implemented by a subagent in the `feat/114-dashboard-links` worktree (interrupted once by a rate limit, resumed with its context).
- **Deviation from Always:** Voir's `dueBefore` is the dashboard answer's own `to` (`data.to`), not `brusselsPeriod(Date.now(), period).to` computed on the client. `react-hooks/purity` fails lint on `Date.now()` in render, and `data.to` is the exact instant the Worker counted `followUpsDue` against, so the list total equals the figure even when a cached answer is read after midnight. Same boundary, one fewer computation.
- `statusListSchema` and `dueBeforeSchema` are exported from `schemas.ts` so `parseProspectFilters` validates the URL with the API's own rules and drops what would 400.
- Chips: `secondary` Badge with a ghost × Button (inset focus ring, since the Badge clips an outer one); the Statut select reads "Tous les statuts" when several are set.
- Final verification after review patches: typecheck, lint clean; `pnpm test` 1614/1614; `check:precache` 899.81 KiB of 1,000 (entry `index-*.js` 379.98 KiB). Manual `pnpm dev` checks not run: the worktree has no `.dev.vars` and reading the main checkout's is denied; the Worker test tying the totals to the dashboard stands in.
- Implementer's run: typecheck, lint clean; `pnpm test` 1606/1606; `check:precache` 899.58 KiB of 1,000.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped, not a refactor). Verdicts: 0 high, 2 medium, 10 low, 1 false; 0 intent_gap, 0 bad_spec, 9 patched, 0 deferred, rest rejected.

- `medium` / **patch**: edge-case-hunter. Selection survived a URL change from outside `writeFilters` (the sidebar link, Back), so bulk assign could act on hidden rows; before this change the filters were component state and a same-route click kept both. Fix: the selection is tied to the query string.
- `medium` / **patch**: intent-alignment, verification-gap. Nothing tied the list totals to the dashboard figures (R2's central claim), and the manual `pnpm dev` count check could not run here. Fix: a Worker test comparing `openProspects` and `followUpsDue` with the prospects totals on the same data.
- `low` / **patch**: blind-hunter, edge-case-hunter. With several statuses the Statut select read "Tous les statuts" beside the chip, and choosing it did nothing (value already selected). Fix: a placeholder for that case, so "Tous les statuts" clears it.
- `low` / **patch**: blind-hunter, edge-case-hunter, verification-gap. `dueBefore=` coerced to 0 (200, empty list) while `status=` 400s; "1e3"/"0x10" accepted. Fix: digits-only before coercion; 400 cases added.
- `low` / **patch**: edge-case-hunter. `dueBefore` above 8.64e15 passed validation and made `formatDate` throw, crashing Prospects. Fix: cap in the schema.
- `low` / **patch**: blind-hunter, edge-case-hunter. The chip date was browser-zone and long-form while design.md showed "28/09/2026". Fix: Brussels-zone formatter; the doc shows the real output.
- `low` / **patch**: blind-hunter, intent-alignment, verification-gap. "binds the statuses as parameters" never reached SQL. Fix: renamed or removed; binding rests on Drizzle `inArray`/`lt`.
- `low` / **patch**: verification-gap, blind-hunter. Untested: `dueBefore`-only empty state, replace-not-push. Fix: tests.
- `low` / **patch**: blind-hunter. `ProspectFilters.assignedTo`'s "none" comment false now that the parser drops it. Fix: sentence deleted.
- **rejected** (`low`): blind-hunter, edge-case-hunter. One bad status item drops the whole list and the URL keeps it; hand-edited URLs only, and the spec says drop rather than throw.
- **rejected** (`low`): edge-case-hunter. An `assignedTo` outside the roster leaves a blank trigger; hand-edited or a removed agent, fix adds a chip branch.
- **rejected** (decision): blind-hunter. Convertis's name promises the figure's list; decision 2, documented. Agent rows unlinked; decision 3.
- **rejected** (`false`): blind-hunter. Visites deferral untracked: the date range is server-gap G5, owned by epic-admin-screens.

## Design Notes

**Why comma-separated, not repeated keys.** `zValidator("query")` hands a repeated key's last value to a plain schema, so `status=a&status=b` would silently mean `b`. One key with commas stays one string, keeps a single value byte-identical to today's request, and reads cleanly in a shared URL.

**Why `dueBefore` is `to`, computed on the client.** `followUpsDue` is `next_visit_at < to`; passing that same instant makes the list and the figure one definition, and `brusselsPeriod` is pure shared code.

## Verification

**Commands:**
- `pnpm test`, `pnpm typecheck`, `pnpm lint` -- expected: clean
- `pnpm build && pnpm check:precache` -- expected: exit 0; quote the total

**Manual checks:**
- `pnpm dev` on the seed: each card and Voir; reload a filtered Prospects; 390 px chips wrap without page scroll.
