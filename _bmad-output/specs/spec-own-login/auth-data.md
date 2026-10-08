# Auth data, secrets and cookie

Column names are indicative. `docs/data-model.md` and the Drizzle schema own the final shape.

## Tables (D1)

| Table | Holds | Rules |
|---|---|---|
| `users` | `email` (PK, lowercased), `name`, `role` (`admin` \| `agent`), `active`, `passphrase_hash` (admins only: 20 Crockford base32 chars, 100 bits) | Deactivated, never deleted. The last active admin cannot be deactivated or demoted. |
| `login_codes` | code hash, user, `expires_at`, used marker | 8 chars of Crockford base32 (40 bits), valid 15 min, single use. At most one live code per user: a new code deletes the unused ones. Deleted when the user is deactivated. |
| `sessions` | token hash, user, device label, `created_at`, `last_seen_at`, `expires_at` | The device label is a parsed User-Agent summary (device family and browser), never the raw string. Sliding expiry: 90 days idle for an agent, 30 for an admin. `last_seen_at` is written at most once an hour. Deleted when the user is deactivated. |
| `login_attempts` | IP, 15-minute window, failure count | After 10 failures, that IP is refused until the window ends. |

Every hash is HMAC-SHA-256 under `AUTH_PEPPER`. The nightly sweep (ADR-0023 cron) deletes expired `login_codes`, expired `sessions` and old `login_attempts` rows.

## Session cookie

`__Host-` prefix, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`. The value is a random token, and only its hash is stored. Every `/api` request looks up the session and its active user.

## Vars and secrets

| Name | Kind | Set by | Lifetime |
|---|---|---|---|
| `AUTH_PEPPER` | secret | owner / CI | permanent. Rotating it voids every code, passphrase and session |
| `BREAK_GLASS` | secret | owner / CI, also kept offline by the owner | permanent |
| `OWNER_EMAIL` | var | owner / CI, never the repo | permanent |
| `DEV_USER_EMAIL` | `.dev.vars` | developer | local only, honoured on `localhost` and `127.0.0.1` |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS`, `AGENT_EMAILS` | var | — | removed in phase 3 |

## Login request

`POST /api/auth/login` takes a `zod/mini` discriminated union on `kind`:
- `{ kind: "code", code }`
- `{ kind: "passphrase", email, passphrase }`. Break-glass also uses this kind: `OWNER_EMAIL` with `BREAK_GLASS` as the passphrase. The email field lets password managers save and autofill the passphrase.

Codes and passphrases share one normaliser (case, spaces and hyphens ignored; I/L → 1, O → 0). A wrong email and a wrong passphrase get the same 401. A locked-out IP gets 429 with `Retry-After`. The exact fields are owned by `docs/api.md`. Adding `kind: "passkey"` later is an additive change.
