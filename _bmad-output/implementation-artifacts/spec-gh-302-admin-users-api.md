---
title: 'Admins manage users through the API'
type: 'feature'
created: '2026-10-07'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 1
baseline_commit: '236f6a04425a175ad92025b04e8ec65254834235'
context:
  - '{project-root}/_bmad-output/specs/spec-own-login/auth-data.md'
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Who may sign in, and as what, still lives in the `ADMIN_EMAILS`/`AGENT_EMAILS` vars, so adding or removing an agent needs a deploy, and a deactivated user holding an Access cookie keeps working (GH #302, CAP-1).

**Approach:** A new identity route module mounted under `/api/admin` lists, creates, re-roles, deactivates and reactivates `users` rows, with the contracts in `src/shared/schemas.ts`. The Access JWT fallback in `auth.ts` refuses an email whose `users` row is inactive.

## Boundaries & Constraints

**Always:**
- Routes are admin-only (behind `requireAdmin`) and non-GET ones pass the existing Origin middleware; no route exemption.
- List row: `email`, `name`, `role`, `active`, `sessions` (count of rows with `expires_at > now`), `openProspects` (prospects with `assigned_to = email`, status in `OPEN_STATUSES`, `merged_into IS NULL`). Every user, active and not, ordered by name then email.
- Create: `email` (trimmed, lowercased by `emailSchema`), `name` (required, trimmed, non-empty), `role` → **201** with the list row; an existing email, active or not → **409** `email_taken`. Inserted active with no passphrase.
- Change role / deactivate / reactivate: unknown email → **404**. A change that leaves no active admin → **409** `last_admin`, decided in the same statement as the write so two admins acting at once cannot both pass.
- Deactivation deletes the user's sessions in the same D1 batch. Deactivating your own row is allowed when another admin is active; your session goes with the rest. Reactivation leaves the user with no session.
- Access JWT fallback: a verified email whose `users` row exists and is inactive → 401; active → the row's role; no row → `roleFor(ADMIN_EMAILS)`.
- Decision (2026-10-07, owner): the routes are `GET /api/admin/users`, `POST /api/admin/users` and `PATCH /api/admin/users/:email`; `GET /api/admin/agents` stays the assign menu's.
- Decision (2026-10-07, owner): on the Access fallback an active row's `role` wins; `ADMIN_EMAILS` decides only for an email with no row.
- `docs/api.md` and `docs/data-model.md` change in this PR.

**Never:** no user is deleted; no login codes (entry 8), passphrases (9) or session list/revoke (10); no Agents page or client change (entry 7); no change to `GET /api/admin/agents`, `assignableEmails` or the position gate (entry 6); no migration; no new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Create | admin POSTs `{email: " Lea@X.be ", name: "Léa", role: "agent"}` | 201; next GET lists `lea@x.be`, active, `sessions: 0` |
| Duplicate | same email again (or a deactivated one) | 409 `email_taken` |
| Bad body | empty name, bad email, unknown role | 400 `validation` |
| Role change | agent → admin | 204; their next request has role admin (session and Access JWT alike) |
| Deactivate | agent with 2 sessions | 204; sessions gone; next request with old cookie → 401 |
| Deactivated + JWT | inactive row, valid Access JWT | 401 |
| No row + JWT | valid JWT, email not in `users` | role from `ADMIN_EMAILS`, as today |
| Reactivate | inactive user | 204; listed active, `sessions: 0` |
| Last admin | only active admin demoted or deactivated (own row or another's) | 409 `last_admin`; nothing written |
| Self, other admin active | admin deactivates own row | 204; own next request → 401 |
| Open count | prospects new/assigned/follow_up/interested/converted/rejected + one merged open | `openProspects` counts the 3 unmerged open ones |
| Agent caller | agent session on any of the routes | 403 |
| Foreign Origin | admin POST/PATCH without the app's Origin | 403 `forbidden_origin` |
| Unknown | PATCH for an email with no row | 404 |

</frozen-after-approval>

## Code Map

- `src/shared/schemas.ts` -- next to `agentsResponseSchema` (~l.452): `userSchema` (list row), `usersResponseSchema` `{users}`, `userCreateSchema` (`email: emailSchema`, `name: shortTextRequired`, `role: roleSchema`), `userUpdateSchema` (`role?`, `active?`, refined to at least one). `zod/mini` only. Reuse `emailSchema`, `roleSchema`, `shortTextRequired`, `countSchema`; `agentEmailParamSchema` for `:email`.
- `src/worker/routes/identity.ts` (new) -- `identityRoutes`: `GET /users`, `POST /users`, `PATCH /users/:email`. Entries 8–10 add their routes here.
- `src/worker/index.ts` -- `app.route("/admin", identityRoutes)` next to the existing admin mount, after `app.use("/admin/*", requireAdmin)`.
- `src/worker/auth.ts` `identityFromAccess` -- after verifying, read the email's `users` row: inactive → `unauthorized(...)`; active → its `role`; none → `roleFor`. Update the header comment.
- `src/worker/db/schema.ts` -- `users`, `sessions`, `prospects` (no change). `OPEN_STATUSES` in `src/shared/constants.ts`.
- Tests: `src/worker/users.test.ts` (new) using `workerFetch` (`test/worker-fetch.ts`), `testSessionCookie` (`test/session.ts`), `seedTestUsers`/`TEST_ADMIN` (`test/users.ts`); the Access JWT stub in `test/access-jwt.ts` for the fallback rows. Follow `origin.test.ts`/`auth.test.ts` for setup and table cleanup.
- List order: `name IS NULL`, then `name COLLATE NOCASE`, then `email`, so the unnamed break-glass row sorts last and case does not split names.
- Docs: `docs/api.md` (Admin table rows, status codes 409, error codes; in § Who can be assigned, replace "There is no users table (ADR-0006)" with a pointer to `/api/admin/users`, saying the assign menu still reads the vars until GH #303), `docs/data-model.md` (Rules: deactivation deletes sessions, last active admin), `docs/domains/identity-access.md` (step 3 refuses an inactive row; who may sign in is managed through the API, without claiming the assign menu or position gate follow `users` yet, GH #303).

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/schemas.ts` -- the four contracts -- one wire contract for both sides.
- [ ] `src/worker/routes/identity.ts`, `src/worker/index.ts` -- the three routes and the mount -- CAP-1.
- [ ] `src/worker/auth.ts` -- inactive-row refusal and row role on the JWT fallback -- epic Done when 2.
- [ ] `src/worker/users.test.ts` -- every matrix row; plus: deactivating an agent leaves the acting admin's session working; demoting an admin with a session gets 403 on `/api/admin/users` next request and keeps the session; with no active admin row, an Access-JWT admin from `ADMIN_EMAILS` deactivates an agent (204); two PATCHes on one user (`{role}` then `{active:false}`) both land; same-name and null-name users list in the documented order.
- [ ] Docs from the Code Map.

**Acceptance Criteria:**
- Given the existing worker suite, when it runs after the change, then it passes unchanged.
- Given the change, when `pnpm build` runs, then the precache is unchanged (no client change).

## Design Notes

Guarded write: the last-admin rule without a read-then-write race, judged on the row as it is when the `UPDATE` runs. Only the fields present in the body are `SET`; an absent one keeps its stored value.

```sql
UPDATE users SET <only the body's fields> WHERE email = ?
  AND (NOT (role = 'admin' AND active = 1)                 -- target is not an active admin now
       OR (coalesce(?newRole, role) = 'admin' AND coalesce(?newActive, active) = 1)  -- and stays one
       OR EXISTS (SELECT 1 FROM users u WHERE u.role = 'admin' AND u.active = 1 AND u.email <> ?))
RETURNING email
```

So a change to an agent, or to an inactive admin, never meets the guard, even when no `users` row is an active admin (phase 1, an Access-only admin before break-glass). No row returned → missing → 404, else 409 `last_admin`. No preliminary `SELECT`. Deactivation batches the update with `DELETE FROM sessions WHERE user_email = ? AND EXISTS (SELECT 1 FROM users WHERE email = ? AND active = 0)`, sent only when the body has `active: false`.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- all green.

## Implementation Notes

- Implemented by an api-engineer subagent; loop 1 and the pass-2 patches by a second one.
- `emailSchema` validates before it lowercases, so `userCreateSchema` trims first (`z.pipe`), leaving `emailSchema` itself unchanged.
- The list sorts in JS with a French `Intl.Collator` (pass 2, #19): SQLite's `NOCASE` folds ASCII only.
- Loop 1's full revert was blocked by the session's permission classifier; the re-derivation edited the loop-0 tree in place per the KEEP list.
- Verification: `pnpm typecheck`, `lint`, `test` (92 files, 2304 tests) and `build` green; precache 938.19 KiB of 1,000 KiB, no client change.

## Spec Change Log

- Loop 1 (review): blind-hunter and edge-case-hunter showed the Design Notes' guard required another active admin for *any* change leaving the target non-admin or inactive, so with no active admin row (phase 1, Access-only admins) every agent deactivation got a false 409 `last_admin`; and merging the body over a prior read wrote stale values back under concurrent PATCHes. Amended Design Notes (guard judged on the row's current state, only present fields set, no preliminary read), the Code Map (list order nulls last and case-insensitive; doc wording that does not claim the assign menu follows `users` yet) and the test task. Avoids: admins unable to manage agents during the cutover, a concurrent deactivation undone. KEEP: everything in the loop-0 diff except the PATCH handler body and `userRows`' `orderBy`: the schemas incl. the trimmed `userCreateSchema` email, the route module and mount, `GET`/`POST`, the `auth.ts` fallback, the docs rows, and every existing test in `users.test.ts`. The full revert was blocked by the session's permission classifier, so the re-derivation edits the loop-0 tree in place.

## Review Triage Log

Pass 1 (thorough; blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: high 0, medium 2, low 8, false 6, maybe-false 0.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | blind, edge, vgap | Guard blocks agent changes when no active admin row exists | medium | bad_spec: loop 1, guard judged on the row's current state |
| 2 | blind, edge | PATCH writes both columns from a stale read | medium | bad_spec: loop 1, only present fields set |
| 3 | edge, blind | Refused PATCH on an inactive user still deletes sessions | low | resolved by #1: an inactive target never meets the guard; the delete is sent only for `active: false` |
| 4 | vgap | Deactivation test never checks other users' sessions survive | low | folded into loop 1 test task |
| 5 | edge, blind | Null names sort first; BINARY collation splits case | low | folded into loop 1 Code Map |
| 6 | vgap | No test of the email tiebreak | low | folded into loop 1 test task |
| 7 | blind, edge, vgap, intent | identity-access.md says no deploy is needed to add an agent, but the assign menu still reads the vars; api.md says there is no users table | low | folded into loop 1 Code Map (doc wording) |
| 8 | blind | Only promotion tested; demotion and sessions surviving a role change are not | low | folded into loop 1 test task |
| 9 | edge | Promoting an agent keeps a 90-day session past the 30-day admin TTL | low | reject: rare in a two-agent team, and the fix adds a sessions rewrite on role change; the sliding-expiry entry owns per-role lifetimes. Reported to the owner |
| 10 | blind | 404 after a refused update untested | low | reject: reachable only if the row is deleted mid-request, and users are never deleted |
| 11 | blind | 409 bodies carry English `message` | false | API messages are not UI copy; design.md has the client map codes to `copy.ts` (entry 7) |
| 12 | blind | Empty-body refine has no path or message | false | the 400 shape is `{path, code}` everywhere; no client sends `{}` |
| 13 | blind | Extra D1 read per Access request not in free-tier-budget.md | false | one PK read per Access request in phase 1, far under 5M/day; the budget docs are entry 16's |
| 14 | blind | Deactivated agent's outbox can never drain | false | nothing is deleted (INVARIANT 5); reactivation plus a code lets it sync; the 401 story owns the client |
| 15 | edge, intent | Assign menu and position gate still read the vars | false | the intent's Never assigns them to entry 6 (GH #303) |
| 16 | blind | Story file's Plan and tracker status untouched | false | the ticketing skill owns those fields, not the build |

Pass 2 (thorough, after loop 1; same lenses). Verdicts: high 0, medium 0, low 10, false 3, maybe-false 0.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 17 | vgap | Guard's "stays an active admin" clause untested | low | patch: sole-admin no-op PATCHes answer 204 |
| 18 | blind | Origin test sends only a foreign Origin, not a missing one | low | patch: missing-Origin POST asserted |
| 19 | edge, blind | `COLLATE NOCASE` folds ASCII only; accented names sort after Z | low | patch: JS sort with a French `Intl.Collator`, test with "Élodie" |
| 20 | blind, edge | "Idempotent" comment on POST, though a retried create gets 409 | low | patch: comment reworded |
| 21 | edge, blind | Post-insert 500 body has no `message` | low | patch: onError's body |
| 22 | blind, edge | api.md § Who can be assigned still says the vars and Access alone decide; Access users with no row are absent from the list | low | patch: paragraph rewritten, removal procedure stated |
| 23 | edge, intent | `last_admin` counts `users` rows only, not ADMIN_EMAILS-only admins | low | patch: documented on the PATCH row (intended: the vars go away in phase 3) |
| 24 | blind | No concurrent last-admin test | low | reject: local D1 runs statements one at a time, so a `Promise.all` test passes with or without the in-statement guard; the guard is one `UPDATE` |
| 25 | edge | Promoted agent keeps a 90-day session | low | carried: #9 reject |
| 26 | blind | PATCH reuses `agentEmailParamSchema`; param not trimmed | low | reject: naming only; the client sends the listed, already-normalised email |
| 27 | blind | Guard SQL uses literal column names and `'admin'` | false | a rename or role change breaks the guard's SQL or its 409/204 tests at once |
| 28 | blind | Extra D1 read per Access request undocumented | false | carried: #13 |
| 29 | intent | Assign menu and position gate still read the vars | false | carried: #15 |
