---
title: 'The Visites ledger shows one row per door-day (story 1.11, #507)'
type: 'feature'
created: '2026-10-16'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '64a718caf5732df652845859b2d25b3efe3c42f3'
context:
  - '{project-root}/docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-496-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Visites lists one row per visit, so a correction (Personne sur place at 10:00, Converti at 16:00) shows as two rows while every figure counts one door-day (entry 10). ADR-0036 R13 asks for one row per door-day with its full history behind it.

**Approach:** `GET /api/admin/visits` answers door-days: each touched door-day as one row (the latest visit's fields, flyer if any visit gave one, the arrival spine) carrying its visits oldest first. VisitsLedger renders `docs/design.md` › The live feed as already written: a disclosure row that opens in place onto « Visites de la journée ». The CSV export stays one row per visit. `docs/api.md` follows.

## Boundaries & Constraints

**Always:** A door-day is (agent, the visit's own `prospect_id`, Brussels day of the clamped `visited_at`). Its latest visit follows `LATEST_VISIT_FIRST` (one rule, `door-days.ts`). `since`, `from` and `to` still bound `received_at`. A door-day is listed when any of its visits falls in them, and it always arrives whole, all its visits included. Rows are ordered by the door-day's greatest `received_at`, which is also the cursor. `reason=` keeps door-days whose latest visit has that reason (design.md, R12). Merged prospects stay in, under the name the visit was made against. ≤100 bound parameters per statement. The Worker CPU stays under 10 ms on the seed, measured.

**Decisions (owner, 2026-10-16):** (1) Dernières visites shows the five newest door-days, since it reads the same feed query, and design.md :435 says so. (2) With `reason=`, a listed door-day whose later visit no longer has the reason stays as held until the next reseed (a period or reason change, or a reload), and api.md states it. (3) The spec is kept whole at ~1,900 tokens: it is one goal. (4) Review pass 1: a capped header counts the door-days held, not the 500 visits the server cut at. (5) A row's time is the door-day's latest arrival, the spine it is sorted by, and design.md says so.

**Never:** The CSV export's rows, columns or filter, any other dashboard figure, the sync route or contract, the schema or migrations, a dialog or sheet for the history, server paging.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Correction | one agent and one prospect: `no_contact` 10:00, `converted` 16:00 today | 1 row: `converted`, `visitCount` 2, visits oldest first; export has 2 rows |
| Second visit after seed | the row is held, then a later visit arrives | the poll returns the whole door-day; the row is replaced, moves to the top, and washes once |
| Flyer on the first visit only | flyer at 10:00, none at 16:00 | row `flyerGiven` true; each history line shows its own |
| Two days or two agents | same door on D and D+1, or two agents on D | 2 rows |
| Late sync | a visit made yesterday and received today | listed under yesterday's door-day, at the top by arrival |
| Reason | `not_interested`+`no_need` 10:00, `converted` 16:00, `reason=no_need` | not listed. Reversed order: listed |
| Cap | more touched visits than the limit | ≤ limit rows, `truncated: true`, count reads « {held door-days} visites ou plus » (owner, 2026-10-16) |

</frozen-after-approval>

## Code Map

- `src/worker/door-days.ts` -- home of the rule. Add `doorDaysTouched(db, { since, from, to, reason, limit })`. (1) Read the touched visits: `agent_email, prospect_id, visited_at` on the `received_at` filters, plus `refusal_reason = reason` when given (the latest visit then has it), `received_at desc`, `limit + 1` → `truncated`. (2) Key each touched visit by its Brussels day start, walking the sorted instants and calling `brusselsMidnightDaysFromNow` only when one crosses the day held (Intl calls ≈ 2 × distinct days, invariant 13). (3) Read every visit of those door-days joined to `prospects.name` in one statement driven by `json_each(?)` over `[agent, prospect, dayStart, dayEnd]` (1 bound param, served by `visits_prospect_visited_idx`), ordered `visited_at, received_at, id` asc, with `answerCount` as `(select count(*) from json_each(visits.answers))`. (4) Group them in JS: latest = last, `flyerGiven` = any, `receivedAt` = max; drop the rows whose latest reason ≠ `reason`; sort by `receivedAt` desc, then `key`.
- `src/worker/routes/admin.ts:1552-1617` -- `refusalReasonFilter` stays the export's alone, so its comment changes. The `/visits` handler calls `doorDaysTouched` and keeps its merged-prospect comment. Export `:1631` is untouched.
- `src/shared/schemas.ts:797-866` -- `adminVisitSchema` → `adminDoorDayVisitSchema` (`id, visitedAt, receivedAt, outcome, refusalReason, flyerGiven, followUpAt, notes, answerCount`) and `adminDoorDaySchema` (`key` = agent, prospect and day start joined by the server, `prospectId, prospectName, agentEmail, dayStart`, the latest visit's `visitedAt, outcome, refusalReason, notes, followUpAt`, `receivedAt` (max), `flyerGiven` (any), `visits` min 1). Response `{ doorDays ≤ ADMIN_VISITS_PAGE_SIZE, truncated, serverTime }`. Query schema unchanged, with its comment on `limit` and `reason` reworded.
- `src/client/admin/visits/feed.ts` -- `mergeDoorDays` keyed by `key` (an incoming row replaces a held one) with the same sort, `nextSince` over rows, and `arrivedKeys`: a new key, or a held key whose `receivedAt` grew.
- `src/client/admin/queries.ts:520-640` (`useVisitsFeed`) -- the door-day types; `capped` comes from the seed's `truncated`; the window trim reads the row's `receivedAt`.
- `src/client/admin/visits/VisitsLedger.tsx` -- the row becomes a disclosure button (aria per design.md :1079-1093, `ChevronDown` rotating, « {n} visites » muted and tabular when >1). The open key lives in the ledger and closes on a page change. The panel sits on `bg-secondary` with the overline, then one line per visit. Rows are keyed by `key`. Built on a new vendored `src/client/ui/collapsible.tsx` (shadcn's, on `radix-ui/collapsible`, which the `radix-ui` umbrella already ships, so there is no new dependency). The open key is controlled from the ledger, so at most one row is open.
- `src/client/admin/dashboard/RecentVisits.tsx` -- reads door-day rows, keyed by `key`. Its columns stay the same.
- `src/client/copy/admin.ts:673-725` -- new `lede`; add `visitCount(n)`, `history` (« Visites de la journée »), `openRow(name, outcome, n)`, `answers(n)` (0 and 1 singular, as `copy/field` `confirm.answers`).
- Tests: `src/worker/admin.test.ts` (feed cases → door-days, plus the matrix), `src/worker/export.test.ts` (adds a two-visit door-day → 2 CSV rows), `src/client/admin/visits/feed.test.ts`, `src/client/admin/VisitsScreen.test.tsx` (fixtures become door-days; add open/close, history order, one open at a time, an arrival adds a line to the open row), `DashboardScreen.test.tsx` and `AdminApp.test.tsx` mocks.
- Docs: `docs/api.md:53` (the row), `:118`, `:345-370` (The live feed: unit, whole door-day, spine, `reason`, `truncated`, Cost); `docs/design.md:990-992` (shipped note), `:435` (Dernières visites shows door-days); EXPERIENCE.md `:48`; `docs/free-tier-budget.md` (the feed's measured CPU).

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/schemas.ts` -- the door-day row and response -- the one wire home.
- [ ] `src/worker/door-days.ts`, `src/worker/routes/admin.ts` -- `doorDaysTouched` and the route -- R13.
- [ ] `src/worker/admin.test.ts`, `src/worker/export.test.ts` -- the matrix -- story verify.
- [ ] `src/client/admin/visits/feed.ts`, `queries.ts`, `VisitsLedger.tsx`, `RecentVisits.tsx`, `copy/admin.ts` -- the ledger -- R13.
- [ ] client tests listed above -- the disclosure and merge rules.
- [ ] docs listed above, then measure the feed's CPU on the seed -- R16, invariant 13.

**Acceptance Criteria:**
- Given the seed with a two-visit door, when Visites opens, then that door is one row with « 2 visites », and opening it lists both visits oldest first, while « Exporter en CSV » for the same window has two lines for it.
- Given any answer, then each `doorDays[i].visits` is non-empty and sorted, and its last visit's outcome equals the row's `outcome`.
- Given the largest statement, then it binds ≤100 parameters.

## Design Notes

The day key is computed in JS, not in SQL: the unscoped feed (Dernières visites) spans any number of clock changes, so `periodOffsets` does not apply. `json_each` keeps the sibling read at one statement for 500 door-days, where a chunked `IN` would need six.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: green.
- `pnpm check:precache` -- expected: unchanged, since the change is admin-only. Quote the total.
- Seeded local build: `pnpm db:seed:local`, add a second visit on one door, and check the ledger row, its history and the CSV.
