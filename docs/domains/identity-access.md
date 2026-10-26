# Identity & access

See [ADR-0029](../adr/0029-own-login-instead-of-cloudflare-access.md), which supersedes
[ADR-0006](../adr/0006-cloudflare-access-auth.md). Our own login is the only way in
([ADR-0034](../adr/0034-launch-on-our-own-login-alone.md)).

The Worker resolves identity in this order (`requireIdentity`, `src/worker/auth.ts`):

1. **A session.** The `__Host-cp_session` cookie's token, hashed with `AUTH_PEPPER`, names a
   `sessions` row that has not expired and whose user is `active`. The role is the `users` row's.
   Without `AUTH_PEPPER` this step is skipped, never guessed. The expiry slides: a request an hour
   or more after the last slide pushes it to now + the role's lifetime (30 days admin, 90 days
   agent) and re-sends the cookie, so a device in use stays signed in. Each session carries a public
   id and a device label from the User-Agent at login; an admin revokes one device by that id from
   the Utilisateurs page, and its next request is a 401.
2. **`DEV_USER_EMAIL`**, on localhost only (below). After the session, so a developer signed in
   through `/login` is who the session says.
3. Otherwise **401**.

Who may sign in, and as what, is managed by admins through `GET`/`POST /api/admin/users` and
`PATCH /api/admin/users/:email` ([api](../api.md#admin)). The roster (assign menu, assignee check, rounds,
dashboard rows) is the active **agents**, never an admin. `/api/agent/*` answers 403 to an admin (`requireAgent`, [ADR-0037](../adr/0037-admins-leave-the-field-side.md)).

**A one-time code** enrols a device. An admin picks "Générer un code" on an active user's row of the
Utilisateurs page, on either tab (their own row included) and reads or sends the code: 8 Crockford base32 characters, valid
24 hours for an agent and 1 hour for an admin, and once ([ADR-0039](../adr/0039-a-codes-lifetime-depends-on-its-role.md)) ([api](../api.md#admin)). Generating a new one cancels the user's unused one, and
deactivating the user cancels it too. On `/login`'s default form the agent types it as given (an admin's code is refused there); the
server reads it case-insensitively, ignoring spaces and hyphens, with I/L read as 1 and O as 0
(`src/shared/credential.ts`). A code opens a session only on the form of its user's role, with that role's lifetime. A wrong, expired,
used, superseded or deactivated-user code gets the same 401. Only the code's HMAC is stored and
nothing logs it.

**Minting is not recorded.** An admin can generate a code for any active user, an agent or another
admin, and sign in as them on that user's form. Nothing records who generated a code or that it was
used this way; the only trace is the new device on the user's row of Utilisateurs
([ADR-0038](../adr/0038-admins-sign-in-with-an-email-and-a-code.md)).

**Break-glass** is the admin form, behind "Accès administrateur" on `/login`. In it, `OWNER_EMAIL` (any case,
surrounding spaces ignored) with `BREAK_GLASS` (exactly as typed) creates `OWNER_EMAIL` as an active
admin, or puts a deactivated admin owner back as active, and opens a session. It never touches an
agent: roles are fixed at creation, so an `OWNER_EMAIL` that names an agent row, active or not, gets
the same 401 as any refusal and nothing is written (no `users` change, no session, no cookie). Both
are set by the owner or CI, never in the repo; the owner keeps `BREAK_GLASS` offline. A wrong email
and a wrong secret get the same 401.
`POST /api/auth/logout` deletes the device's session.

**An admin's code** is the same admin form, for everyday sign-ins ([ADR-0038](../adr/0038-admins-sign-in-with-an-email-and-a-code.md)).
An admin generates a code on their own row of the Utilisateurs page, or another admin does, and types
it with their email under "Accès administrateur". Each form serves one role: the agent form accepts
only an active agent's code, the admin form only an active admin's code whose user is the email typed.
The role check sits in the statement that spends the code, so a code typed on the wrong form is
refused and stays live for the right one. Every refusal (wrong form, wrong email, wrong, expired or
used code) gets the same 401 and counts against the throttle. The login tries break-glass first, on
the text as typed.

After 10 failed logins (every kind alike) from one IP in a 15-minute window, that IP's logins get 429 until the window
ends, even a valid one. Any `/api` request other than `GET` or `HEAD` whose `Origin` is missing or
foreign gets 403, so no other site can act with a user's session ([api](../api.md)).

The nightly sweep deletes expired codes, expired sessions and `login_attempts` rows whose window has
ended ([data-model](../data-model.md)).

## Permissions
| Action | Agent | Admin |
|---|---|---|
| Sync own list, log visits, add field prospects ([ADR-0037](../adr/0037-admins-leave-the-field-side.md)) | ✓ | |
| Read visit history of a prospect | own assigned | |
| Import, edit, assign prospects | | ✓ |
| Edit scripts | | ✓ |
| Live visit feed | | ✓ |
| Read an agent's position of the day ([ADR-0028](../adr/0028-agent-position-at-sync.md)) | | ✓ |
| Manage users: add one, with a role fixed at creation ([ADR-0037](../adr/0037-admins-leave-the-field-side.md)); deactivate or reactivate | | ✓ |
| Generate a one-time code for any user, their own row included | | ✓ |
| Revoke one device's session | | ✓ |

## Local development
`DEV_USER_EMAIL` in `.dev.vars` impersonates a user. It is honoured **only** when the request host is `localhost`, `127.0.0.1` or `[::1]`, and only after a session cookie, which wins. So on localhost with it set, « Se déconnecter » ends the session and `/login` signs you straight back in as that user; unset it to try the login. The role comes from that email's `users` row; no row, or an inactive one, is a 401. `pnpm db:seed:local` inserts `admin@example.com` (admin) and `agent@example.com` (agent), and never changes a row that already exists.

## Offline and session expiry
Sessions expire or are revoked. The app shell is cached by the service worker, so the agent can keep working offline. When a sync gets a 401 or a 403, the band's session-expired strip shows and offers "Se reconnecter", which opens `/login`; the cached round is dropped (below) and the outbox stays intact either way.

**One 401 means a lost session** (`apiFetch`: a plain 401 status, `ApiError` status 401, code `unauthorized`). It means `/login` is the way back: at launch the app drops the cache as below and opens `/login` (`replace`), the re-check of a cache-started session does the same through the leave guard (drop and jump wait for "Quitter"; "Annuler" keeps the form), the sync strip's button opens `/login` through the leave guard (so a dirty form asks first), and any admin query, mutation or CSV export that gets one opens `/login`. Nothing on these paths touches the outbox. `apiFetch` and `downloadCsv` keep `redirect: "manual"` as a guard: a redirect comes back opaque and is an ordinary failure (`ApiError` status 0, code `error`, the caller's failure message), never read as a lost session. `/login` asks `/api/me` once on mount: a device that still has an identity goes to its landing; a 401, an opaque redirect or a network error leaves the form.

**The sync strip's "Se reconnecter" opens `/login`** by router navigation, through the leave guard, so it needs no network (GH #470). A 403 at sync is read as a 401 (it comes from the cross-origin check or from `requireAgent` refusing an admin session, and the client treats both alike); a redirect comes back opaque and is an ordinary failed sync, with the cache kept. The outbox is untouched either way — INVARIANT 5.

**The identity-error frame has no button.** It shows only the errors with no way back, such as a phone that has never reached the server; a 401 never reaches it.

**The admin top bar's "Se déconnecter" (GH #64, #309)** calls `POST /api/auth/logout`, then opens `/login` by router navigation, without asking `/api/me` (GH #468). A 401 on the POST means there was no session left to end, so it opens `/login` too. If the POST never reaches the server the menu stays put and a toast says so: the cookie would survive, and `/login` would send the user straight back to their landing.

**The app shell itself has the same offline fallback, with the same limit.**
On load it calls `GET /api/me`; if that genuinely cannot be reached (no network
route to the Worker at all), it falls back to the last identity Dexie cached
and opens the field screens from what the phone already has. It does **not**
fall back on a 401 — that is the Worker answering that the session is no
longer valid, which is different from being unreachable, and is exactly the
"stolen phone" mitigation in [security.md](../security.md) (an admin revokes
the device's session or deactivates the user; the next `/api/me` the phone
manages to send comes back 401, not cached-and-accepted). The 401 opens `/login`
(above).

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
`clearAgentCache` on every refusal it reports, as `unauthorized` (a 401 or a 403). An expired session and a revoked
one look the same from the phone (GH #35). A network failure clears nothing. An agent online with an
expired session sees an empty round until "Se reconnecter" brings it back.

**One role, one side (ADR-0037).** An admin gets `/admin/*` and nothing else:
`/`, `/round/*` and any other path redirect to `/admin`, online or not, so
`/login` and the installed PWA (`start_url` `/`) land there too. An admin runs
no sync. An agent gets the field side, and `/` opens `/round`.

**A cached identity opens no admin route.** An admin identity read from the
cache gets the Hors ligne screen below, never the admin frame — only a live
`/api/me` answer opens it (invariant 10). A session that started this way
re-asks `/api/me` itself once the network is confirmed live, rather than
waiting for a reload: `App.tsx` tracks the browser's own `online`/`offline`
state for as long as it runs (`useOnline`), and re-checks whenever that state
reads live *while* the identity is still cache-sourced — which fires at once
if the network was already reporting live when the cache fallback happened
(a Worker error or a captive portal, not a browser-visible disconnection), not
only after a later `online` event. A confirmed admin gets the admin frame the
moment that re-check lands, at the same URL. A session the server already confirmed
never re-checks — going offline and back costs it nothing.

**On a cached identity, an `/admin/*` route says it needs the network, not
that access is denied** (GH #209): "Hors ligne. Cette page a besoin du réseau.
Votre tournée reste accessible.", with "Retour à la tournée", in the field
band. "Vous n'avez pas accès à cette page." is kept for a role the server
confirmed. A cached **agent** gets the page above. A cached **admin** gets the
Hors ligne screen instead (ADR-0037, R6, `auth/AdminOfflineScreen.tsx`): «
Vous êtes hors ligne », « Le tableau de bord a besoin du réseau. Reconnectez-vous
puis réessayez. » and one « Réessayer » button that re-runs the identity check
(« Vérification… » while it runs; a 401 still opens `/login`), outside the field
frame and with no link to the round. A « Réessayer » that gets no live answer adds the line
« Toujours hors ligne. Réessayez quand la connexion revient. », so the press is not silent. The
cached role only picks which *offline* screen renders; it opens nothing, and it never says
"access denied". When `/api/me` failed with the browser online (a Worker error, a captive
portal), the cached **admin** gets the same screen in its *unreached* wording: « Le serveur ne
répond pas », « Le tableau de bord n'a pas pu joindre le serveur. Réessayez dans un instant. » and,
after a failed « Réessayer », « Le serveur ne répond toujours pas. Réessayez dans un instant. ».
The cached **agent** keeps the page above in that case. With an identity cached, the gate gives `/api/me` 10 s
(`IDENTITY_TIMEOUT_MS`) and then treats it as unreachable, so a hang reaches this screen too; a
first run with nothing cached keeps waiting.

**A failed admin chunk gets the same Hors ligne screen** (`auth/AdminChunkBoundary.tsx`): a live
admin whose `AdminApp-*.js` request fails, offline or on a stale hash after a deploy, sees it with
the offline wording whatever the browser's online flag says, and « Réessayer » imports the chunk
again and opens the admin at the same URL, with no reload. The chunk stays out of the precache
([ADR-0019](../adr/0019-admin-chunk-out-of-the-precache.md)).

The cached identity is a rendering convenience, never proof: the Worker
re-derives identity on every request from the session regardless of what the client claims to be. Its only other effect is that if the identity that
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
(`src/client/field/db.ts`) runs on every live, non-cached answer — every outbox
table, in one transaction, re-stamping to the email that
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
nothing sends until some launch confirms, but not closed.
