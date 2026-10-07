# ADR-0029: Sign in through our own login, not Cloudflare Access

- Status: proposed
- Date: 2026-10-07
- Deciders: mohss, Claude
- Supersedes: [ADR-0006](0006-cloudflare-access-auth.md). Amends: [ADR-0012](0012-workers-dev-hostname.md)
  (the hostname is no longer behind Access once the cutover ends).

## Context

[ADR-0006](0006-cloudflare-access-auth.md) put the whole hostname behind Cloudflare Access with an
email one-time PIN and no users table. The roster is two vars, `ADMIN_EMAILS` and `AGENT_EMAILS`.
In use it costs three things:

1. **Adding an agent touches three systems**: the Access policy in the Zero Trust dashboard, a PR
   that edits `AGENT_EMAILS` in `wrangler.jsonc`, and a CI deploy. Skip the second and the agent
   gets in, but is missing from the assign menu (`GET /api/admin/agents`) and their position is not
   stored (`src/worker/routes/agent.ts`, [ADR-0028](0028-agent-position-at-sync.md)).
2. **Agent sign-in leaves the app.** Each time the Access session expires, the agent opens their
   mail app, copies a PIN and types it on a Cloudflare page. The owner also wants no third party
   between the agents and the app.
3. **The Worker cannot revoke anyone.** It checks the JWT's signature, so a session lives until it
   expires. Access's docs describe revocation as an explicit action ("Revoke existing tokens", or
   revoke per user); they do not say that removing an email from the policy ends a live session.

ADR-0006 rejected our own auth for its code and attack surface, mostly for password hashing.
Workers Free allows 10 ms of CPU per request ([free-tier-budget](../free-tier-budget.md)).
PBKDF2-SHA256 measured about 11 ms at 100,000 iterations and 66 ms at OWASP's 600,000 (Node on a
dev machine; workerd will differ). That cost only exists for secrets a human chooses. A generated
secret with enough entropy needs one HMAC, well under a millisecond.

Other facts:
- [ADR-0002](0002-zero-cost-constraint.md): nothing may bill. D1 Free allows 5 million rows read
  and 100,000 rows written a day.
- The docs for the Workers rate-limiting binding give no price and no Free-plan availability. The
  binding counts per Cloudflare location and is eventually consistent.
- Access stops anonymous requests before the Worker runs. Without it, they count against the
  100,000 Worker requests a day of Workers Free.
- `prospects.agent_email`, `visits.agent_email` and `agent_positions.agent_email` all identify a
  user by email.
- An iOS web app installed on the home screen does not share cookies with Safari, so a sign-in
  link opened from a message lands in the wrong cookie jar.

## Decision

We will authenticate in the Worker against a `users` table in D1, with no human-chosen secret, and
remove Cloudflare Access.

1. **Users.** `users` holds the email (primary key, lowercased, because stored rows already key on
   it), a name, the role (`admin` | `agent`), `active`, and an admin's passphrase hash. Admins
   manage it from an Agents page. A user is deactivated, never deleted. A deactivated agent's
   prospects stay assigned and are flagged for the admin. The last active admin cannot be
   deactivated or demoted.
2. **Agents sign in with a one-time code** that an admin generates: 8 characters of Crockford
   base32 (40 bits), valid for 15 minutes, usable once, typed into the app rather than opened as a
   link. It enrols that device.
3. **Admins sign in with a generated passphrase**, shown once and regenerable, never chosen by the
   admin. An admin can also enrol a device with a code made from another of their signed-in
   devices.
4. **Every secret is stored as HMAC-SHA-256** under an `AUTH_PEPPER` secret: codes, passphrases and
   session tokens. None is stored or logged in clear. No slow hash.
5. **One `/login` and one route.** `POST /api/auth/login` takes a `zod/mini` union discriminated on
   `kind`: `code` or `passphrase`. `kind` names the credential, never the role; the role always
   comes from `users`. A later `kind: "passkey"` is an additive change. The page shows the code
   field by default and an "Accès administrateur" switch ([design.md](../design.md) owns the layout).
6. **Sessions live in D1.** A random token sits in a `__Host-` cookie (`HttpOnly`, `Secure`,
   `SameSite=Strict`, `Path=/`), and `sessions` holds its hash, the user, a device label,
   `last_seen_at` and the expiry. Expiry slides: 90 days idle for an agent, 30 for an admin.
   `last_seen_at` is written at most once an hour per session. Every `/api` request looks up the
   session and its active user, so deleting a row signs that device out on its next request.
   Deactivating a user deletes its sessions and unused codes. A lost phone revokes one device, not
   the agent.
7. **Break-glass.** An `OWNER_EMAIL` var and a `BREAK_GLASS` secret, set by the owner or CI and
   never in the repo. Typed in the passphrase field and compared with
   `crypto.subtle.timingSafeEqual`, it creates or reactivates `OWNER_EMAIL` as an active admin and
   opens a session. It also creates the first admin.
8. **Brute force.** A `login_attempts` counter in D1, per IP and 15-minute window: after 10 failures
   that IP is refused until the window ends. Not the rate-limiting binding (see Context).
9. **CSRF.** `SameSite=Strict`, plus an `Origin` check on every `/api` request that is not a `GET`.
10. **Local dev** keeps `DEV_USER_EMAIL`, localhost only. The role is read from `users`, which the
    seed fills.
11. **Sweep.** Expired codes, sessions and `login_attempts` rows go in the nightly Cron Trigger
    that already sweeps positions ([ADR-0028](0028-agent-position-at-sync.md)).
12. **Cutover in three phases** (expand/contract):
    1. Ship the login while Access still fronts the hostname. The Worker accepts a session and falls
       back to the Access JWT. The owner signs in through break-glass and creates the agents.
    2. The owner gives each agent a code, the agents enrol, and the owner revokes the Access tokens
       and deletes the Access application.
    3. A PR removes the JWT check, `jose`, and the `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`,
       `ADMIN_EMAILS` and `AGENT_EMAILS` vars.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep Access, add a `users` table only as the roster | Fixes the assign menu, nothing else: adding an agent still edits the Access policy, sign-in still leaves the app, and revoking is still an Access action |
| Access with a policy open to any email, `users` as the real gate | Sign-in unchanged, two systems still, and a stranger who completes a PIN may take a Zero Trust seat (unverified) |
| Passwords the user chooses, hashed with PBKDF2 | Over the 10 ms CPU budget at a safe iteration count, under-hashed below it, and it needs a reset flow while we send no email |
| TOTP (authenticator app) for admins | The secret has to be stored readable in D1, so a leaked database lets an attacker mint codes; it adds a lockout to build for what a generated passphrase already covers |
| Passkeys (WebAuthn) for admins now | Phishing-resistant, but a few hundred lines to write and test with no auth library, and synced passkeys live with Apple or Google. Kept open as a later `kind` |
| One-time code sent by email from the Worker | `send_email` only reaches addresses verified in Email Routing (unverified for our case), and it brings back the mail-app step |
| Signed session cookie, no `sessions` table | Per-device revocation and a device list need a lookup anyway, and it adds a signing key to rotate |

## Consequences

- Adding an agent is one form on the Agents page, with no deploy. Deactivating takes effect on the
  agent's next request.
- An agent signs in once per device, inside the app, with no third-party page.
- **We now own the login's attack surface**: CSRF, brute force, secret handling and log hygiene.
  The Access-bypass, header-spoofing and stolen-phone rows of [security.md](../security.md) are
  rewritten.
- **The request quota is exposed.** Anonymous requests to `/api/*` run the Worker and count against
  the 100,000 a day. A flood on `/api/auth/login` can stop the app for the rest of the UTC day, and
  the D1 counter cannot prevent it because the request is already counted. Before phase 3, check
  whether a free Cloudflare WAF rate-limiting rule can front `/api/auth/*`; if none exists, record
  the residual risk in [free-tier-budget](../free-tier-budget.md).
- The app shell and the admin chunk become readable without signing in. They hold no data, and that
  must stay true.
- Every authenticated request costs one more D1 read, and each session at most one write an hour.
  [free-tier-budget](../free-tier-budget.md) gets the rows.
- Rotating `AUTH_PEPPER` invalidates every code, passphrase and session, so everyone re-enrols.
  That is acceptable at four users. The owner keeps `BREAK_GLASS` offline.
- INVARIANT 5 is unchanged: a 401 never clears the outbox, and the cached round is still dropped
  on one. The sync payload does not change, so `clientVersion` does not move.
- Follow-up, each in its own change: `identity-access.md`, `security.md`, `api.md`,
  `data-model.md`, `deployment.md`, `free-tier-budget.md` and `design.md` (login page, Agents
  page). ADR-0028's position gate moves from `AGENT_EMAILS` to `users.role`. On the client, the
  Access logout link, the `?reconnect=1` marker and the `/cdn-cgi/` exception go, and a 401 opens
  `/login`. The `api-engineer` and `security-reviewer` agents and the `add-api-route` skill are
  updated.
