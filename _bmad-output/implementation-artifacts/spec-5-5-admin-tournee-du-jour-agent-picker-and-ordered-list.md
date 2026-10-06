---
title: 'Admin Tournée du jour: agent picker and ordered list'
type: 'feature'
created: '2026-10-06'
status: 'done'
baseline_commit: '828a8b69343dfa8fcd49914c11a905bddfd7bf48'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-dashboard-redesign/epic-admin-round-view/story-admin-tourn-e-du-jour-agent-picker-and-ordered-list.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The admin cannot see where an agent's round stands without phoning them; the position-at-sync endpoint (5.2) and the shared today rule (5.4) exist but no screen uses them. Story #268, CAP-4 / CAP-11, EXPERIENCE.md Flow 3.

**Approach:** Add `/admin/tournee` as the last item of the Terrain nav group: an agent Select fed by `GET /api/admin/agents`, then a read-only list of that agent's stops for today built from `GET /api/admin/agents/:email/round` through `buildTodayList(prospects, [], position, now)` — its `now` group only, in the rule's order (no second sort), with "{n} arrêts", "Position du {date heure}" and distances. With `position: null`, the same `now` stops sorted by name, no distances, and the notice "Aucune position reçue aujourd'hui. La tournée est triée par nom." The map pane is story 5.6.

## Boundaries & Constraints

**Always:** French strings in `src/client/copy/admin.ts` (nav label in `copy/shared.ts` beside the others); TanStack Query for the round fetch (admin side, ADR-0013); compose from `src/client/ui/` shadcn elements and the admin primitives (`ScreenHeader`, `ScreenState`, `Surface`); Tailwind tokens only; reuse `StopNumber` and `edgeFor` from the field and `STATUS_BADGE`/`BADGE_SHAPE` from `admin/status.ts`.

**Never:** no Plus tard group; no Visiter, Y aller, swipe, expand or link on a row; no reordering of the rule's output when a position exists; no change to `src/shared/today.ts`, the field `StopRow`, the endpoint or its schema; no map (5.6); no polling.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Position today | round with stops + `position` | rows in `buildTodayList(...).now` order, numbered 1…n, distance per coordinated stop; header "{n} arrêts"; "Position du {formatDateTime(capturedAt)}" beside the Select | — |
| No position | `position: null` | same `now` stops sorted by name (fr collation), no distance on any row, the no-position notice | — |
| Future follow-up | a `follow_up` with `nextVisitAt` after today | not on the list, not counted | — |
| Stop without coordinates, position known | `lat`/`lng` null | listed last per the rule, no distance shown | — |
| No agent chosen | first visit to `/admin/tournee` | Select placeholder and a prompt to choose an agent; no round fetch | — |
| Empty round | `prospects: []` | "0 arrêt"-style count and an empty message | — |
| Fetch fails / loading | round query error or pending | `ScreenState` skeleton, then its load-failed alert with retry | retry refetches |

</frozen-after-approval>

## Code Map

- `src/shared/today.ts` -- `buildTodayList(prospects, outbox, from, now, queued)`; admin passes `[]`, `position` (as `Point`) or `null`, `Date.now()`. Read-only here.
- `src/shared/schemas.ts:439` -- `AgentRoundResponse {prospects: Prospect[], position: AgentPosition | null}`; `AgentsResponse`.
- `src/client/admin/queries.ts` -- `adminKeys`, `useAgents()` (staleTime Infinity); add `agentRound(email)` key + `useAgentRound(email | null)` (`enabled` only with an email; `encodeURIComponent` the email in the path).
- `src/client/admin/nav.ts` -- `NAV_GROUPS`; Terrain gets `{ label: copy.nav.round, path: "/admin/tournee", icon: Route }` last; drop the "stays out until its screen ships" comment line; doc comment says eight routes.
- `src/client/admin/nav.test.ts` -- `ADMIN_APP_ROUTES` and the group-order test gain `/admin/tournee`.
- `src/client/admin/AdminApp.tsx` -- add `<Route path="tournee" element={<RoundScreen />} />`.
- `src/client/field/StopNumber.tsx`, `src/client/field/StopRow.tsx` (`edgeFor`) -- reuse; do not edit.
- `src/client/admin/status.ts` -- `STATUS_BADGE`, `BADGE_SHAPE`; `STATUS_LABELS` from copy.
- `src/client/format.ts` -- `formatDateTime` (gives "24/09/2026 15:24"), `formatDistance`.
- `src/client/copy/field.ts:62` -- `copy.today.meta(type, address)` for "type · address" (via the `copy` aggregator).
- `src/client/admin/OrphansScreen.tsx` + `OrphansScreen.test.tsx` -- template for a `ScreenHeader`/`ScreenState`/`Surface` screen and its fetch-mocked DOM test; `ProspectsScreen.test.tsx:50` mocks `/api/admin/agents`.
- `src/client/admin/prospects/Toolbar.tsx:163` -- shadcn `Select` usage to copy.
- `docs/design.md` -- add `### The admin round view` after "The repair queue" (before `## Principles`).

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/copy/shared.ts`, `src/client/copy/admin.ts` -- nav label "Tournée du jour"; `round` block: title, count(n) ("1 arrêt"/"{n} arrêts"), agent label, choose placeholder, choose prompt, position(date) "Position du {date}", noPosition notice, empty, loadFailed, loading.
- [ ] `src/client/admin/queries.ts` -- `adminKeys.agentRound`, `useAgentRound`.
- [ ] `src/client/admin/round/round-list.ts` -- pure `roundStops(data, now): TodayItem[]`: `buildTodayList(...).now`, or with no position the same sorted by name with `localeCompare(…, "fr")`.
- [ ] `src/client/admin/round/RoundScreen.tsx` -- header (title + count, agent Select with position age in meta), notice, `Surface` of read-only `<li>` rows: `StopNumber`, name, meta line, status badge, distance (only when `distanceM !== null`), `edgeFor` leading edge. Agent kept in `?agent=` search param.
- [ ] `src/client/admin/AdminApp.tsx`, `src/client/admin/nav.ts`, `src/client/admin/nav.test.ts` -- route and nav entry.
- [ ] `src/client/admin/round/round-list.test.ts` -- rule order with a position, name order without, future follow-up excluded.
- [ ] `src/client/admin/round/RoundScreen.test.tsx` -- DOM: with position (order, "{n} arrêts", position age, distances); without (name order, notice, no distance text); no `Visiter`/`Y aller` text or links on any row; no fetch before an agent is chosen.
- [ ] `docs/design.md` -- the admin round view section (ASCII sketch, read-only rule, no-position state, map pending 5.6).

**Acceptance Criteria:**
- Given an agent with a position from today, when the admin picks them, then rows follow `buildTodayList(...).now` exactly, the header counts them, and the position's age shows beside the Select.
- Given an agent with no position, when picked, then rows are in name order with no distances and the notice shows.
- Given any row, then it has no Visiter or Y aller control and no link.
- Given the admin sidebar, then Terrain lists Visites, À rattacher, Scripts, Tournée du jour, and the breadcrumb on `/admin/tournee` reads Terrain › Tournée du jour.

## Implementation Notes

- Implemented by a subagent; `roundStops` in `src/client/admin/round/round-list.ts`, screen in `RoundScreen.tsx`, rows are an admin-local `RoundRow`.
- The rule's `now` is `round.dataUpdatedAt`, not `Date.now()`: `react-hooks/purity` rejects an impure call in render, and the fetch time is the moment the data describes.
- After the hand-back: the agent label uses the vendored `Label`; `count(0)` reads "0 arrêt"; a `?agent=` link shows the skeleton while the roster loads instead of the choose prompt; a fetch-failure test covers the matrix's last row.
- After review pass 1: roster-failure alert, notice only over stops, design bullet scoped, six tests added. Precache **933.64 KiB of 1,000 KiB** (`pnpm check:precache`); 2171 tests pass.

## Spec Change Log

## Review Triage Log

Pass 1 (2026-10-06, thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment): high 0, medium 2, low 5, false 6, maybe-false 0. Five patches, one deferral, the rest rejected.

- medium, patch (blind, edge, vgap-other): a failed `GET /agents` shows the choose prompt over an empty Select with no error or retry — `agents.isError` now shows the load-failed alert with a roster retry.
- medium, patch (vgap ×4, intent §3): choosing from the Select, an unknown `?agent=`, route registration in AdminApp and the row's status badge had no test — tests added in `RoundScreen.test.tsx` and `AdminApp.test.tsx`.
- low, patch (blind): the no-position notice rendered above an empty round — shown only when there are stops.
- low, patch (blind, edge): design.md's "stop without coordinates is listed last" was unscoped, but the no-position list is by name — scoped to "with a position".
- low, defer (blind): `docs/glossary.md` uses "admin round view" in the Agent position row but has no row of its own; a glossary-only change, logged in deferred-work.md.
- low, reject (blind, edge): the name sort mixes kept-for-today and uncoordinated stops back in — the frozen intent says "the same `now` stops sorted by name".
- low, reject (blind, edge): no refresh, and a tab left open past Brussels midnight keeps yesterday's day — the spec rules out polling; a reload fixes it, and a midnight timer adds a branch for a rare case.
- false (blind, intent §3.5): admins in the Select always read "no position" — docs/api.md:25 says an admin's round answers `position: null` because admins' positions are never stored, so the notice is true and the stops are their real round.
- false (blind): importing `edgeFor` from `field/StopRow` drags the field graph into the admin chunk — the admin chunk is outside the precache (933.64 KiB, unchanged in shape) and the Code Map sanctions the reuse.
- false (blind): lucide `Route` unaliased in nav.ts — nav.ts imports nothing from react-router, so there is no collision.
- false (blind): the `stop.status &&` guard hides a contract break — `TodayItem.status` is nullable by type (outbox rows); the guard is what the type requires, and the server schema already enforces a status.
- false (edge): "0 arrêt" differs from "{n} arrêts" — French agreement keeps 0 singular; the spec's "{n} arrêts" names the plural form.
- false (intent R2): Flow 3's tomorrow follow-ups are absent — the frozen intent and the epic decision of 2026-10-05 exclude Plus tard.

## Design Notes

- No agent is preselected: the screen asks the admin to choose, and the choice lives in `?agent=` so a reload or a shared link keeps it. An `agent` param not in the roster is ignored (placeholder shown).
- Rows are a small admin-local component, not the field `StopRow`: that one owns swipes, expand state and the two actions, all forbidden here. Sharing `StopNumber` and `edgeFor` keeps the look identical.
- The position's age uses `formatDateTime` like every other admin timestamp.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:precache` -- expected: all green; quote the precache total against 1,000 KiB (the admin chunk must not enter it).
