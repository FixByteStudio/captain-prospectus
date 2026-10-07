---
title: 'Local dev signs in as any seeded user, and Worker tests stub a D1 session'
type: 'feature'
created: '2026-10-07'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: 'd366c0a1f2f2cd1c2bbf84e0ff50a032b7d1f19a'
context:
  - '{project-root}/_bmad-output/specs/spec-own-login/auth-data.md'
  - '{project-root}/docs/adr/0029-own-login-instead-of-cloudflare-access.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `DEV_USER_EMAIL` takes its role from `ADMIN_EMAILS`, so local dev and every Worker test identify users outside the `users` table that epic-own-login makes the roster (GH #300, CAP-9). Later entries also need a way for a test to be signed in through a real D1 session.

**Approach:** On a local host, `DEV_USER_EMAIL` is looked up in `users`; its role comes from the row, and no row or an inactive row is a 401. The dev seed route inserts the two local users. The Worker test setup inserts the same two rows, and a test helper mints a session cookie.

## Boundaries & Constraints

**Always:**
- `requireIdentity` order is unchanged: session → `DEV_USER_EMAIL` on `isLocalHost` (localhost, 127.0.0.1, [::1]) → Access JWT → 401. A valid session wins over `DEV_USER_EMAIL`.
- `DEV_USER_EMAIL` is lowercased, then read from `users`. No row or `active = false` → 401 `unauthorized`, with no fallthrough to Access. Off a local host it has no effect, as today.
- `POST /api/dev/seed` inserts `admin@example.com` (admin) and `agent@example.com` (agent), both active, with `onConflictDoNothing`. An existing row is never changed. `devSeedResultSchema.inserted` gains `users` (additive). A second run reports `users: 0`.
- Test helpers live in `test/`. One inserts the two rows (idempotent) and runs in `test/setup-worker.ts` after the migrations. The session helper inserts a `sessions` row for an existing user, hashing the token with `hmacHex(env.AUTH_PEPPER, token)`, and returns the `Cookie` header value. It reuses `newSessionToken`, `SESSION_COOKIE` and `SESSION_TTL_MS` from `src/worker/session.ts`.
- A test file that deletes `users` (`auth.test.ts`) re-inserts the two rows itself.

**Never:** roster readers (assign menu `assignableEmails`, dashboard agent rows, ADR-0028 position gate) move off `ADMIN_EMAILS`/`AGENT_EMAILS` (entry 6). `roleFor` and the Access fallback stay. The Access JWT test helper (`test/access-jwt.ts`) stays. No new route, migration, dependency or client change. The seed does not reactivate or re-role an existing row.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Error handling |
|---|---|---|---|
| Seeded admin | localhost, `DEV_USER_EMAIL=admin@example.com`, row admin+active | `/api/me` 200 `{role:"admin"}` | — |
| Seeded agent | `agent@example.com`, row agent | 200 `{role:"agent"}`, admin routes 403 | — |
| Row role beats vars | row role differs from `ADMIN_EMAILS` | role from the row | — |
| Loopback hosts | `127.0.0.1`, `[::1]` | same as localhost | — |
| No row | `DEV_USER_EMAIL` not in `users` | 401 | — |
| Inactive | row `active:false` | 401 | — |
| Other host | non-local host, Access unset | `DEV_USER_EMAIL` ignored → 401 | — |
| Session + dev | valid session for X, `DEV_USER_EMAIL`=Y, localhost | identity X | — |
| Helper | test-session cookie for agent@ on a non-local host | `/api/me` agent | — |
| Seed twice | two `/api/dev/seed` calls | 2nd `inserted.users` = 0 | — |

</frozen-after-approval>

## Code Map

- `src/worker/auth.ts` -- `requireIdentity`'s dev branch (L161-168) uses `roleFor(email, ADMIN_EMAILS)`. Replace with a `users` lookup (`getDb`, `users` already imported). Keep `roleFor` for `identityFromAccess`. Update the header comment.
- `src/worker/routes/dev.ts` -- the `/seed` handler. Add the users insert with `.returning()` to count rows, and `users` in the result. `devOnly` stays as is. The route is mounted before the identity gate (`src/worker/index.ts`), so a fresh database can be seeded.
- `src/shared/schemas.ts:1008` -- `devSeedResultSchema.inserted.users`.
- `test/setup-worker.ts` -- applies the migrations per test file. Seed the two users after that.
- `test/users.ts` (new) -- `TEST_ADMIN`, `TEST_AGENT`, `seedTestUsers()`. `test/session.ts` (new) -- `testSessionCookie(email, opts?)`, with an optional `expiresAt`.
- `src/worker/auth.test.ts` -- `beforeEach` deletes `users` (L80-83); re-seed after it. The "still honours DEV_USER_EMAIL" test (L237) becomes the matrix's dev rows. Use `call(path, init, host)`.
- `src/worker/dev.test.ts:427` -- `toEqual` on `inserted` gains `users: 0`. Add a test that the seed inserts both rows.
- Comments naming `roleFor`/`ADMIN_EMAILS` as the dev role source: `admin.test.ts:25,1241`. Every test file signs in as only admin@ or agent@, so no other test needs changing.
- `scripts/seed-blank.mjs:6`, `.dev.vars.example` (localhost line, role source), `docs/domains/identity-access.md:39`, `docs/api.md:21` (`inserted.users`, users rows), `docs/security.md:13`.
- `scripts/measure-dashboard-cpu.mjs` -- reads a copy of the seeded local D1, so the admin row exists. No change.

## Tasks & Acceptance

**Execution:**
- [x] `src/shared/schemas.ts` -- `inserted.users` -- additive dev contract.
- [x] `src/worker/routes/dev.ts` -- insert the two users rows -- CAP-9 seed.
- [x] `src/worker/auth.ts` -- dev branch reads `users` -- CAP-9.
- [x] `test/users.ts`, `test/session.ts`, `test/setup-worker.ts` -- the seed and the session helpers.
- [x] `src/worker/auth.test.ts` -- every matrix row, including one per loopback host.
- [x] `src/worker/dev.test.ts` -- the seed inserts both rows once.
- [x] Comments and docs from the Code Map.

**Acceptance Criteria:**
- Given the existing worker suite, when it runs after the change, then it passes with only the edits listed above.
- Given a fresh local database (`.wrangler/state` deleted, `pnpm db:migrate:local`), when `pnpm dev` runs, `pnpm db:seed:local` runs, and the page reloads, then the app opens as `admin@example.com` (admin).

## Implementation Notes

- Two existing break-glass assertions in `auth.test.ts` assumed `users` was empty; once `beforeEach` re-seeds the two rows they are narrowed to `OWNER` (needed for the suite to pass).
- Manual check (implementer): empty local D1 → `/api/me` 401 with the seed hint; after `pnpm db:seed:local` → 200 admin, `/admin` opens; a second seed reports `users: 0`.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough; blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: high 0, medium 0, low 13, false 1, maybe-false 0. Verification-gap: no gaps.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | blind, edge, verification-gap | 401 hint "Run pnpm db:seed:local" wrong for an inactive row or another email | low | patch: names the two seedable emails |
| 2 | blind, edge | `DEV_USER_EMAIL` not trimmed before the lookup | low | patch: trim |
| 3 | blind, edge | New dev.test case restores the agent only on its last line; a failure cascades into 401s | low | patch: try/finally |
| 4 | blind | "Re-roled row left as it is" untested | low | patch: assertion added |
| 5 | blind, edge | `testSessionCookie` does not lowercase the email | low | patch |
| 6 | blind | auth.ts comments still say "localhost only" | low | patch |
| 7 | blind | `.dev.vars.example` "Anyone else who signs in is an agent" misleads locally | low | patch |
| 8 | blind | The two emails are hard-coded in `dev.ts`, `test/users.ts`, `vitest.config.ts`, seed.mjs | low | reject: fixed values that seldom change; unifying them crosses the test/runtime/script boundaries |
| 9 | blind | Seed scripts don't print `inserted.users` | low | reject: cosmetic; the 401 hint covers a missing row |
| 10 | blind | `seed.mjs` assigns to a custom `DEV_USER_EMAIL` that gets no row | low | reject: the intent seeds the two local users only; custom emails are outside it |
| 11 | blind | `seed.mjs` header not updated | false | its header never named ADMIN_EMAILS or the users |
| 12 | blind | Expired session on localhost falls back to DEV_USER_EMAIL; logout drops back to it, undocumented | low | reject: the order is the ticket's decision; identity-access.md says the session wins |
| 13 | blind | Inactive row + valid JWT not tested | low | reject: same branch as the tested missing-row case |
| 14 | intent-alignment | The local-dev surface (fresh D1, seed script, reload) is not exercised by an automated test | low | reject: checked manually (Implementation Notes); re-checked at presentation |

## Design Notes

The test seed goes in `setup-worker.ts` rather than in each file's hooks. Every file signs in through `DEV_USER_EMAIL`, and only `auth.test.ts` deletes `users`, so one setup line covers the rest of the suite.

A 401 rather than a fallthrough to Access: a local developer whose row is gone is a deactivated user (ticket Notes).

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- all green.

**Manual checks:**
- Fresh local D1 → `pnpm db:migrate:local`, `pnpm dev`, `pnpm db:seed:local`, then reload in the browser pane: the admin shell shows `admin@example.com`.
