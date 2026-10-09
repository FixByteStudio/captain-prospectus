# Identity & access

See [ADR-0029](../adr/0029-own-login-instead-of-cloudflare-access.md), which supersedes
[ADR-0006](../adr/0006-cloudflare-access-auth.md) in three phases. We are in phase 1: our own
login ships while Cloudflare Access still fronts the hostname.

The Worker resolves identity in this order (`requireIdentity`, `src/worker/auth.ts`):

1. **A session.** The `__Host-cp_session` cookie's token, hashed with `AUTH_PEPPER`, names a
   `sessions` row that has not expired and whose user is `active`. The role is the `users` row's.
   Without `AUTH_PEPPER` this step is skipped, never guessed. The expiry slides: a request an hour
   or more after the last slide pushes it to now + the role's lifetime (30 days admin, 90 days
   agent) and re-sends the cookie, so a device in use stays signed in. Each session carries a public
   id and a device label from the User-Agent at login; an admin revokes one device by that id from
   the Agents page, and its next request is a 401.
2. **`DEV_USER_EMAIL`**, on localhost only (below). After the session, so a developer signed in
   through `/login` is who the session says.
3. **The Access JWT**, only when `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are both set: the Worker
   **verifies** `Cf-Access-Jwt-Assertion` (or the `CF_Authorization` cookie) against the team's
   JWKS, issuer and audience. Identity = the verified email, lowercased. If that email has a `users` row, an inactive
   one is a **401** and an active one's `role` is the role; with no row, `admin` if it is in
   `ADMIN_EMAILS`, otherwise `agent`. The email header alone is never trusted. Phase 3 deletes this
   step.
4. Otherwise **401**. A Worker with neither a session nor Access configured answers 401, not 500.

Who may sign in, and as what, is managed by admins through `GET`/`POST /api/admin/users` and
`PATCH /api/admin/users/:email` ([api](../api.md#admin)). The roster (assign menu, assignee check, rounds,
dashboard rows, position gate) is the active `users` rows.

**A one-time code** enrols a device. An admin picks "Générer un code" on a user's row of the Agents
page (their own row included) and reads or sends the code: 8 Crockford base32 characters, valid
15 minutes and once ([api](../api.md#admin)). Generating a new one cancels the user's unused one, and
deactivating the user cancels it too. On `/login`'s default form the agent types it as given; the
server reads it case-insensitively, ignoring spaces and hyphens, with I/L read as 1 and O as 0
(`src/shared/credential.ts`). The code opens a session with the user's own role. A wrong, expired,
used, superseded or deactivated-user code gets the same 401. Only the code's HMAC is stored and
nothing logs it.

**Break-glass** is the admin form, behind "Accès administrateur" on `/login`. In it, `OWNER_EMAIL` (any case,
surrounding spaces ignored) with `BREAK_GLASS` (exactly as typed) creates `OWNER_EMAIL` as an active
admin, or puts it back as one, and opens a session. Both are set by the owner or CI, never in the
repo; the owner keeps `BREAK_GLASS` offline. A wrong email and a wrong secret get the same 401.
`POST /api/auth/logout` deletes the device's session.

**An admin's passphrase** is the same admin form, for everyday sign-ins. An admin picks "Nouvelle
phrase de passe" on their own row of the Agents page, and only there: after a confirmation, the
server generates 20 Crockford base32 characters (100 bits), shows them once and stores only their
HMAC ([api](../api.md#admin)). Nobody chooses a passphrase or sees another user's. Generating a new
one replaces the old at once; sessions stay. The login tries break-glass first, then the user's
passphrase, read like a code (case, spaces and hyphens ignored, I/L as 1, O as 0): it opens a
30-day admin session for an active admin whose hash matches. Demoting or deactivating a user clears
their passphrase. Every refusal — unknown email, no passphrase, deactivated, agent, wrong
passphrase — gets the same 401 after the same work, and nothing logs a passphrase or its hash.

After 10 failed logins (codes and passphrases alike) from one IP in a 15-minute window, that IP's logins get 429 until the window
ends, even a valid one. Any `/api` request other than `GET` or `HEAD` whose `Origin` is missing or
foreign gets 403, so no other site can act with a user's session ([api](../api.md)).

The nightly sweep deletes expired codes, expired sessions and `login_attempts` rows whose window has
ended ([data-model](../data-model.md)).

## Permissions
| Action | Agent | Admin |
|---|---|---|
| Sync own list, log visits, add field prospects | ✓ | ✓ |
| Read visit history of a prospect | own assigned | all |
| Import, edit, assign prospects | | ✓ |
| Edit scripts | | ✓ |
| Live visit feed | | ✓ |
| Read an agent's position of the day ([ADR-0028](../adr/0028-agent-position-at-sync.md)) | | ✓ |
| Manage users: add one, change a role, deactivate or reactivate | | ✓ |
| Generate a one-time code for any user, their own row included | | ✓ |
| Revoke one device's session | | ✓ |
| Regenerate one's own passphrase | | ✓ |

## Local development
`DEV_USER_EMAIL` in `.dev.vars` impersonates a user. It is honoured **only** when the request host is `localhost`, `127.0.0.1` or `[::1]`, and only after a session cookie, which wins. The role comes from that email's `users` row; no row, or an inactive one, is a 401 with no fallback to Access. `pnpm db:seed:local` inserts `admin@example.com` (admin) and `agent@example.com` (agent), and never changes a row that already exists.

## Offline and session expiry
Sessions expire or are revoked. The app shell is cached by the service worker, so the agent can keep working offline. When a sync gets a 401, a 403 or an Access redirect, the band's session-expired strip shows and offers "Se reconnecter"; the cached round is dropped (below) and the outbox stays intact either way.

**The Worker's own 401 and an Access redirect are told apart** (`apiFetch`: a plain 401 status against `response.type === "opaqueredirect"`; both are `ApiError` status 401, with `code` `unauthorized` or `access_redirect`). The Worker's 401 means `/login` is the way back: at launch the app drops the cache as below and opens `/login` (`replace`), the sync strip's button opens `/login` through the leave guard (so a dirty form asks first), and any admin query, mutation or CSV export that gets one opens `/login`. Nothing on these paths touches the outbox. An Access redirect keeps the marker navigation below. `/login` asks `/api/me` once on mount: a device that still has an identity goes to its landing; a 401, an Access redirect or a network error leaves the form.

**For an Access redirect, "Se reconnecter" is a marker navigation, not a reload.** The service worker serves every ordinary navigation from precache (`navigateFallback`), which never reaches Access, so a plain reload cannot re-authenticate. The button instead navigates to the current URL plus `?reconnect=1`, an entry `navigateFallbackDenylist` excludes from that fallback (`vite.config.ts`), so this one navigation goes to the network and through Access; the app strips the marker back out of the URL once it has landed (`docs/design.md` § "Sync is ambient, never a toast"). The outbox is untouched either way — INVARIANT 5.

**The admin top bar's "Se déconnecter" (GH #64, #309)** calls `POST /api/auth/logout`, then asks `/api/me` once. If it still answers, Access is signing this device in, so the page is sent to `/cdn-cgi/access/logout` with `window.location` (a SPA navigation never leaves `App.tsx`, and `navigateFallbackDenylist` excludes `/^\/cdn-cgi\//`, GH #76, so that request reaches Access instead of the precached shell). Otherwise the session was all there was and the app opens `/login`. If the POST never reaches the server the menu stays put and a toast says so: the cookie would survive, and `/login` would send the user straight back to their landing. The `?reconnect=1` marker, the `/cdn-cgi/` denylist entry and the Access logout path stay until Access is gone (phase 3).

**The app shell itself has the same offline fallback, with the same limit.**
On load it calls `GET /api/me`; if that genuinely cannot be reached (no network
route to the Worker at all), it falls back to the last identity Dexie cached
and opens the field screens from what the phone already has. It does **not**
fall back on a 401 — that is the Worker answering that the session is no
longer valid, which is different from being unreachable, and is exactly the
"stolen phone" mitigation in [security.md](../security.md) (an admin revokes
the device's session or deactivates the user; the next `/api/me` the phone
manages to send comes back 401, not cached-and-accepted). The Worker's 401 opens `/login`
(above). An Access redirect shows the error with the same "Se reconnecter"
marker navigation as the sync strip (GH #75): a reload would come back from
precache and straight into the same redirect.

**A 401 also deletes the cache, not merely declines to read it.** Refusing the
fallback on its own would leave the mitigation one aeroplane-mode toggle wide:
with the cached identity still on disk, the next launch with no network takes
the unreachable branch above and hands the revoked phone its round back. So the
401 path calls `clearAgentCache` (`src/client/field/db.ts`), which drops the
cached identity, the cached round and the cached visit history together. The
outbox survives it — a revoked session is not the server listing those rows in
`accepted`, and INVARIANT 5 says only that may delete them.

**A refused sync clears it too.** A PWA resumed from the app switcher does not
remount, so it never re-asks `/api/me`. `runSync` therefore calls
`clearAgentCache` on every refusal it reports, as `unauthorized` (the Worker's
401) or `auth` (a 403 or an Access redirect). An expired session and a revoked
one look the same from the phone (GH #35). A network failure clears nothing. An agent online with an
expired session sees an empty round until "Se reconnecter" brings it back.

**The cached identity opens the field side only.** An admin identity read from
the cache never unlocks the Tableau de bord tab or the admin routes — only a
live `/api/me` answer does (invariant 10). A session that started this way
re-asks `/api/me` itself once the network is confirmed live, rather than
waiting for a reload: `App.tsx` tracks the browser's own `online`/`offline`
state for as long as it runs (`useOnline`), and re-checks whenever that state
reads live *while* the identity is still cache-sourced — which fires at once
if the network was already reporting live when the cache fallback happened
(a Worker error or a captive portal, not a browser-visible disconnection), not
only after a later `online` event. A confirmed admin regains the tab and the
admin screens the moment that re-check lands (spec-gh-115,
`field/identity.ts`'s `adminAccess`). A session the server already confirmed
never re-checks — going offline and back costs it nothing.

The cached identity is a rendering convenience, never proof: the Worker
re-derives identity on every request from the session (or, in phase 1, the
verified Access JWT) regardless of what the client claims to be. Its only other effect is that if the identity that
comes back from a successful `/api/me` names a **different** email than the
cached one — a different agent has signed in on this device — the locally
cached round (`prospects`) and cached visit history are cleared before
anything renders — the same `clearAgentCache` the 401 path uses — so one agent
never sees another's list from cache. The
outbox is never cleared this way (INVARIANT 5), and it is not sent under the new
identity either: every outbox row is stamped with the email that wrote it, and
`runSync` holds back rows stamped by anyone else until that agent signs in
again (`docs/domains/field-operations.md#local-store-dexie`, backlog 005).

**A cache-sourced session is unconfirmed, and syncs nothing until a live
`/api/me` says otherwise (docs/backlog/013).** The cached email is a rendering
convenience, not proof of whose session cookie the next request will
actually carry — if agent B signs in with a code on agent A's phone and
that launch's `/api/me` hits a network blip or a 5xx, `resolveIdentity` falls
back to A's cached identity (above) while the cookie is really B's. Backlog
005 stamps every outbox row with the identity active when it was written, but
a *cache-sourced* identity is exactly the one case that stamp cannot answer
for. So while `identityFromCache` is true, `SyncProvider`
(`src/client/field/useSync.tsx`) never calls `runSync`: every one of the four
triggers re-asks `/api/me` instead (`App.tsx`'s `recheckIdentity`), and the
band shows `"unconfirmed"` — distinct from `"offline"`, since the network may
well be up; confirming itself then runs a sync at once, rather than waiting
for the next trigger. A row written in the meantime (`queueVisit`, the
add-prospect write) is stamped `writtenBy` the cached email **and**
`unconfirmed: true`. `sendableBy` never sends such a row, whoever asks — but
it still counts toward the agent's own pending total and today's progress
(`writtenByOrUnstamped`, `src/client/field/outbox-stamp.ts`): it is their own
not-yet-sendable work, not another agent's, and the `"unconfirmed"` status is
what already says why it has not gone out.

**Confirming re-stamps every `unconfirmed` row it finds, on every live
`/api/me` — not only when *this* session happened to open cache-sourced.** A
row can be left `unconfirmed` by a launch that ends (network lost, app
killed) before its own confirmation lands; the next launch, even one whose
first answer comes back live immediately, must still pick it up, or
`sendableBy` refuses it from every identity for good. So `confirmOutbox`
(`src/client/field/db.ts`) runs on every live, non-cached answer — outbox and
the `sentVisits` log alike, in one transaction, re-stamping to the email that
answer names and dropping the flag — before `SyncProvider` is told the
identity is confirmed; it is a no-op once nothing is left flagged, so calling
it unconditionally costs nothing. `SyncProvider` runs it once more itself,
keyed on `confirmed` turning true, as a backstop for a row saved in the
narrow window between that call and the state actually landing. On a 401 the
cookie cannot confirm *anyone*, so nothing is re-stamped to a single "current"
identity (there may be flagged rows from more than one cache-sourced launch);
`releaseUnconfirmed` instead only drops the flag, letting each row's own
already-stamped `writtenBy` — the cached email it was written under — take
back over, held back from anyone else exactly like an ordinary confirmed row
(backlog 005). **Residual:** a phone that changes hands again while still
unconfirmed — offline from one launch to the next — re-stamps both sessions'
queued rows to whoever confirms first; narrower than before this task, since
nothing sends until some launch confirms, but not closed. An identity switch
(`identitySwitched`, above) also clears `sentVisits` before confirming, so a
row the new agent queued while still unconfirmed loses its progress-count
entry even though the outbox row itself survives untouched (INVARIANT 5) —
the log is read-only rendering, not a queued write, so nothing is lost that
matters to sync.
