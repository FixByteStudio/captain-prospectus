---
title: 'Visites rebuilt: ledger, KPI strip and date range (GH #178)'
type: 'feature'
created: '2026-09-27'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: 'f279511cfe4310a0612dd2c82230238b289e8ecb'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-174-context.md'
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Visites is a bare list with no period, no figures, no paging and no export; the dashboard's Visites card links to it unfiltered because the feed had no range (docs/design.md:300). G5 (`from`/`to` on the feed, #176) and the strip figures (#177) now exist server-side.

**Approach:** Rebuild `VisitsScreen` on the #175 primitives: a 7/30/90 selector held in the URL (`?period=`) that scopes the live feed with `from`/`to` and reads the same period from the G1 aggregate for a four-card strip; a 25-row client-side pager over the held feed; a CSV export of the same window. The dashboard's Visites card links to `/admin/visites?period=<its period>`.

## Boundaries & Constraints

**Always:** Keep every ADR-0010 feed behaviour (15 s poll, `since` cursor from held rows, ambient wash, live-region announcement, merged prospects shown, rows kept under a failure). Feed `from`/`to` come from `brusselsPeriod(now, period)` (`src/shared/period.ts`), `to` sent as `period.to − 1` because the feed's bounds are inclusive. French in `copy.ts`; tokens only; admin stays out of the precache. Existing tests keep their assertions (`feed.test.ts`, `nav.test.ts`, DashboardScreen except the Visites-card href). Fix #162 (wash transition on the base classes) and #160 (one announcement per poll) in both feed consumers.

**Never:** No worker, schema, sync or migration change. No new dependency. No toast for arrivals. No scroll area around the table. Tableau de bord's Dernières visites stays unscoped (last 5 of everything).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default | `/admin/visites` | period 30; feed `?since=0&from=<30-day from>&to=<to−1>`; aggregate `?period=30` | No error expected |
| Selector | click "7 jours" | URL `?period=7`; feed re-seeds from `since=0` with 7-day bounds; strip reads `period=7`; page back to 1; no wash/announcement for the reseed | No error expected |
| Bad URL | `?period=12` | treated as 30 | No error expected |
| Paging | 60 held visits | 25 rows, "Précédent" disabled on 1, pages 1 2 3, "Suivant" disabled on 3 | No error expected |
| Arrival while on page 2 | poll brings 1 | stays on page 2; announced once | No error expected |
| Empty window | feed `[]` | the existing empty copy, no pager | No error expected |
| Aggregate fails | 500 on dashboard | strip shows ScreenState's load-failed Alert with retry; ledger unaffected | retry refetches |
| Feed fails | 500 on feed | existing `copy.visits.loadFailed`; held rows stay | next poll retries |
| Opening page hits 500 rows | 500 visits returned | count reads as capped ("500 visites ou plus") | No error expected |

## Decisions (owner, 2026-09-27)

- **Strip links:** Relances dues sous 7 jours → `/admin/prospects?status=follow_up&dueBefore=<followUpsDueSoon.dueBefore>`; Taux de conversion → `/admin/prospects?status=converted` (every prospect converted now, as the dashboard's Convertis); Flyers remis and Agents en tournée are plain cards, not links.
- **Truncated export:** the button fetches the CSV, saves it, and when `x-truncated` is set shows a warning toast naming the 500-row cap and suggesting a shorter period. Prospects (#179) follows the same rule.
- **Spec size:** kept whole (~1,900 tokens) — one screen.

</frozen-after-approval>

## Code Map

- `src/client/admin/VisitsScreen.tsx` -- rebuild. ScreenHeader (title, lede `copy.visits.lede`, actions = count, selector, export). Strip + ledger. Key the feed part by period so a period change remounts the hook (fresh cursor, `seeded` reset).
- `src/client/admin/queries.ts:284` `useVisitsFeed()` -- add optional `period`; when set, key `["admin","visits","feed",period]` (keep `adminKeys.visitsFeed()` as the prefix so existing invalidations/refetches still match) and compute bounds inside `queryFn` each poll. No-arg call unchanged for `RecentVisits`. Also return `answeredAt` (or a poll counter) so consumers can key the live region (#160).
- `src/client/admin/queries.ts:65` `useDashboard(period)` -- reused as-is for the strip.
- `src/client/admin/dashboard/DashboardScreen.tsx:79-101` -- the ToggleGroup period control; extract to `src/client/admin/PeriodToggle.tsx` and use it on both screens (same look, same "" guard).
- `src/client/admin/dashboard/DashboardScreen.tsx:144` -- Visites card `to` becomes `visitsHref(period)`; update the comment and `DashboardScreen.test.tsx:217` (`/admin/visites?period=30`) — the approved exception.
- `src/client/admin/dashboard/RecentVisits.tsx` -- #160/#162 fixes; its comment "same cache entry as Visites" becomes "same feed, unscoped".
- `src/client/admin/dashboard/KpiCard.tsx` -- look only; the strip is a new compact card (overline label, display figure, meta line; no icon tile, no sparkline, no edge), linked like KpiCard (`copy.dashboard.openList`, ring focus, accent hover).
- `src/client/admin/ScreenState.tsx`, `ScreenHeader.tsx`, `Surface.tsx` -- #175 primitives to compose from.
- `src/client/ui/table.tsx`, `ui/button.tsx`, `ui/skeleton.tsx`, `ui/sonner.tsx` -- vendored; add `ui/pagination.tsx` from shadcn (markup only, strings via props from `copy.ts`) for Prospects (#179) to reuse.
- `src/client/admin/dashboard/outcome-series.ts` `OUTCOME_BADGE`, `status.ts` `STATUS_EDGE` -- outcome badge and row edge, as RecentVisits does.
- `src/client/copy.ts:441` `visits` -- add period/strip/pager/export strings; reuse `copy.dashboard.periods`, `conversionRate`, `openList`.
- `src/shared/constants.ts` -- `DASHBOARD_PERIODS`, `DASHBOARD_DEFAULT_PERIOD`, `ADMIN_VISITS_PAGE_SIZE` (500), `EXPORT_ROWS` (500).
- `GET /api/admin/visits/export.csv?from&to` -- inclusive bounds on `received_at`, newest first, `x-truncated: true` over 500.
- `docs/design.md:296-300` and `:642-690` -- delete the "no date range yet" clause; rewrite The live feed for selector, strip, pager, export.
- New: `src/client/admin/VisitsScreen.test.tsx`; pure pager helper + test (e.g. `src/client/admin/pagination.ts`).

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/admin/pagination.ts` (+test) -- `pageCount`, `pageSlice`, `pageItems(current, total)` with ellipsis -- pure, reused by #179
- [ ] `src/client/ui/pagination.tsx` -- vendor shadcn pagination, no inline English -- ADR-0014
- [ ] `src/client/admin/PeriodToggle.tsx` -- extract from DashboardScreen -- one selector look
- [ ] `src/client/admin/queries.ts` -- period-scoped feed + `visitsHref(period)` + CSV download helper -- G5
- [ ] `src/client/admin/VisitsScreen.tsx` (+ strip/row subcomponents under `src/client/admin/visits/`) -- the rebuild -- #178
- [ ] `src/client/admin/dashboard/DashboardScreen.tsx`, `RecentVisits.tsx` -- card href, #160, #162
- [ ] `src/client/copy.ts` -- every new French string
- [ ] `src/client/admin/VisitsScreen.test.tsx` -- every I/O row, the four strip figures and each card's href -- AC of #178
- [ ] `src/client/admin/dashboard/DashboardScreen.test.tsx` -- Visites-card href only
- [ ] `docs/design.md` -- design.md:300 sentence and The live feed

**Acceptance Criteria:**
- Given the rebuilt screen, when `pnpm test` runs, then DOM tests pin the selector driving both the feed request and the strip, pagination, the four strip figures, each card's link target and the empty feed copy, and every pre-existing test passes with its assertions unchanged except the dashboard Visites-card href.
- Given `pnpm build`, when the precache manifest is read, then its total is quoted against 1,000 KiB and no admin module is precached.

## Implementation Notes

- Implemented by the pwa-engineer subagent. Orchestrator fixes after reading the diff: `downloadCsv` no longer inlines French and drops its 426 branch (copy.errors.sessionExpired; one export-failed string); "ou plus" is decided by the opening page filling ADMIN_VISITS_PAGE_SIZE, not by `>= 500` held rows; docs/design.md and the dashboard comment no longer claim the Visites count equals the dashboard figure (received_at vs visited_at, 500 cap); four tests added.
- Review patches (triage log rows 1-17) applied by the same subagent. Test fixtures now offset `receivedAt` from a pinned NOW because the window trim drops rows outside the real period.
- Verification: typecheck, lint, 73 files / 1,755 tests, build green. Precache 25 entries, 935.61 KiB of 1,000 KiB; no admin chunk in dist/client/sw.js.
- baseline_commit re-stamped at PR time from the merge-base with origin/main.

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped, not a sweep). Counts: high 0, medium 4, low 13, false 4, rejected-low 6. Routes: 17 patch, 0 defer, 0 loopback.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | edge | Period change pushes history; comment and design.md say it replaces | medium | patch: ProspectsScreen.tsx:94 passes `{ replace: true }`; VisitsScreen does not. |
| 2 | blind, edge, vgap | Held rows not trimmed when Brussels midnight moves `from` | medium | patch: filter merged rows to the poll's `from` in the scoped hook. |
| 3 | vgap, edge | Feed bounds never asserted; reseed tests pass on pre-click state | medium | patch: fake clock, exact `from`/`to−1` for 30 and 7, wait for the 7-day answer, calls after the click only. |
| 4 | vgap | Dashboard Visites card href untested at 7 jours | medium | patch: assert `?period=7` in the existing switch test. |
| 5 | blind, edge, vgap | `revokeObjectURL` same tick, anchor detached | low | patch: attach, click, remove, revoke on a later tick. |
| 6 | blind, edge | Truncation copy hardcodes 500; comment/test title mix EXPORT_ROWS and ADMIN_VISITS_PAGE_SIZE | low | patch: copy takes the cap; fix comment and test title. |
| 7 | blind, vgap | `downloadCsv` 401/500 paths and `download` filename untested | low | patch: two cases + filename assertion. |
| 8 | blind | Page-back-to-1 on period change untested | low | patch. |
| 9 | blind, vgap | #160/#162 untested | low | patch: live-region node replaced per poll; base row carries `transition-colors`. |
| 10 | blind | Ellipsis `aria-hidden` hides its sr-only label | low | patch: aria-hidden on the icon only. |
| 11 | blind | Page change leaves viewport at the pager | low | patch: scroll the ledger's top into view on page change. |
| 12 | edge | Strip ScreenState has no `loading` announcement | low | patch: `copy.visits.strip.loading`. |
| 13 | edge | RecentVisits and `mountedAt` comments still say one shared entry | low | patch (comment). |
| 14 | blind | `useVisitsFeed` doc says the ledger is keyed; it is the body | low | patch (comment). |
| 15 | blind | `isPeriod` duplicated in PeriodToggle and VisitsScreen | low | patch: parse through `dashboardQuerySchema`. |
| 16 | intent | `Surface` primitive unused | low | patch: ledger list inside `Surface`. |
| 17 | blind | design.md line unwrapped; "not capped at what the ledger holds" is misleading (both 500) | low | patch (doc). |
| 18 | edge | Unquoted filename with extra params | false | `csvDisposition` (src/shared/csv.ts:78) always quotes. |
| 19 | blind | Precache figure not in diff | false | Goes in the PR body: 935.01 KiB / 1,000; no admin chunk in dist/client/sw.js. |
| 20 | intent | Ledger/export on `received_at`, aggregate on `visited_at` | false | By design (docs/api.md, design.md live feed "Time is the spine"); design.md now states the counts may differ. |
| 21 | intent | #160/#162 outside scope | false | Story references both issues; spec Always folds them in. |
| 22 | edge | Delta poll hitting 500 rows | low, rejected | 500 arrivals in 15 s is not an everyday case; fix adds state. |
| 23 | edge | Export after midnight before next poll | low, rejected | Millisecond-to-15 s window once a day. |
| 24 | edge, blind | Rows shift on the current page when arrivals land | low, rejected | Inherent to a newest-first live list; design.md says the reader keeps their page. |
| 25 | blind | Announcing arrivals while on page > 1 | low, rejected | Visites' whole feed is the list; an arrival is news on any page (RecentVisits differs: it shows a 5-row cut). |
| 26 | blind | Dashboard period not in its URL | low, rejected | Tableau de bord is epic-dashboard's, not this epic's (Boundaries). |
| 27 | blind | Inactive period entries refetched by prefix refetch | low, rejected | Only `refetchQueries` with type all does this (tests); mutations invalidate `dashboards()` only. |

## Design Notes

The selector reuses the dashboard's segmented ToggleGroup rather than Stitch A10's dropdown: DESIGN.md's precedence puts the spines above Stitch, and one period control across both screens is less to learn. The pager is client-side over the held feed (≤ 500 rows per window) — no server paging exists on the feed and none may be added. The live-region fix keys the `role="status"` paragraph by the poll's `dataUpdatedAt` so identical consecutive texts are re-announced.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all green
- precache total from `pnpm build` output (`dist/sw.js` manifest) -- expected: < 1,000 KiB, quoted in the PR
