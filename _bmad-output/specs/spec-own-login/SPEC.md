---
id: SPEC-own-login
companions:
  - auth-data.md
  - cutover.md
sources:
  - ../../../docs/adr/0029-own-login-instead-of-cloudflare-access.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Own login replaces Cloudflare Access

## Why

Today Cloudflare Access sits in front of the whole hostname, and two vars hold the roster. That causes three problems. Adding an agent means changing three systems: the Access policy, a PR that edits `AGENT_EMAILS`, and a deploy. If the PR is skipped, the agent can sign in but is missing from the assign menu and their position is not stored. Agents also leave the app to sign in: they copy a PIN from their mail app into a Cloudflare page, and the owner wants no third party between the agents and the app. Finally, the Worker cannot revoke a live session. Codes, passphrases and session tokens are all generated, never chosen by a person, so a single HMAC can protect them in well under the 10 ms CPU budget. That removes the reason ADR-0006 gave for rejecting our own auth. This spec builds the login decided in ADR-0029.

## Capabilities

- **CAP-1**
  - **intent:** An admin manages who may sign in, and with which role, from an Agents page, without a deploy.
  - **success:**
    - Creating a user makes them appear in `GET /api/admin/agents` straight away. Deactivating a user deletes their sessions and unused codes, and their next `/api/*` request gets a 401.
    - No user is ever deleted. A deactivated user leaves the assign menu.
    - A deactivated agent's prospects stay assigned. The deactivation dialog says how many. The Tableau de bord's À traiter list gains a fourth row, "Prospects sans agent actif {n}", whose Réassigner button opens Prospects filtered to inactive agents.
    - The Agents page shows each active user as "Inscrit" (at least one live session) or "Pas encore inscrit".
    - Trying to deactivate or demote the last active admin is refused.
- **CAP-2**
  - **intent:** An agent enrols a device by typing a one-time code an admin generated, without leaving the app.
  - **success:**
    - A code is 8 Crockford base32 characters.
    - It signs in the right user within 15 minutes and works only once.
    - A user has at most one live code. Generating a new one deletes their unused codes, so the older code gets 401.
    - A code that is expired, already used, or belongs to a deactivated user gets 401.
    - It works in an iOS web app installed on the home screen, because the code is typed in, never opened from a link.
- **CAP-3**
  - **intent:** An admin signs in with a generated passphrase, or enrols another device with a code made from one of their signed-in devices.
  - **success:**
    - The passphrase is 20 Crockford base32 characters in five groups of four (100 bits). Input is normalised like a code: case, spaces and hyphens ignored, I/L read as 1, O as 0.
    - It is shown once and can be regenerated. Regenerating it makes the old one fail.
    - No endpoint accepts a passphrase the admin chose.
    - An admin can make a code for themselves from a signed-in device, and that code enrols a new device.
- **CAP-4**
  - **intent:** Everyone signs in on one `/login` page through one `POST /api/auth/login` route.
  - **success:**
    - The body is a `zod/mini` union discriminated on `kind`: `code`, or `passphrase` with the email. Any other body gets 400.
    - A wrong email and a wrong passphrase get the same error.
    - The role always comes from `users`, never from `kind`.
    - The page shows the code field by default, with an "Accès administrateur" switch (layout per `docs/design.md`).
- **CAP-5**
  - **intent:** Each device has its own revocable session.
  - **success:**
    - The cookie has the attributes and the expiry rules in `auth-data.md`.
    - Deleting one `sessions` row signs that device out on its next request, and the user's other devices stay signed in.
    - `last_seen_at` is written at most once an hour per session.
    - Signing out deletes the current device's session.
    - The device label is a summary parsed from the User-Agent (device family and browser). The Agents page lists each user's sessions with label, enrolment date and last seen, and revokes any one of them.
- **CAP-6**
  - **intent:** The owner can always get back in as an admin, and the first admin is created this way.
  - **success:**
    - Typed in the passphrase form as `OWNER_EMAIL` plus `BREAK_GLASS`, the secret is compared with `crypto.subtle.timingSafeEqual`. It creates or reactivates `OWNER_EMAIL` as an active admin and opens a session.
    - On an empty `users` table, this creates the first admin.
- **CAP-7**
  - **intent:** Guessing codes or passphrases is throttled per IP.
  - **success:**
    - After 10 failed logins from one IP inside a 15-minute window, every further login from that IP gets 429 with `Retry-After` until the window ends, even with a valid credential. The counter is a D1 table, not the rate-limiting binding.
    - `/login` then says "Trop de tentatives depuis cette connexion. Réessayez à {heure}, ou changez de réseau." and disables the button until then.
- **CAP-8**
  - **intent:** No other site can make a state-changing request with the user's session.
  - **success:** A non-`GET` `/api` request whose `Origin` is missing or foreign gets 403, even with a valid session cookie.
- **CAP-9**
  - **intent:** A developer works locally as any seeded user.
  - **success:**
    - `DEV_USER_EMAIL` is honoured on `localhost` and `127.0.0.1` only. The role comes from the seeded `users` row.
    - On any other host, `DEV_USER_EMAIL` has no effect.
- **CAP-10**
  - **intent:** Expired auth rows do not pile up.
  - **success:** The existing daily retention cron (ADR-0023) deletes expired codes, expired sessions and old `login_attempts` rows. Its log line gives counts only.
- **CAP-11**
  - **intent:** Every reader of the roster reads `users`.
  - **success:** The assign menu and the ADR-0028 position gate decide from `users.role` and `users.active`. Neither reads `ADMIN_EMAILS` or `AGENT_EMAILS` any more.
- **CAP-12**
  - **intent:** On a 401, the field and admin clients send the user to `/login` without losing work.
  - **success:**
    - A 401 opens `/login`, and the outbox survives untouched.
    - The cached round is dropped, as today.
    - The Access logout link, the `?reconnect=1` marker and the `/cdn-cgi/` denylist entry are gone, with their tests.
- **CAP-13**
  - **intent:** Access is removed in three phases, and nobody is locked out at any point.
  - **success:** Each phase in `cutover.md` ships with the previous phase's deployed Worker still working. The Access application is deleted only once every active user shows "Inscrit". After phase 3, `jose` and the four Access and roster vars are gone from code, config and CI.
- **CAP-14**
  - **intent:** The docs, agents and skills describe the new login.
  - **success:** Every follow-up listed in `cutover.md` › Follow-ups has landed, and none of them still describes Access as the login.

## Constraints

- Never store the raw User-Agent: only the parsed summary.
- No auth library and no slow hash. Codes, passphrases and session tokens are stored as HMAC-SHA-256 under `AUTH_PEPPER`. None of them is ever stored or logged in clear (10 ms CPU, invariant 13).
- `users.email` is the primary key, lowercased. `prospects`, `visits` and `agent_positions` keep their email keys and are not re-keyed.
- Identity comes from a D1 session only, or from the verified Access JWT until phase 3 (invariant 10).
- Nothing bills: no rate-limiting binding. Auth adds one D1 read per authenticated request and at most one write per session an hour. Both fit inside D1 Free's 5M reads and 100k writes a day (invariant 1).
- Anonymous `/api/*` requests now count against the 100,000 Worker requests a day. Before phase 3, find out whether a free WAF rate-limiting rule can sit in front of `/api/auth/*`. If none can, record the residual risk in `docs/free-tier-budget.md`.
- The app shell and the admin chunk become readable without signing in, so they must never hold data.
- The sync payload does not change and `clientVersion` does not move. A 401 never clears the outbox (invariants 5, 9).
- Migrations are expand/contract. Phase 1 deploys while Access still fronts the hostname.
- Only the owner or CI sets `AUTH_PEPPER` and `BREAK_GLASS`, never the repo or an agent. Rotating `AUTH_PEPPER` signs everyone out and voids every code and passphrase, and that is accepted.
- Each follow-up doc lands in its own change.

## Non-goals

- Passkeys now. A later `kind: "passkey"` can be added without breaking anything.
- TOTP, passwords the user chooses, and any password-reset flow.
- Sending codes or sign-in links by email or any other channel.
- Signed session cookies without a `sessions` table.
- Deleting users.
- The Workers rate-limiting binding.

## Success signal

- With Access gone, an admin creates an agent on the Agents page and gives them a code. The agent types it into the installed PWA and is signed in. They appear in the assign menu and their position is stored at the next sync, all without a deploy.
- When the admin deactivates that agent, the agent's phone gets a 401 on its next request, opens `/login`, and keeps every unsent visit in the outbox.

## Assumptions

- ADR-0029 is accepted before implementation starts. It still reads "proposed".
- In phase 1, a valid session wins over the Access JWT when a request carries both.
- Break-glass failures and passphrase failures count toward the same `login_attempts` limit.
- "Se déconnecter" deletes the current device's session and opens `/login`. The ADR removes the Access logout link but does not say what replaces it.
