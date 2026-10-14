---
title: 'Admin sidebar recap card'
type: 'feature'
created: '2026-10-14'
status: 'in-review'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: []
review_loop_iteration: 0
baseline_commit: 'b40077f7362778244147ccc9b20582e1dd46cc5f'
context:
  - '{project-root}/_bmad-output/forge/admin-sync-status-meaning/forged-idea.md'
  - '{project-root}/_bmad-output/implementation-artifacts/mockup-admin-sidebar-recap-card.png'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The mockups (DESIGN.md:373) drew an admin sidebar footer with a "Synchronisé à l'instant" line. The shell (#63) shipped without it, and an admin has no sync to report, so that line would lie.

**Approach:** Add a small-font recap card at the bottom of the admin sidebar, on every admin page. It is headed with today's date, then shows « N / M agents actifs », « X visites » and the time since the last visit was received. It is fed by one new read-only admin route, polled every 15 s. The design is `mockup-admin-sidebar-recap-card.png` (variant B).

## Boundaries & Constraints

**Always:**
- The day is the Brussels day, midnight to midnight, as the server reads it. The card is headed « Mardi 14 octobre » (the overline style) and the lines don't repeat « aujourd'hui ».
- « Actif » means a roster member with a visit **received** that day, so N ≤ M. M is the active roster (`activeRoster`, admins included). « X visites » counts every visit received that day.
- The age is computed from the server's clock: `serverTime − lastReceivedAt`. The client clock is never used.
- The dot is `success` when N > 0 and `band-muted` when N = 0. The text carries the meaning.
- In the icon rail, the card is a 32px tile with the lucide `Info` icon (no dot), and the date and three lines in a Tooltip and in its accessible name. In the phone drawer it is the full card.
- Reads from `visits` use `visits_received_idx`. At most 2 statements, each with ≤ 100 bound parameters (INVARIANT 7).
- French strings live only in `src/client/copy/admin.ts`, with plural agreement. Colours come only from `@theme` tokens.
- `docs/design.md` (Layout) and `docs/api.md` change in the same commit as the code.

**Never:**
- No email, no avatar, no menu and no link on the card.
- No agent-side change, sync contract change, migration or new dependency.
- No amber or red verdict, and no working-hours rule.
- Never more than the date and three lines.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Working day | Roster of 2; Léa has 12 visits received today, the last one 4 min ago | « MARDI 14 OCTOBRE », « 1 / 2 agents actifs », « 12 visites », « Dernière visite reçue il y a 4 min »; green dot | — |
| Nothing today | No visit received since Brussels midnight | « 0 / 2 agents actifs », « Aucune visite », no third line; muted dot | — |
| Just now | Age < 60 s | « Dernière visite reçue à l'instant » | — |
| Hours | Age 3 h 10 | « … il y a 3 h » | — |
| Singular | M = 1, X = 1 | « 1 / 1 agent actif », « 1 visite » | — |
| Off-roster visitor | A deactivated user's visit today | Counted in X, not in N | — |
| Loading or failed | Query pending or error | No card: the sidebar ends after its nav | No toast, no retry button |
| Offline | `useOnline()` false | The last answer stays (the offline banner says the data is frozen) | — |

**Decisions (owner, 2026-10-14):** visits *received* today (1a); N counts roster members only (2a); green or muted dot (3a); variant B, with the date heading the card and no email or avatar; in the rail an `Info` icon replaces the dot.

</frozen-after-approval>

## Code Map

- `src/worker/routes/admin.ts:205-316` -- the dashboard. Reuse its `brusselsMidnightDaysFromNow(now, 0|1)` bounds and the `agentsToday` statement's shape. Do NOT add to `/dashboard` (its cold CPU is near 10 ms, free-tier-budget.md).
- `src/worker/auth.ts:47` `activeRoster(db)` -- M and the roster filter for N.
- `src/shared/period.ts:153` `periodDates(todayStart, 1)[0]` -- the Brussels ISO day for the response's `date`.
- `src/shared/schemas.ts:524` -- put the response schema next to `agentsResponseSchema` (zod/mini, `epochMsSchema`).
- `src/worker/dashboard.test.ts:1-80,976` -- harness to copy: `workerFetch`, `seedUser`, `resetTestUsers`, `insertVisit(prospect, visitedAt, receivedAt, …, agentEmail)`.
- `src/client/admin/queries.ts:71,477` -- `adminKeys` and `FEED_POLL_MS`. Set `refetchOnWindowFocus: true` as in `useVisitsFeed`; the background poll pauses by default.
- `src/client/format.ts:68` `formatDay(isoDate)` → « mardi 14 octobre »; `formatCount`.
- `src/client/ui/sidebar.tsx:183,327` -- mirror `SidebarHeader` as `SidebarFooter` (`data-slot="sidebar-footer"`, `border-t border-sidebar-border`) and export it.
- `src/client/admin/AdminSidebar.tsx` -- `rail` is already computed. Mount `<RecapCard rail={rail} />` in a `SidebarFooter` after `SidebarContent`.
- `src/client/ui/tooltip.tsx`; `SidebarMenuButton`'s `tooltip` usage in `AdminSidebar.tsx` is the precedent.
- `src/client/admin/AdminApp.test.tsx:52-60` -- the per-URL fetch stub must serve `/api/admin/recap`.
- `src/client/field/SyncIndicator.tsx:65` -- the dot classes (`size-2 rounded-full`, `bg-success` / `bg-band-muted`).

## Tasks & Acceptance

**Execution:**
- [ ] `docs/design.md` -- add the recap card to Layout (232-252): the lines, the rail and drawer, the cap, and no identity. This is the design gate (ADR-0014), so it comes first.
- [ ] `src/shared/schemas.ts` -- `recapResponseSchema` `{date, activeAgents, rosterSize, visitsToday, lastReceivedAt: epochMs|null, serverTime}` and the `RecapResponse` type.
- [ ] `src/worker/routes/admin.ts` -- `GET /recap`: the roster, plus one grouped read of the day's visits (`agent_email`, `count`, `max(received_at)`). N is the roster ∩ those emails. `Cache-Control: no-store`.
- [ ] `src/worker/recap.test.ts` -- the matrix's server rows: day bounds, N ≤ M, off-roster visitors, `null` when there are none, `date`, `serverTime`.
- [ ] `src/client/admin/recap.ts` (+ `.test.ts`) -- a pure `receivedAgo(ageMs)` returning now / minutes / hours.
- [ ] `src/client/copy/admin.ts` -- `recap.{agents(n,m), visits(x), none, receivedNow, receivedMinutes(n), receivedHours(n)}`.
- [ ] `src/client/admin/queries.ts` -- `adminKeys.recap()` and `useRecap()` at `FEED_POLL_MS`.
- [ ] `src/client/ui/sidebar.tsx` -- vendor `SidebarFooter`.
- [ ] `src/client/admin/RecapCard.tsx` (+ test) -- full and rail variants; no card while loading or on error.
- [ ] `src/client/admin/AdminSidebar.tsx`, `AdminApp.test.tsx` -- mount the card and stub the route.
- [ ] `docs/api.md`, `docs/free-tier-budget.md` -- the route row and its request cost (ADR-0010's 240 requests/hour per visible tab).

**Acceptance Criteria:**
- Given any admin page at ≥ 1024px, when the recap has loaded, then the sidebar ends with the card, and nothing on it is focusable or clickable.
- Given the rail (768–1023px), when hovering or focusing the `Info` tile, then a Tooltip shows the date and the three lines, and its accessible name reads them.
- Given a hidden tab, then `/api/admin/recap` is not requested. Given focus returns, then it is requested.
- Given `pnpm build`, then the card ships only in `AdminApp-*`, and the PR quotes the field precache total against 1,000 KiB.

## Design Notes

All three lines run on one clock, `received_at`: a visit made offline yesterday and synced this morning counts today, for its agent and in the total. N filters to the roster, unlike the dashboard's `agentsActiveToday`, so the fraction can't read « 3 / 2 ». The response carries `date`, so the client never has to work out which Brussels day it is.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: all pass.
- `pnpm build` -- expected: success; record the precache total.

**Manual checks:**
- `pnpm dev` at 1280, 820 and 390, light and dark, against the mockup.
