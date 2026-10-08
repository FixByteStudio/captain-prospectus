---
title: 'Logins are throttled per IP and cross-site writes are refused'
type: 'feature'
created: '2026-10-07'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 1
baseline_commit: 'bd3edd3abfe6bf6dfe50eb7acfd2da596e420325'
context:
  - '{project-root}/_bmad-output/specs/spec-own-login/auth-data.md'
  - '{project-root}/docs/adr/0029-own-login-instead-of-cloudflare-access.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `POST /api/auth/login` can be guessed at without limit, and any site can make a state-changing `/api` request riding the user's session (GH #301, CAP-7, CAP-8).

**Approach:** A `login_attempts` table counts failed logins per HMAC'd IP in fixed 15-minute windows; at 10 the login route answers 429 with `Retry-After` before looking at the credential. A Worker-wide middleware refuses with 403 every `/api` request other than GET/HEAD whose `Origin` is missing or differs from the request URL's origin.

## Boundaries & Constraints

**Always:**
- The IP is `CF-Connecting-IP`, or the literal `"unknown"` when absent (one shared bucket). Decision (2026-10-07, owner, at review): an IPv6 address counts by its /64 prefix, so one host cannot rotate through its block; IPv4 counts per address. It is stored only as `hmacHex(AUTH_PEPPER, ip)`; never in clear, never logged.
- Window = `floor(now / 15 min) * 15 min`. Lock when that window's count ≥ 10; `Retry-After` = whole seconds until the window ends (≥ 1). 429 body `{error: "too_many_attempts", message}`.
- The lock check runs before validation and before the credential, so a locked IP gets 429 even with a valid credential or a malformed body.
- Every 400 or 401 answered by `/login` adds one failure, including the 401 for unset `OWNER_EMAIL`/`BREAK_GLASS`. Success does not reset the count. Later login kinds share the counter by going through the same route.
- No `AUTH_PEPPER` → the throttle steps aside and the route still answers 500 `misconfigured`.
- The Origin middleware is registered right after `bodyLimit`, above the `/dev` and `/auth` mounts, so it covers them. 403 body `{error: "forbidden_origin", message}`. `Origin: null` is foreign.
- Worker tests send `Origin` through one shared helper in `test/`; the seed scripts send `new URL(URL_BASE).origin`.

**Never:** no client change (the `/login` lockout message is entry 8), no route exemption from the Origin rule, no Cloudflare rate-limiting binding, no sweep of old rows (entry for CAP-10), no new dependency. Never log the IP, its hash or the credential.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Lockout | 10 failed logins from IP A in one window, then the valid break-glass | 11th → 429, `Retry-After` ≤ 900 |
| Other IP | IP A locked, IP B valid break-glass | 200 |
| Window ends | A locked, clock past the window end | login counted afresh |
| No header | requests without `CF-Connecting-IP` | share the `"unknown"` bucket |
| Unset owner | `OWNER_EMAIL` unset, 10 tries | 11th → 429 |
| Success | valid login after 5 failures | 200; count still 5 |
| Stored form | after failures | `login_attempts` holds no clear IP |
| Foreign Origin | POST with valid session, `Origin: https://evil.example` | 403 |
| Missing Origin | POST with valid session, no Origin | 403 |
| App Origin | same POST, Origin = request origin | passes (incl. `POST /api/agent/sync`) |
| GET | GET without Origin | not checked |
| Logs | any of the above | no console line carries IP or credential |

</frozen-after-approval>

## Code Map

- `src/worker/db/schema.ts` -- add `loginAttempts`: `ip_hash` text, `window_start` int, `failures` int, composite PK (`ip_hash`, `window_start`). Then `pnpm db:generate` → `drizzle/0010_*.sql` (expand-only, new table).
- `src/worker/login-throttle.ts` (new) -- `LOGIN_MAX_FAILURES`, `LOGIN_WINDOW_MS`, and a `loginThrottle` middleware: `throttleKey` (IPv6 → /64), hash it, reserve with the conditional upsert (Design Notes) → 429 when nothing returns, else `await next()` and refund unless `c.res.status` is 400 or 401.
- `src/worker/routes/auth.ts` -- `authRoutes.post("/login", loginThrottle, validate(...), …)`. Update header comment.
- `src/worker/origin.ts` (new) -- `requireSameOrigin` middleware; `new URL(c.req.url).origin` vs `Origin`.
- `src/worker/index.ts` -- `app.use("/*", requireSameOrigin)` after `bodyLimit`, before `/dev`.
- `src/worker/session.ts` -- reuse `hmacHex`; no change.
- `test/worker-fetch.ts` (new) -- `workerFetch(url, init)`: builds the Request, sets `Origin` to the URL's origin unless the caller set one, runs `worker.fetch` with an execution context. Each `call`/`callAt` in `auth`, `admin`, `dashboard`, `dev`, `export`, `orphans`, `overpass`, `places`, `sync` `.test.ts` delegates to it.
- `scripts/seed.mjs:167`, `scripts/seed-blank.mjs:47` -- add the `Origin` header.
- `src/worker/auth.test.ts` -- throttle rows of the matrix (fake `Date.now` with `vi.spyOn` for the window end), log-spy assertion.
- `src/worker/origin.test.ts` (new) -- Origin rows, using `testSessionCookie`.
- Docs: `docs/api.md` (login row: 429; status codes 403 Origin, 429), `docs/data-model.md` (`LOGIN_ATTEMPTS` block + paragraph), `docs/security.md` (CSRF and brute-force rows), `docs/domains/identity-access.md:26` (drop "throttling and the CSRF check are later").

## Tasks & Acceptance

**Execution:**
- [x] `src/worker/db/schema.ts` + `pnpm db:generate` -- table and migration.
- [x] `src/worker/login-throttle.ts`, `src/worker/routes/auth.ts` -- CAP-7.
- [x] `src/worker/origin.ts`, `src/worker/index.ts` -- CAP-8.
- [x] `test/worker-fetch.ts` + the nine test files' helpers -- suite sends Origin.
- [x] `scripts/seed.mjs`, `scripts/seed-blank.mjs` -- Origin header.
- [x] `src/worker/auth.test.ts`, `src/worker/origin.test.ts` -- every matrix row.
- [x] Docs from the Code Map.

**Acceptance Criteria:**
- Given the existing worker suite, when it runs after the change, then it passes with only the helper edits above.
- Given a fresh local database, when `pnpm dev` runs and `pnpm db:seed:local` runs, then it seeds (the Worker sees `localhost:5173` as the request origin).

## Design Notes

Fixed windows rather than sliding: one row per IP per window, and "until the window ends" is a single number for `Retry-After`.

Reserve, then refund: each login runs one conditional upsert (`failures + 1` only while `failures < 10`, `RETURNING failures`) before validation. No returned row → 429, with no write. After the handler, a 400/401 keeps the reservation; any other status hands it back with `failures - 1` (errors swallowed). D1 runs statements one at a time, so a parallel burst gets at most 10 through.

400 counts as a failure because the story counts every refusal; a real client never sends a malformed body.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- all green.

**Manual checks:**
- Fresh `.wrangler/state` → `pnpm db:migrate:local`, `pnpm dev`, `pnpm db:seed:local` succeeds; the app loads as admin and a POST from the app (e.g. assign) still works.

## Implementation Notes

- Implemented directly in this session, not through a coding subagent.
- `auth.test.ts` `beforeEach` also clears `login_attempts`: the storage is not isolated per test, and the file's many refused logins share the `"unknown"` bucket (needed for the suite to pass).
- Manual check: fresh local D1 → `pnpm db:migrate:local` (0010 applied), dev server on the worktree, `pnpm db:seed:local` seeded 10 prospects; a curl POST with no Origin and one with a foreign Origin got 403; in the browser, `/api/me` was admin and `POST /api/admin/prospects/assign` answered 200.
- Precache 938.08 KiB of 1,000 KiB (no client change).

## Spec Change Log

- Loop 1 (review): blind-hunter and edge-case-hunter showed the read-then-increment throttle lets any number of parallel guesses through, not "a few" as Design Notes claimed. Amended Design Notes and the Code Map's `login-throttle.ts` line to reserve-then-refund with a conditional upsert. Avoids an unbounded burst bypass and a D1 write per locked request. Owner decision added to Always: IPv6 by /64. KEEP: the schema and migration, the Origin middleware and its placement, `test/worker-fetch.ts` and the nine helpers, the seed scripts, every existing matrix test, and the docs; only `login-throttle.ts`, its tests and the throttle sentences in the docs change.

## Review Triage Log

Pass 1 (thorough; blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: high 1, medium 1, low 7, false 7, maybe-false 0.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | blind, edge | Parallel burst passes the read-then-increment check without bound; comment understates it | high | bad_spec: loop 1, reserve-then-refund; burst test added |
| 2 | blind, edge | IPv6 addresses of one /64 each get their own bucket | medium | intent_gap: owner chose /64; `throttleKey` + tests |
| 3 | edge | Failure upsert throwing after `next()` replaces a 400/401 with 500/503 | low | resolved by #1: the reservation runs before the handler; the refund swallows errors |
| 4 | blind | api.md says the Origin check runs "before anything else", but the body cap runs first | low | patch: api.md says it runs after the body cap |
| 5 | blind | 403 row says "non-GET" where the rule is GET/HEAD; 429 row out of order | low | patch: both fixed |
| 6 | blind | No test that a 429 is not counted | low | patch: test added |
| 7 | blind | Field sync treats a `forbidden_origin` 403 as a lost session and drops the cached round | low | reject: a first-party browser request always carries its own Origin; the outbox survives; fix adds a branch |
| 8 | verification-gap | Seed scripts' Origin header has no automated check | low | defer: dev-only scripts with no harness; checked by hand (Implementation Notes) |
| 9 | blind | Drizzle snapshot 0010 missing | false | the review diff excluded it on purpose; `drizzle/meta/0010_snapshot.json` is in the tree |
| 10 | blind | /login shows a 429 as the generic failure | false | the intent's Never excludes the client; entry 8 owns the lockout message |
| 11 | blind, edge | No retention sweep for `login_attempts` | false | the intent's Never assigns it to the CAP-10 entry (nightly sweep story) |
| 12 | blind | No per-account or global limit against a distributed attack | false | the intent says per IP; recorded in deferred-work for the owner |
| 13 | blind | IP hash shares the HMAC key with session tokens, no domain separation | false | the digests live in different tables and nothing compares one to the other; no swap is possible |
| 14 | edge | OPTIONS preflights get 403 while api.md mentions only non-GET/HEAD | false | api.md says "other than GET or HEAD", which includes OPTIONS; the app makes no cross-origin calls |
| 15 | edge | Only 400/401 count; later login kinds' other refusals are left out | false | speculative; later kinds answer 401 through the same route (auth-data.md) |
| 16 | intent-alignment | Tests exercise the Worker surface, not browsers or production `CF-Connecting-IP` | low | reject: browser POST checked by hand; entry 18 checks the header on production (ticket Notes) |
