---
title: 'Break-glass gives the owner a session on /login'
type: 'feature'
created: '2026-10-07'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '577554bd234936696b5d9ecbc31f157489a6bcc9'
context:
  - '{project-root}/_bmad-output/specs/spec-own-login/auth-data.md'
  - '{project-root}/docs/adr/0029-own-login-instead-of-cloudflare-access.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Only Cloudflare Access can identify a user today, so there is no session of our own and no way in when Access is absent (GH #299, tracer bullet of epic-own-login #296).

**Approach:** Add `users` and `sessions` (expand migration), HMAC helpers under `AUTH_PEPPER`, `POST /api/auth/login` (kind `passphrase`, break-glass only) and `POST /api/auth/logout`, a `__Host-` session cookie, session-first `requireIdentity` with the Access JWT as an isolated fallback, and a `/login` page showing design.md's admin form.

## Boundaries & Constraints

**Always:**
- Break-glass: `email` lowercased+trimmed equals `OWNER_EMAIL` lowercased, and HMAC(`passphrase`) vs HMAC(`BREAK_GLASS`) compared with `crypto.subtle.timingSafeEqual` (equal-length digests, no length leak). The passphrase is compared as typed — no normaliser here; generated passphrases (entry 9) bring it.
- Success upserts `OWNER_EMAIL` as `role: admin, active: true` and inserts a session; response 200 `MeResponse` + `Set-Cookie`.
- Cookie `__Host-cp_session`, `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age` = session lifetime. Token = 32 random bytes base64url; only HMAC-SHA-256 hex is stored.
- `expires_at` = created + 30 days (admin) / 90 days (agent), fixed; no sliding, no device label, no `last_seen_at` writes (entry 10).
- `requireIdentity` order: valid session (unexpired, user active; role from `users`) → `DEV_USER_EMAIL` on localhost → Access JWT when both Access vars are set → 401. The JWT path lives in one function.
- Logout: deletes the cookie's session if any, clears the cookie, 204; works without a session.
- Login and logout are mounted before the identity gate. Body validated with a `zod/mini` discriminated union on `kind` (passphrase only for now; anything else 400).
- No log line carries `BREAK_GLASS`, a token, or a hash. Missing `AUTH_PEPPER` fails closed (500 `misconfigured`, session lookup skipped); missing `OWNER_EMAIL`/`BREAK_GLASS` → 401.
- `/login` renders outside the identity gate (no `/api/me`), field rules: `copy/field`, native-backed `Input touch`, shadcn `form` with a `z.pick` resolver, `Card`, `Alert`, `Spinner`. After success: admin → `/admin`, agent → `/tournee`.

**Never:** login throttling (entry 4), CSRF guard (CAP-8), code form and "Accès administrateur" switch (entries 8, 9), sliding expiry / device label / sweep (10, 13), 401→`/login` routing and the outbox line (12), already-signed-in redirect from `/login`, roster reads from `users` (CAP-11), removing `jose` or Access vars, putting `OWNER_EMAIL` in `wrangler.jsonc`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Error handling |
|---|---|---|---|
| Break-glass ok | `{kind:"passphrase", email: OWNER_EMAIL (any case), passphrase: BREAK_GLASS}` | 200 `{email, role:"admin"}`, cookie set, user row admin+active | — |
| Owner was deactivated / agent | same, existing row `active:0` or `role:agent` | row back to admin+active, session opened | — |
| Wrong email or wrong secret | either part wrong | 401 `unauthorized`, identical body for both | no session row |
| Bad body | `kind:"code"`, missing field, non-JSON | 400 | — |
| Session + JWT | valid cookie and valid JWT for another email | identity from session | — |
| JWT alone | non-localhost, signed JWT | 200 on `/api/me` | — |
| Neither | non-localhost, Access vars empty | 401 (was 500) | — |
| Expired/inactive | session past `expires_at`, or user inactive | falls through → 401 | — |
| Logout | with cookie | row deleted, cookie cleared, next `/api/me` 401 | — |
| Page states | 401 / fetch rejects / 5xx / offline | design.md copy; offline disables button, keeps fields | — |

</frozen-after-approval>

## Code Map

- `src/worker/db/schema.ts` -- add `users` (email PK, name nullable, role enum `ROLES` from shared constants, active int bool default 1, passphrase_hash nullable, created_at) and `sessions` (token_hash PK, user_email → users.email, created_at, last_seen_at, expires_at; index on user_email). Then `pnpm db:generate` → `drizzle/0009_*.sql`.
- `src/worker/session.ts` (new) -- `hmacHex(pepper, value)` with the imported `CryptoKey` cached in module scope (invariant 13), `newSessionToken()`, cookie read/serialize, `SESSION_TTL` per role.
- `src/worker/auth.ts` -- current `requireIdentity` (L84-127) does DEV→Access, 500 when Access vars empty. Refactor: `identityFromSession`, keep `isLocalHost`/`roleFor`/`parseEmails`, extract `identityFromAccess`. Keep the JWKS module cache.
- `src/worker/routes/auth.ts` (new) -- login + logout. `src/worker/index.ts` mounts `app.route("/auth", authRoutes)` after `/dev`, before `requireIdentity`.
- `src/worker/types.ts` -- add optional `AUTH_PEPPER`, `BREAK_GLASS`, `OWNER_EMAIL`. `test/env.d.ts` and `vitest.config.ts` worker bindings -- same three with test values.
- `src/shared/schemas.ts` -- `loginRequestSchema` (zod/mini discriminated union) + type; reuse `meResponseSchema` (L83) as the response.
- `test/access-jwt.ts` (new) -- generate RS256 key with `jose`, `vi.stubGlobal("fetch")` answering `${teamDomain}/cdn-cgi/access/certs`, sign `{email}` with iss/aud. Pattern: `src/worker/overpass.test.ts:84`. Use a unique team domain so the module JWKS cache never holds a stale key.
- `src/worker/auth.test.ts` (new) -- requests via `worker.fetch(new Request("https://captain.example/api/..."))` like `admin.test.ts:32`, toggling `env` Access vars per test.
- `src/client/App.tsx` -- wrap: outer `App` keeps `usePwa()` and renders `<Routes>`: `/login` → `LoginScreen`, `*` → the current body renamed `GatedApp` (receives `pwa`). Only the gated shell fetches `/api/me`.
- `src/client/auth/LoginScreen.tsx` (new) -- design.md "The login page", admin form only. Reuse `Band`/`BandBrand`, `@/ui/card`, `@/ui/alert`, `@/ui/spinner`, `@/ui/form`, `@/ui/input` (`touch`), `useOnline`, `apiFetch`/`ApiError`. Form pattern: `src/client/field/AddProspectScreen.tsx:63-140`.
- `src/client/copy/field.ts` -- `login` block with the design.md strings.
- Docs: `docs/data-model.md` (tables + cookie name), `docs/api.md` (auth routes, 401 replaces 500), `docs/domains/identity-access.md` (session first, break-glass), `docs/security.md:11` row (no more 500 fail-closed wording).

## Tasks & Acceptance

**Execution:**
- [x] `src/worker/db/schema.ts` + `drizzle/0009_*` -- tables via `pnpm db:generate` -- expand-only migration.
- [x] `src/shared/schemas.ts` -- login request schema -- invariant 6.
- [x] `src/worker/types.ts`, `test/env.d.ts`, `vitest.config.ts` -- three bindings.
- [x] `src/worker/session.ts` -- HMAC, token, cookie helpers.
- [x] `src/worker/auth.ts` -- session-first gate, isolated Access fallback, 401 when unconfigured.
- [x] `src/worker/routes/auth.ts`, `src/worker/index.ts` -- login/logout before the gate.
- [x] `test/access-jwt.ts`, `src/worker/auth.test.ts` -- every matrix row plus a console spy asserting no secret/token/hash in any log call.
- [x] `src/client/copy/field.ts`, `src/client/auth/LoginScreen.tsx`, `src/client/App.tsx` -- `/login` outside the gate.
- [x] `src/client/auth/LoginScreen.test.tsx` -- 401 copy keeps fields, network copy, offline disables, admin lands on `/admin`.
- [x] Docs listed in the Code Map.

**Acceptance Criteria:**
- Given `pnpm dev` with `DEV_USER_EMAIL` unset and Access vars empty, when the owner submits `OWNER_EMAIL` + `BREAK_GLASS` at `/login` in Chrome or Firefox, then they land on `/admin` and stay signed in after a reload.
- Given the existing worker suite, when it runs with `DEV_USER_EMAIL` still bound, then it passes unchanged.
- Given the build, the field precache stays under 1,000 KiB and the PR quotes the total.

## Implementation Notes

- Without `AUTH_PEPPER` the gate skips the session lookup and falls through to dev/Access (phase-1 deploys keep working through Access); login answers 500, logout clears the cookie.
- The login email is trimmed and lowercased by the schema, with no format check, so a refusal never depends on which part was wrong.
- A 426 on login shows the generic failure copy: the route cannot answer 426 today.
- Precache: 938.07 KiB of 1,000 KiB (24 entries).

## Spec Change Log

## Review Triage Log

Pass 1 (thorough; blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: high 0, medium 2, low 17, false 3, maybe-false 1.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | verification-gap | No App-level test that `/login` skips `GatedApp` and `/api/me` | medium | patch: `App.test.tsx` case via `renderApp("/login")` |
| 2 | edge-case | Forged-JWT test fails on issuer/aud, never on signature | medium | patch: forge with same iss/aud/kid, other key |
| 3 | blind | No test that login/logout work with Access configured | low | patch: test added (phase 1's real setup) |
| 4 | blind | No test that dead session + valid JWT falls back to JWT | low | patch: test added |
| 5 | blind | Worker inlines French `REFUSED`, duplicating `copy.login.adminRefused` | low | patch: English message; client never shows a 401 message |
| 6 | blind | `bodyLimit` comment says `/api/dev/*` is the only pre-auth mount | low | patch: names `/api/auth/*` |
| 7 | blind, verification-gap | `identity.ts` comment still describes 500 for missing Access | low | patch: comment corrected; the 401 itself is the issue's decision (GH #299 Notes) |
| 8 | blind | `security.md` lines 12–13 ignore sessions and `/api/auth/*` | low | patch |
| 9 | edge-case | Deactivated user keeps access via Access JWT fallback | low | defer: no route deactivates a user yet; belongs with CAP-1's deactivation entry |
| 10 | edge-case | Logout leaves the Access cookie, so `/api/me` still answers via Access | low | reject: phase-1 behaviour by design; no logout UI yet, entry 12 owns it |
| 11 | edge-case | Login with a live cookie leaves the old session row | low | reject: browser overwrites the cookie; row expires, sweep is entry 13 |
| 12 | edge-case | `BREAK_GLASS` > 200 chars or with a newline is unenterable | low | reject: owner-set secret, unlikely; fix adds a guard |
| 13 | edge-case, intent | Access opaqueredirect on login shown as wrong passphrase | low | reject: Access fronts the page too, so `/login` is only reached with an Access cookie |
| 14 | edge-case, blind, verification-gap | Over-long field shows the "required" message | low | reject: needs > 200/320 chars; fix needs per-code copy or a second rule copy |
| 15 | edge-case | Nothing routes a 401 to `/login` | false | GH #299 Notes assign it to entry 12 |
| 16 | edge-case, blind | `/login` never shows `UpdatePrompt` | low | reject: no 426 on login today; entry 12 sends phones here |
| 17 | edge-case | Signed-in user on `/login` sees the form | low | reject: owner-only today; fix adds an `/api/me` probe |
| 18 | edge-case | Worker deployed before migration 0009 500s on cookie requests | maybe-false | reject: would need CI order checked; no cookie exists before 0009 can mint one, so only low |
| 19 | edge-case | Safari rejects `__Host-` over http://localhost | low | reject: documented in GH #299 Notes; verify in Chrome/Firefox |
| 20 | blind | `refusalFor` maps 400/413 to "try again" | false | form blocks every input the server would 400; 413 unreachable at these sizes |
| 21 | blind | `free-tier-budget.md` lacks the per-request D1 read | low | reject: the budget doc is its own epic follow-up (CAP-14, entries 14–16) |
| 22 | blind | Spec tasks unchecked, precache not quoted | false | bookkeeping done at presentation; precache 938.07 KiB recorded |
| 23 | intent | Delivered at Worker-HTTP and component surfaces; browser AC is manual | low | reject: manual AC is the hitl step; flagged to the owner |

## Design Notes

Outer-`Routes` over a `/login` branch inside `App`: a branch would have to sit before the identity hooks or skip them conditionally, while the outer route keeps `GatedApp` byte-for-byte as today and means `/login` never asks `/api/me` — the property entry 12 needs when a 401 sends a phone there.

`DEV_USER_EMAIL` stays after the session so a developer signed in through `/login` locally is who the session says; CAP-9's move to the `users` row is a later entry.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:precache` -- all green, precache ≤ 1,000 KiB.

**Manual checks:**
- `pnpm db:migrate:local`, `pnpm dev` with `DEV_USER_EMAIL` commented out in `.dev.vars`: sign in at `/login` in the browser pane, reach `/admin`, reload, still signed in.
