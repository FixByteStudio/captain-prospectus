# Security & privacy

## Threat model (short)

Reviewed in full at M5 (see the roadmap). A row that the code does not honour says so
and links the issue; a row with no caveat was checked and holds. **Keep it that way** —
a mitigation nobody has verified is worse than one nobody claimed.

| Threat | Mitigation |
|---|---|
| A request with no valid session | Identity is a D1 session (`src/worker/auth.ts`); with none, every `/api` route outside `/api/auth/*` and `/api/dev/*` answers 401, whether the cookie is missing, unknown, expired or its user deactivated (`auth.test.ts`, `requireIdentity`). Until the cutover ends, a JWT verified in the Worker is the one other way in. A missing `AUTH_PEPPER` skips the session lookup and makes sign-in answer 500, never open access. Preview URLs are disabled by `preview_urls: false` in `wrangler.jsonc`, which every deploy applies and `config.test.ts` asserts |
| Header spoofing | Email taken from the D1 session or the verified JWT only, never a header or a client claim |
| Dev impersonation leaking to prod | `DEV_USER_EMAIL` ignored unless host is localhost, `127.0.0.1` or `[::1]`, and even there it must name an active `users` row, which also gives the role; `/api/dev/*` needs both that variable and a localhost host, and it and `/api/auth/*` (sign-in and sign-out) are the only routes mounted before auth |
| Agent reading other agents' data | Agent **reads** filter by the verified email. A visit against a prospect that isn't the sender's is quarantined in `visits_orphaned` and derives nothing until an admin repairs it. It is not refused, because INVARIANT 5 outranks the rule ([ADR-0022](adr/0022-quarantine-visits-the-server-cannot-take.md), [#33](https://github.com/FixbyteStudio/captain-prospectus/issues/33)) |
| Cross-site request forgery | The session cookie is `SameSite=Strict`, and any `/api` request other than `GET` or `HEAD` whose `Origin` is missing or not the Worker's own gets 403, on every route (`src/worker/origin.ts`) |
| Guessing codes or passphrases | After 10 failed logins from one IP in a fixed 15-minute window, every login from it gets 429 until the window ends, checked before the credential. Each try reserves its failure in one conditional upsert before the check, so a parallel burst gets no more than 10 through. Counted in D1 `login_attempts` under an HMAC of the IP (an IPv6 address by its /64), never the IP in clear; requests without `CF-Connecting-IP` share one bucket (`src/worker/login-throttle.ts`) |
| Malformed or oversized payloads | zod validation, array size caps, and a `MAX_REQUEST_BYTES` body cap enforced Worker-wide in `src/worker/index.ts` before anything parses the body |
| SQL injection | Drizzle parameterised queries only; no string-built SQL |
| XSS through imported data (names, notes) | React escaping; no `dangerouslySetInnerHTML` |
| Stolen phone | An admin revokes the device's session (`DELETE /api/admin/sessions/:id`) or deactivates the user, which deletes all their sessions (`users.test.ts`). The next request gets 401; the app drops the cached round, identity and visit history and keeps the outbox (`clearAgentCache`, `App.test.tsx`, INVARIANT 5). A session nobody revokes expires 90 days (agent) or 30 days (admin) after its last use (`SESSION_TTL_MS`, `src/worker/session.ts`). Until one of those, whoever holds the phone holds a working session. |
| Leaked database | A dump holds only HMAC-SHA-256 digests under `AUTH_PEPPER` of login codes, passphrases, session tokens and IPs, so none of them can be replayed or reversed (`session.ts`, `auth.test.ts` "never logs the code nor stores it in plaintext", "stores only the HMAC of the passphrase", "stores the IP only as its HMAC"). It still holds business data, users' emails and names, and visit notes inside the 90-day retention window. Rotating `AUTH_PEPPER` voids every session (`auth.test.ts`), and every code and passphrase with it, because they are keyed by the same pepper; only the session case has a test |
| Secret handling | `AUTH_PEPPER` and `BREAK_GLASS` are Worker secrets, `OWNER_EMAIL` a variable kept out of `wrangler.jsonc`; all three are set by the owner or CI, never in the repo (`src/worker/types.ts`). A Worker without them fails closed: no pepper is 500, no owner or break-glass is 401. **Not enforced:** `config.test.ts` guards only `GOOGLE_PLACES_KEY` ([#348](https://github.com/FixByteStudio/captain-prospectus/issues/348)) |
| Log hygiene | No code, passphrase, token, hash, IP or User-Agent reaches a log line. The login, `/api/me` and throttle paths are tested with every console level spied (`auth.test.ts` "log hygiene", "never logs the User-Agent", "logs neither the IP nor the credential"); the unhandled-error log carries names and the route only (`errors.test.ts`) and the sweep logs counts (`retention.test.ts`). No test scans the other routes' log lines; the one `console` call in them (`routes/agent.ts`, a failed position write) logs an error name only |
| Leaked Cloudflare token | Scoped token in GitHub secrets, never in the repo |

### The body cap

`MAX_REQUEST_BYTES` (`src/shared/constants.ts`) is 2 MiB, about twice the largest
request a client can legitimately build — a full sync of 100 field prospects and 200
visits carrying maximum-length notes and a 50-question script answered is 1060 KiB.
It exists because the array caps bound rows, not bytes: a visit may carry 50 answers
(`SCRIPT_QUESTIONS_MAX`) of 2000 characters each, so a schema-valid payload can reach 19.7 MiB.

It is enforced as the **first** middleware registered, above the `/dev` mount, because
Hono composes handlers in registration order and `/api/dev/*` is the one route mounted
before auth. Budget tests in `src/shared/constants.test.ts` fail if a count cap is ever
raised past the byte cap, and `src/client/field/sync.ts` trims a batch that would exceed
it — a payload the server always refuses is an outbox that never drains (INVARIANT 5).

## Personal data
- **Prospect data** is mostly public business info, but may include a contact person's name or phone. Keep it to what the business needs.
- **Agent location** is personal data. One reading (`getCurrentPosition`, never `watchPosition`) is written to the visit at check-in and to a field prospect when it is added — that reading is what reaches the server and is stored. The today list also takes a reading to order the round by distance. Once epic 5's phone side ships, the latest reading taken today goes with each sync and is kept, one per agent, for the admin round view until the night's sweep ([ADR-0028](adr/0028-agent-position-at-sync.md)); the owner tells the agents before that release. Nothing tracks in the background. Agents are told this.
- **Retention**: a visit is kept for ever; its **position and notes are nulled after
  90 days** (`RETENTION_DAYS`), measured on `received_at` because a phone's clock can be
  wrong. A daily Cron Trigger runs the sweep
  ([ADR-0023](adr/0023-retention-by-redaction.md), `src/worker/retention.ts`). The fact of
  a visit is business history; where the agent was standing is not. A consequence worth
  knowing: a visit older than 90 days can no longer be checked against where it was made.
  An agent's latest position of the day (`agent_positions`) is served only for that Brussels
  day and deleted by the next morning's sweep ([ADR-0028](adr/0028-agent-position-at-sync.md)).
- No third-party analytics, and the data stays in the Cloudflare account. Backups go to R2, not to a GitHub artifact (ADR-0023, [#34](https://github.com/FixbyteStudio/captain-prospectus/issues/34)); the bucket is one-time setup in [deployment.md](deployment.md).
- A session stores only the device label parsed from the User-Agent at login ("iPhone · Safari", `src/worker/device-label.ts`), never the raw User-Agent, and nothing logs it.
- The Worker's unhandled-error log (`onError`, `src/worker/index.ts`) carries only error names and the route, never a message or bound values — Drizzle's own message is `Failed query: <sql>\nparams: <values>`, which can be a visit note or an agent's email (`src/worker/errors.ts`).

## Secrets
- No secrets in `wrangler.jsonc` beyond non-sensitive vars. If a real secret is ever needed: `wrangler secret put`.
- **`AUTH_PEPPER`** keys every stored HMAC; **`BREAK_GLASS`** is the owner's offline admin
  secret; **`OWNER_EMAIL`** names the owner and is a variable kept out of `wrangler.jsonc`
  (ADR-0029). Rotating `AUTH_PEPPER` voids every code, passphrase and session. How to set them
  is in [deployment.md](deployment.md).
- **`GOOGLE_PLACES_KEY`** is a secret too (ADR-0020). It is set with
  `wrangler secret put GOOGLE_PLACES_KEY`, lives in `.dev.vars` locally, and appears in
  neither `wrangler.jsonc` nor the repo — `config.test.ts` fails CI if it ever does.
  The browser never sees it: the key is a request header the Worker adds, which is why
  the map import is a Worker route and not a client call. Google's own error bodies are
  never forwarded to the admin, because a 400 from a bad field mask echoes back the
  request those headers were on.
- `.dev.vars` is git-ignored.
