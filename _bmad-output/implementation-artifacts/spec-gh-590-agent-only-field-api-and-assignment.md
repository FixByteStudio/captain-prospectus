---
title: 'Agent-only field API and assignment'
type: 'feature'
created: '2026-10-20'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '5c68aae947056ca97f32299f716e78cf32e497b2'
context:
  - '{project-root}/docs/adr/0037-admins-leave-the-field-side.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-579-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/api/agent/*` only checks for an identity, so an admin can sync, read any prospect's visits and walk a tournée whose position is never stored; and the roster (`activeRoster`) includes admins, so a prospect can be assigned to an admin (GH #590, epic #579, R2–R4, server part of R5, ADR-0037).

**Approach:** Add `requireAgent` beside `requireAdmin` and mount it on `/agent/*`; drop `agent.ts`'s two admin exceptions; narrow the roster to active **agents**, so `/api/admin/agents`, the PATCH and bulk-assign assignee check, the round view, the recap, the dashboard rows and the « sans agent actif » filter all mean "active agent". Update the tests and docs to match.

## Boundaries & Constraints

**Always:** 403 body shaped like `requireAdmin`'s (`{error: "forbidden", message}`). No sync contract change: request/response shapes, `CLIENT_VERSION` and `MIN_CLIENT_VERSION` untouched (ADR-0037). The dev identity (`DEV_USER_EMAIL`) still resolves any active user, admin included — only the roster narrows. Assigning `null` stays allowed.

**Never:** No client change (stories 3–4 remove the admin field side). No change to `/api/me`, `/api/auth/*`, `/api/admin/users`, import schemas (they carry no `assignedTo`), the dev seed routes or scripts. No schema migration.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Agent syncs | agent session, `POST /api/agent/sync` | 200 as today, position stored | — |
| Admin syncs | admin session or dev admin | 403 `forbidden`, nothing written | — |
| Admin reads visits | admin, `GET /api/agent/prospects/:id/visits` | 403 | — |
| Agent reads visits not theirs | agent, prospect assigned to another | 403 (unchanged) | — |
| Assign to admin | PATCH or bulk assign `assignedTo: <active admin>` | refused exactly like an unknown email today | — |
| Assign to agent / null | active agent email, or `null` | accepted as today | — |
| Roster | `GET /api/admin/agents` | active agents only | — |
| Round of an admin | `GET /api/admin/agents/<admin>/round` | 404, like a non-assignable email | — |
| Prospect assigned to an admin | existing row, `inactiveAgent=true` / dashboard | counted « sans agent actif » | — |

</frozen-after-approval>

## Code Map

- `src/worker/auth.ts:47-67` -- `activeRoster` / `activeRosterMember`: add `role = 'agent'`; update their doc comment. `identityFromDevUser` (:141) uses `activeRosterMember` for the dev identity — give it its own active-user lookup so dev admins still work.
- `src/worker/auth.ts:181` -- `requireAdmin`; add `requireAgent` beside it (message e.g. "This page is for agents.").
- `src/worker/index.ts:94-95` -- mount `app.use("/agent/*", requireAgent)` before `app.route("/agent", ...)`.
- `src/worker/routes/agent.ts:67,281-293` -- drop `role` and the `role === "agent"` position gate (comment too); `:337,342` -- drop the admin bypass; update the route comment.
- `src/worker/routes/admin.ts:160-168` -- `/agents` comment ("Admins are included…") → agents only. `:203-213` `unknownAssignee` comment → active agent. `:766-777` `NO_ACTIVE_AGENT` -- add `and ${users.role} = 'agent'` and reword. Recap (:227) and dashboard (:394) need no code change; they inherit the narrowed roster.
- `src/shared/schemas.ts:524` -- `agentsResponseSchema` comment → "active agents". Keep the `role` field (no wire change; story 7 may drop it).
- `src/worker/sync.test.ts:44` -- the suite runs as `admin@example.com` (DEV_USER_EMAIL in `vitest.config.ts:57`). Make it run as `TEST_AGENT`, set in `beforeEach` and restored after; tests needing a second agent (`OTHER`, `AGENT_ONLY` at :1100, :1370) seed another agent with `seedUser`. Replace "stores nothing for an admin" (:1413, :1491) and "gives an admin their own tournée" (:2089) with 403 tests.
- `src/worker/admin.test.ts:96-160,660` -- roster, assign and round-view tests; `:660` assigns to `ADMIN` — switch to an agent.
- `src/worker/origin.test.ts`, `src/worker/security-headers.test.ts` -- hit `/api/agent/*`; make sure they still assert what they meant (run as an agent where a 403 would mask it).
- `src/worker/recap.test.ts`, `dashboard.test.ts`, `users.test.ts`, `orphans.test.ts`, `export.test.ts`, `door-days.test.ts` -- may count admins in the roster or assign to an admin; fix only what the narrowing breaks.
- `docs/api.md:26-27,33-34,42,46,248-260,273,290-294,317` -- `/api/agent/*` agents only (403 for an admin); roster = active agents; round view's "An admin's email answers 200" → 404; `rosterSize` "admins included" → agents; `inactiveAgent` includes an admin assignee.
- `docs/domains/identity-access.md:20-22` -- roster = active agents; add one line: `/api/agent/*` answers 403 to an admin (`requireAgent`, ADR-0037).
- `docs/domains/field-operations.md:195` -- drop "an admin syncing from the field gets their own tournée like an agent".

## Tasks & Acceptance

**Execution:**
- [ ] `src/worker/auth.ts` -- narrow roster helpers to agents; dev identity keeps its own lookup; add `requireAgent`.
- [ ] `src/worker/index.ts` -- mount `requireAgent` on `/agent/*`.
- [ ] `src/worker/routes/agent.ts` -- remove both admin exceptions.
- [ ] `src/worker/routes/admin.ts`, `src/shared/schemas.ts` -- comments; `NO_ACTIVE_AGENT` role check.
- [ ] `src/worker/*.test.ts` -- run field tests as an agent; add the matrix's cases (admin 403 on sync and visits; assign to admin refused on PATCH and bulk; roster excludes admins; admin round 404; admin-assigned prospect counts as inactive).
- [ ] `docs/api.md`, `docs/domains/identity-access.md`, `docs/domains/field-operations.md` -- as in the Code Map.

**Acceptance Criteria:**
- Given an admin session, when it posts `/api/agent/sync`, then it gets 403 and no visit, prospect, tournée or position is written.
- Given an active admin, when an admin assigns a prospect to them by PATCH or bulk assign, then the request is refused and the prospect is unchanged; the same call with an active agent passes.
- Given the repo, when grepping `role !== "admin"` and `role === "agent"` in `src/worker/routes/agent.ts`, then nothing is found.

## Implementation Notes

- Implemented by an api-engineer subagent (sonnet). `sync.test.ts` now runs as `TEST_AGENT` with a second agent `other-agent@example.com`; admin cases switch `DEV_USER_EMAIL` per test.
- Added after the diff read: `agentsStartedOn` (`src/worker/tournee.ts`) also filters `role = 'agent'`, since docs/api.md now defines « Agents en tournée » over active agents; without it an admin's tournée of release day could read "2 / 1" on the recap. Pinned by a recap test.
- Typecheck, lint, 3073 tests and build pass; precache 943.61 KiB (no client change).

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; all sonnet per owner): high 0, medium 0, low 2, false 9, maybe-false 0. No patch, no loopback.

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| PATCH re-sending an admin's unchanged `assignedTo` gets 400 (blind, edge) | false | reject | The client never puts `assignedTo` in a PATCH; assignment goes through bulk assign only (`src/client/admin/queries.ts:336`). A deactivated assignee already behaved this way. |
| Bulk assign can't leave admin-assigned rows as they are (edge) | false | reject | Reassigning to an agent or `null` is the intended remedy; « sans agent actif » lists them. |
| Prospects already on an admin are stranded (blind) | false | reject | They count in « sans agent actif » (`NO_ACTIVE_AGENT`, tested) and are reassigned from that filter; the HITL release step covers outboxes. |
| Agent→admin role PATCH strands prospects and outbox (edge, `identity.ts:155`) | low | defer | Real until fixed roles ship; owned by the cut story « roles are fixed at creation » (epic #579). |
| `scripts/seed.mjs:17` seeds prospects on the dev admin (edge) | low | defer | Local only; found-in-passing issue. |
| Dev-seed doc "unlike sync, it does not refuse an admin's email" stale (blind, edge) | false | reject | Still true: sync refuses an admin, the seed does not. |
| Dashboard rows vs totals with admin history (blind) | false | reject | docs/api.md already defines off-roster senders as in totals, in no row. |
| Mixed-case `assigned_to` in `NO_ACTIVE_AGENT` (edge) | false | reject | Pre-existing; assignee emails are lowercased by `emailSchema` on write. |
| Agent loses visits read after reassignment (edge) | false | reject | Unchanged pre-existing rule (assigned agent only). |
| Admin 403 tested via dev identity only; no session-cookie case; 401-before-403 untested (blind, intent, verif) | false | reject | `requireAgent` reads `identity.role` set identically by both paths; 401 ordering is `requireIdentity`'s, mounted first and covered by existing auth tests. |
| Test env switching hand-rolled; stale `agentsStartedOn`/visits comments; glossary/data-model untouched (blind) | false | reject | Comments still accurate; no schema or glossary term changed; switching mirrors existing test style. |

## Design Notes

Narrowing the two roster helpers, not each caller, keeps "who may be assigned" one definition (identity-access.md). The dev identity was the one caller that means "any active user", so it moves off the roster helper rather than the helpers growing a role flag.

`/api/me` stays outside `requireAgent`: the client reads the role from it.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm test` -- expected: all pass
- `pnpm lint` -- expected: clean
- `pnpm build` -- expected: succeeds
- `grep -n 'role !== "admin"\|role === "agent"' src/worker/routes/agent.ts` -- expected: no output
