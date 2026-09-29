# Identity & access

See [ADR-0006](../adr/0006-cloudflare-access-auth.md).

- Login is handled by **Cloudflare Access** (email one-time PIN) in front of the Worker.
- The Worker **verifies** the `Cf-Access-Jwt-Assertion` JWT (signature via the team's JWKS, issuer, audience). The email header alone is never trusted.
- Identity = verified email, lowercased.
- Role: `admin` if the email is in `ADMIN_EMAILS`, otherwise `agent`. The Access policy decides who is allowed in at all.

## Permissions
| Action | Agent | Admin |
|---|---|---|
| Sync own list, log visits, add field prospects | ✓ | ✓ |
| Read visit history of a prospect | own assigned | all |
| Import, edit, assign prospects | | ✓ |
| Edit scripts | | ✓ |
| Live visit feed | | ✓ |

## Local development
`DEV_USER_EMAIL` in `.dev.vars` impersonates a user. It is honoured **only** when the request host is `localhost` or `127.0.0.1`.

## Offline and session expiry
Access sessions expire. The app shell is cached by the service worker, so the agent can keep working offline. When a sync gets a 401, a 403 or an Access redirect, the band's session-expired strip shows and offers "Se reconnecter"; the cached round is dropped (below) and the outbox stays intact either way.

**"Se reconnecter" is a marker navigation, not a reload.** The service worker serves every ordinary navigation from precache (`navigateFallback`), which never reaches Access, so a plain reload cannot re-authenticate. The button instead navigates to the current URL plus `?reconnect=1`, an entry `navigateFallbackDenylist` excludes from that fallback (`vite.config.ts`), so this one navigation goes to the network and through Access; the app strips the marker back out of the URL once it has landed (`docs/design.md` § "Sync is ambient, never a toast"). The outbox is untouched either way — INVARIANT 5.

**The admin top bar's "Se déconnecter" (GH #64) hits the same wall the other way round.** It is a plain `<a href="/cdn-cgi/access/logout">`, not a router `Link`: a SPA navigation never leaves `App.tsx`, and a normal `<a>` click would still be swallowed by `navigateFallback`. `navigateFallbackDenylist` also excludes `/^\/cdn-cgi\//` (GH #76) so this one anchor's click reaches the network and Access's own logout endpoint instead of the precached shell.

**The app shell itself has the same offline fallback, with the same limit.**
On load it calls `GET /api/me`; if that genuinely cannot be reached (no network
route to the Worker at all), it falls back to the last identity Dexie cached
and opens the field screens from what the phone already has. It does **not**
fall back on a 401 — that is the Worker answering that the session is no
longer valid, which is different from being unreachable, and is exactly the
"stolen phone" mitigation in [security.md](../security.md) (an admin removes
the email from the Access policy; the next `/api/me` the phone manages to send
comes back 401, not cached-and-accepted). A 401 shows the error with the same
"Se reconnecter" marker navigation as the sync strip (GH #75): a reload would
come back from precache and straight into the same 401.

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
`clearAgentCache` on every response it reports as `auth` — a 401, a 403 or an
Access redirect, since an expired session and a revoked one look the same from
the phone (GH #35). A network failure clears nothing. An agent online with an
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
re-derives identity from the verified JWT on every request regardless of what
the client claims to be. Its only other effect is that if the identity that
comes back from a successful `/api/me` names a **different** email than the
cached one — a different agent has signed in on this device — the locally
cached round (`prospects`) and cached visit history are cleared before
anything renders — the same `clearAgentCache` the 401 path uses — so one agent
never sees another's list from cache. The
outbox is never cleared this way (INVARIANT 5), and it is not sent under the new
identity either: every outbox row is stamped with the email that wrote it, and
`runSync` holds back rows stamped by anyone else until that agent signs in
again (`docs/domains/field-operations.md#local-store-dexie`, backlog 005).

**A cache-sourced session is unconfirmed** ([backlog
013](../backlog/013-sync-identity-from-cache.md)). The cache is read only
because `/api/me` could not be reached — a network blip or a Worker 5xx falls
back to it the same as a genuine offline launch — so the Access cookie the
next request will actually carry is not something the cache can name. Rather
than trust it, `SyncProvider` sends nothing while the identity is
cache-sourced: every sync trigger re-asks `/api/me` instead, and any visit or
field prospect saved in the meantime is written with `unconfirmed: true`
alongside its `writtenBy` stamp. The first live `/api/me` re-stamps every such
row — outbox and the `sentVisits` log alike — to the email it names, in one
Dexie transaction, before that identity's first sync runs; a 401 drops the
flag instead and keeps the cached email, since an expired cookie cannot
confirm anyone. This runs on every live answer, not only the first one inside
a single page load, because a phone closed while still unconfirmed leaves
flagged rows for the *next* launch's live answer to pick up.

The residual this accepts, stated plainly: **every session that starts
offline is unconfirmed for as long as it stays offline**, however long that
is — not only the brief window until the next live answer. If a phone changes
hands while still unconfirmed (agent A works offline, hands it to agent B,
who keeps working offline), and the phone's next live `/api/me` names B
because B is the one who eventually gets a signal, that answer confirms
*every* unconfirmed row on the device to B — including the visits A logged
before the hand-over — and B's next sync sends them under B's name. Narrower
than the window backlog 013 closes (a confirmed sync filing rows under the
wrong agent from a single stale cache read), because it needs an actual
device hand-over during an unconfirmed stretch rather than one unlucky
`/api/me` failure, and out of scope for backlog 013 — see its "Out of scope"
for why narrowing the cache fallback further does not close it either.
