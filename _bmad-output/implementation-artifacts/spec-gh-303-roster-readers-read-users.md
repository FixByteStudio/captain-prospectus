---
title: 'Every roster reader reads users'
type: 'refactor'
created: '2026-10-08'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '1cb7c6d8388f97e107ea1d4085cfcf13bd6394f5'
context:
  - '{project-root}/docs/domains/identity-access.md'
  - '{project-root}/docs/adr/0029-own-login-instead-of-cloudflare-access.md'
  - '{project-root}/docs/adr/0028-agent-position-at-sync.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The roster still lives in two Worker vars. `GET /api/admin/agents`, one agent's round, the assignee check, the dashboard's agent rows and ADR-0028's position gate all read `ADMIN_EMAILS` / `AGENT_EMAILS`, so an admin who creates or deactivates a user on the Agents page (GH #302) changes nothing anyone can see, and changing the roster still needs a deploy.

**Approach:** Every one of those five readers decides from active `users` rows (`users.role`, `users.active`) instead. The wire shapes do not change, so no client change. The vars stay configured; after this story only `auth.ts`'s Access-JWT fallback reads `ADMIN_EMAILS`, and nothing reads `AGENT_EMAILS`.

## Boundaries & Constraints

**Always:** this changes who is on the *roster*, never who may sign in (INVARIANT 10). A deactivated user's prospects stay assigned, and unassigning (`assignedTo: null`) stays allowed for anyone. Both roles are assignable — in a two-person team an admin may walk a round. Compare emails lowercased, as `users.email` is stored. One extra roster read per request, folded into the handler's existing `Promise.all` where there is one (INVARIANT 13).

**Never:** no schema change and no migration. Do not touch the `ADMIN_EMAILS` / `AGENT_EMAILS` entries in `wrangler.jsonc` or `vitest.config.ts` (they go in epic-access-removed), do not touch `auth.ts`'s JWT fallback behaviour, do not change any response shape, and do not add the "prospects with no active agent" row (that is GH #304).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Assign menu | active admin + active agent + one deactivated user | `GET /api/admin/agents` lists the two active rows with their `users.role`, sorted by email | No error expected |
| Round | active agent with open assigned prospects | 200 with their prospects and last reading | deactivated or unknown email: 404 `not_found`, not 500 |
| Assign | `PATCH /prospects/:id` or `POST /prospects/assign` with an active user's email | assignment succeeds; `assignedTo: null` is always allowed | deactivated or unknown email: 400 `unknown_assignee`, prospect unchanged |
| Dashboard agent rows | active users, plus visits by a deactivated user in the period | one row per active user (zeros included); the deactivated user has no row, and their assigned prospects stay assigned | No error expected |
| Position at sync | signed-in agent with an active `users` row and `position` in the body | reading stored (ADR-0028); no row (Access-JWT fallback) or role `admin` stores none | A bad position never fails the sync |

</frozen-after-approval>

## Code Map

- `src/worker/auth.ts` -- keep `roleFor` / `parseEmails` (the JWT fallback needs them) and `identityFromAccess` unchanged. Home for the two new roster readers: it already owns `getDb` + `users` queries and the role rules.
- `src/worker/routes/admin.ts` -- `assignableEmails` (~183) and `unknownAssignee` (~221), read by `GET /agents` (~187), `GET /agents/:email/round` (~199), `patch /prospects/:id` (~967), `post /prospects/assign` (~1007) and the dashboard (~382). Also `agentRows` (~400). The `roleFor` import (line 99) goes unused once `GET /agents` reads the row's role.
- `src/worker/routes/agent.ts` -- the ADR-0028 gate at ~292 (`parseEmails(c.env.AGENT_EMAILS).includes(email)`); its `parseEmails` import (line 25) goes unused.
- `src/worker/routes/identity.ts` -- GH #302's users routes; `userRows` is the house style for a `users` query. Do not change.
- `src/shared/schemas.ts` (~450) and `src/worker/types.ts` (~17-23) -- the two comments claiming there is no users table.
- `test/users.ts` -- `seedTestUsers` / `TEST_ADMIN` / `TEST_AGENT`; `test/setup-worker.ts` already seeds both active for every worker test.
- `src/worker/admin.test.ts` -- agents list (~75), round suite (~1481), assignee cases (~813, ~828). `src/worker/dashboard.test.ts` -- "Activité par agent" (~653) asserts today that an **off-roster** email with activity gets a row; that inverts. `src/worker/sync.test.ts` -- position-gate cases.
- `docs/api.md` (~224, ~357) and `docs/domains/identity-access.md` (~24) -- the roster descriptions and "until GH #303" caveats.

## Tasks & Acceptance

**Execution:**
- [ ] `src/worker/auth.ts` -- add two exported readers over `users`: the active roster (email + role, ordered by email) and a single-email active lookup; comment them against ADR-0029 -- one definition of "on the roster", reused by both route files.
- [ ] `src/worker/routes/admin.ts` -- make `assignableEmails` / `unknownAssignee` use those readers (now async) and update the four call sites; `GET /agents` returns each row's own `role`; drop the now-unused `roleFor` import; rewrite the two ADR-0006 comments.
- [ ] `src/worker/routes/admin.ts` -- in the dashboard, pass the active roster to `agentRows` and make it emit rows for roster emails only, so a deactivated user's visits no longer conjure a row; keep the `visits` desc, then `email` sort. Add the roster read to the existing `Promise.all`.
- [ ] `src/worker/routes/agent.ts` -- gate the ADR-0028 position write on `role === "agent"` plus an active `users` row; drop the `parseEmails` import.
- [ ] `src/worker/types.ts`, `src/shared/schemas.ts` -- correct the two comments that say there is no users table; `AGENT_EMAILS` is now read by nothing.
- [ ] `test/users.ts` -- add a helper that inserts one user with a given role and active flag (upsert, so it is safe beside `seedTestUsers`).
- [ ] `src/worker/admin.test.ts`, `src/worker/dashboard.test.ts`, `src/worker/sync.test.ts` -- cover every I/O matrix row, including the inverted dashboard expectation and a deactivated agent whose prospects stay assigned.
- [ ] `docs/api.md`, `docs/domains/identity-access.md` -- describe the roster as active `users` rows and delete the "until GH #303" caveats.

**Acceptance Criteria:**
- Given a newly created active agent, when an admin reads the assign menu, assigns them a prospect, opens their round and the agent syncs a position, then all four succeed.
- Given that agent is then deactivated, when the same four are tried, then they are absent from the menu and from the dashboard's agent rows, a new assignment gets 400 `unknown_assignee`, their round gets 404, and the prospects already assigned to them are still assigned to them.
- Given the finished change, when `grep -rn "ADMIN_EMAILS\|AGENT_EMAILS" src/` runs, then every hit is in `src/worker/auth.ts`'s Access-JWT fallback, in `src/worker/types.ts`, or in a test name or comment describing that fallback.

## Implementation Notes

- Readers `activeRoster` / `activeRosterMember` in `src/worker/auth.ts`; test helper `seedUser(email, role, active)` in `test/users.ts` (upsert).
- `GET /agents` gains a D1 read it did not have; the round's membership check runs before its `Promise.all`, since a 404 should skip the round reads.
- `docs/api.md` also said the dashboard's `visits` column always sums to `visits.value`; no longer true once a deactivated user's row is dropped, so corrected.
- The Access-JWT no-row position case is tested through `test/access-jwt.ts` (`fakeAccess`), with a with-row control in the same test; a mutation removing the gate fails it.
- Verified: typecheck, lint, 2,309 tests, build (precache 938.19 KiB / 1,000 KiB).

## Spec Change Log

## Review Triage Log

**Pass 1** (blind-hunter, edge-case-hunter, verification-gap, intent-alignment) — high 0 · medium 5 · low 4 · false 8 · maybe-false 0. No intent_gap or bad_spec; patches and defers only.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|------|---------|---------|-------|-------------------|
| 1 | verification-gap | PATCH accepting an active users-only email is untested | medium | patch | Pre-verified; add a 200 PATCH while GONE is active. |
| 2 | verification-gap | `users` rows seeded by new tests leak into later tests | medium | patch | Reproduced: `--sequence.shuffle --sequence.seed=3` fails "lists the admins and the agents". Reset extra users per test. |
| 3 | blind, edge | `docs/api.md` says only a *deactivated* user's visits fall out of the column; any off-roster visitor does, and the `converted` / open-prospect paragraphs miss the same cause | medium | patch | `agentRows` drops every non-roster email. Reword to "off the roster" in all three places. |
| 4 | edge | Deleted still-true doc: an Access user with no row is not in `GET /api/admin/users` and is off the roster until POSTed | low | patch | Sentence was about `/users`, still accurate; restore it adapted. |
| 5 | blind | `wrangler.jsonc:51-53`, `.dev.vars.example:10-17`, `docs/design.md:377` still describe the vars as the roster / "no users table" | low | patch | Comments now contradict the code; values untouched. |
| 6 | blind | Position gate re-queries `users` though session/dev identities already imply an active row | low | patch (comment only) | Extra PK lookup is negligible; comment why it re-checks (Access fallback). |
| 7 | blind | Dashboard test does not show the deactivated user's prospect still counts in `openProspects` | low | patch | One assertion. |
| 8 | intent | Client `useAgents` keeps `staleTime: Infinity` under a now-false comment; an open tab keeps the old roster | medium | defer | Real, but the frozen intent says no client change. Agents page (entry 7) must invalidate `adminKeys.agents()` on user mutations. |
| 9 | edge | Prospects assignee filter is built from `/agents`, so a deactivated assignee cannot be picked | medium | defer | `Toolbar.tsx:114` via `ProspectsScreen.tsx:133`. Story decision: they leave the menu; entry 11 lists their prospects. |
| 10 | edge, blind | Rowless Access users fall off the roster; no backfill or operator warning | false | reject | Intent's reading A; story Notes put user creation in entry 18 before anyone assigns. |
| 11 | edge | Deactivation between roster check and UPDATE assigns to an inactive user | low | reject | Needs a sub-millisecond race between two admins; fix adds a correlated subquery to two UPDATEs. |
| 12 | edge | PATCH resending the current deactivated assignee is refused | false | reject | The client's only PATCH sends `{status}` (`ProspectsScreen.tsx:240`); refusing an explicit reassignment is the matrix row. |
| 13 | blind | `agentsActiveToday` counts off-roster visitors | false | reject | Counts distinct senders of visits received today, by definition; someone deactivated today was active today. |
| 14 | blind | Roster readers belong in a `roster.ts`, not `auth.ts` | false | reject | Spec's Code Map chose `auth.ts`; fix would edit the spec. |
| 15 | blind | `seedUser` does not lowercase emails | low | reject | Test helper, every caller passes lowercase literals. |
| 16 | blind | Tests seed users directly rather than through `/api/admin/users` | low | reject | `/users` lifecycle is covered by `users.test.ts`; the roster readers only read rows. |
| 17 | blind | No test that a deactivated agent's position is not stored | false | reject | Unreachable: an inactive row gets 401 on every identity path before the handler. |
| 18 | blind | Grep AC unmet / `parseEmails` still exported | false | reject | Grep run: hits only `auth.ts` fallback, `types.ts`, test names; `roleFor` uses `parseEmails`. |
| 19 | blind | `beforeEach` seeding OTHER silently changes earlier expectations | low | reject | Comment already states it; expectations updated in the same diff. |
| 20 | edge | "No client change" claim hides the filter regression | false | reject | Same root as #9, routed there. |
| 21 | intent | Tests live on the HTTP surface, not the (unbuilt) Agents page | false | reject | Agents page is entry 7; intent scopes the Worker readers. |

## Design Notes

`agentRows` keeps its "seed from the roster, then fold in the query rows" shape; only the fold changes, from "add any email seen" to "ignore an email off the roster". That is what makes a deactivated user leave the table while their visits stay in the totals.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: clean (catches the four `assignableEmails` call sites turning async)
- `pnpm test` -- expected: all projects green
- `pnpm lint` -- expected: clean, no unused `roleFor` / `parseEmails` import
- `pnpm build` -- expected: succeeds; quote the precache total against the 1,000 KiB ceiling (no client change, so it should not move)
- `grep -rn "ADMIN_EMAILS\|AGENT_EMAILS" src/` -- expected: only `auth.ts`'s fallback, `types.ts`, and test names/comments about that fallback
