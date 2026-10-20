# ADR-0038: Admins sign in with an email and a code

- Status: proposed
- Date: 2026-10-19
- Deciders: owner
- Amends: [ADR-0029](0029-own-login-instead-of-cloudflare-access.md) (decisions 3, 5 and 7, and the
  passphrase in decisions 1 and 4)

## Context

**Two credentials, two ways to manage them.** ADR-0029 decision 3 gives an admin a generated
passphrase: 20 Crockford characters, shown once from « Nouvelle phrase de passe », stored as
`users.passphrase_hash`. Agents sign in with a one-time code (decision 2). The code route
(`POST /api/admin/users/:email/code`) already serves any active user, an admin's own row included,
so an admin can already enrol a device with a code. The passphrase is a second secret to show,
store, regenerate and clear on demotion (`identity.ts`), with its own dialog, schema, copy and
branch in `auth.ts`.

**The two forms do not check the role.** The agent form sends `kind: "code"`, and a code opens a
session with whatever role its user has, so an admin's code works on it. Decision 5 says `kind`
names the credential, never the role.

**Break-glass lives in the admin form** (decision 7): `OWNER_EMAIL` plus the raw `BREAK_GLASS`,
compared as typed before any normalising, tried before the passphrase. It is the only way in when
no admin is signed in anywhere ([ADR-0034](0034-launch-on-our-own-login-alone.md)).

Other facts:
- The owner wants one kind of credential, and two forms that stay two doors (initiative
  admin-field-separated, R9–R11; epic note 2026-10-19: the owner declined a single code field).
- Roles are fixed at creation and admins do no tournée
  ([ADR-0037](0037-admins-leave-the-field-side.md)), so a form names the one role it serves.
- The data stage is disposable (CLAUDE.md): dropping `passphrase_hash` needs no backfill.
- `/api/auth/login` is not the sync contract: `CLIENT_VERSION` does not move.
- Nothing new is called or billed ([ADR-0002](0002-zero-cost-constraint.md)). A code costs one
  HMAC, as a passphrase did, well inside the 10 ms CPU budget.

## Decision

We will **sign admins in with their email and a one-time code, and remove the passphrase.**

1. **One credential.** Every user, admin or agent, signs in with a one-time code as ADR-0029
   decision 2 defines it (format, lifetime, normaliser and « one live code » unchanged). An admin
   gets one from their own row on Utilisateurs, on a device already signed in, or from another
   admin. The passphrase goes: `users.passphrase_hash`, `POST /api/admin/me/passphrase`, the
   dialog, its schema and copy.
2. **Each form checks the role.** `POST /api/auth/login` keeps one route and a `zod/mini` union:
   - `{ kind: "code", code }`: the agent form. It accepts only an active **agent**'s code.
   - `{ kind: "admin", email, code }`: the admin form, behind « Accès administrateur ». It accepts
     only an active **admin**'s code whose user is the email typed.

   Anything else — an admin's code on the agent form, an agent's code on the admin form, another
   admin's code, a wrong email — gets the same 401 as a wrong code. The role check sits in the
   conditional UPDATE that spends the code, so a refused code is **not** spent and still works on
   the right form. Every refusal counts against the per-IP throttle (decision 8, unchanged).
   This replaces decision 5's « `kind` names the credential, never the role »: a kind now names
   the form, and each form serves one role. A later `passkey` kind stays additive.
3. **Break-glass stays in the admin form, tried first.** If the email is `OWNER_EMAIL` and the
   code field, as typed, matches `BREAK_GLASS` (`timingSafeEqual` over HMACs, as today), it
   creates or reactivates the owner as an active admin and opens a session. Only otherwise is the
   field normalised and spent as a code. A real code and `BREAK_GLASS` cannot both match in
   practice, so the order only fixes which comparison sees the raw text. Decision 7 is otherwise
   unchanged.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep the passphrase beside codes (ADR-0029 as written) | Two credentials to explain, show, store and revoke, and the owner wants one; a code from a signed-in device already covers an admin's new device |
| Codes only, one field for everyone, the role read from `users` | ADR-0029 did not weigh it. One door is simpler, but an admin's code typed on an agent's phone opens an admin session there; the owner declined it (2026-10-19) |
| Infer the form from the body (`code` with or without `email`) | Same behaviour with a less explicit contract: a stray `email` changes which role is accepted |
| Move break-glass out of the admin form (its own route or URL) | A second unauthenticated door to throttle and test, for a path used a few times a year |
| Passkeys for admins now | Still a few hundred lines with no auth library (ADR-0029). Kept as a later `kind` |

## Consequences

- One credential everywhere: a grep for `passphrase` in `src` finds nothing, and one migration
  drops `passphrase_hash`.
- The two forms are two doors: a code works only on its role's form, so an admin session never
  opens from the field form.
- **Harder:** an admin with no signed-in device needs another admin, or break-glass if they are
  the only one. While the owner is the sole admin, every lost or expired admin session (30 days
  idle) ends in break-glass, so it is typed more often than ADR-0029 expected; the owner keeps it
  offline and rotates it if it is ever seen.
- **Harder:** a password manager can fill the email but not the code, so each new admin device
  costs a trip to a signed-in one.
- A code typed on the wrong form stays live, so the user retries on the right form without asking
  for a new one; the attempt still counts against the throttle.
- ADR-0029's decisions 1 and 4 lose their passphrase mentions with this change; decision 12
  stays amended by ADR-0034.
- Follow-up stories, cut once this is accepted: the role-checked login and the `admin` kind; the
  admin form and the code dialog (« Code pour {name} » tells an admin to use Accès administrateur
  with their email); removing the passphrase and its column. Each updates `docs/design.md` (the
  login page), `docs/domains/identity-access.md`, `docs/api.md`, `docs/data-model.md`,
  `docs/security.md` or `docs/deployment.md` as it ships.
