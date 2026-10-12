# ADR-0034: Launch on our own login alone, with no Cloudflare Access phase

- Status: accepted
- Date: 2026-10-12
- Deciders: mohss, Claude
- Amends: [ADR-0029](0029-own-login-instead-of-cloudflare-access.md) (decision 12)

## Context
[ADR-0029](0029-own-login-instead-of-cloudflare-access.md) decision 12 cuts over in three phases:
ship the login while Access still fronts the hostname, enrol every user and delete the Access
application, then remove the JWT check from the code. Phases 1 and 2 exist so that nobody who
signs in through Access is locked out.

Nobody did. Production was first deployed on 2026-10-12, with the login already built and no
user, session or installed phone before it. No Access application was ever created.

Other facts:
- The Worker's Access fallback (`identityFromAccess`, `src/worker/auth.ts`) returns null when
  `ACCESS_TEAM_DOMAIN` or `ACCESS_AUD` is empty. Both are empty in `wrangler.jsonc`, so the
  fallback never runs in production.
- [ADR-0033](0033-rollout-rules-wait-for-protected-data.md) already lists that fallback as code
  written only for rollout.
- Setting Access up costs a Zero Trust onboarding, a policy to keep in step with `users`, and a
  second sign-in for every agent (an emailed PIN, then their code), all to be undone in phase 2.
- Without Access, anonymous requests run the Worker and count against the 100,000 requests a day
  of Workers Free ([ADR-0002](0002-zero-cost-constraint.md),
  [free-tier-budget](../free-tier-budget.md)).

## Decision
We will run production on our own login alone. No Cloudflare Access application is created.

1. Phases 1 and 2 of ADR-0029 decision 12 are dropped: there is no Access session to migrate.
2. Phase 3 stays, as `epic-access-removed`: a change removes the JWT check, `jose`, the
   `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS` and `AGENT_EMAILS` vars, the `?reconnect=1`
   marker, the `/cdn-cgi/` denylist entry and the Access logout link. It no longer waits for
   anyone to enrol.
3. Until then the four vars stay empty, and nothing sets them.

## Alternatives considered
| Option | Why not |
|---|---|
| Follow the three phases as written | Sets up Access, a policy and a double sign-in for users who do not exist, then removes them |
| Keep Access for good, as a shield in front of the login | Brings back what ADR-0029 removed: a third party between the agents and the app, and a second roster to maintain |
| Remove the fallback code before the first deploy | Delays the launch for code that cannot run with empty vars. It is its own change |

## Consequences
- The first deploy needs no Zero Trust setup, and an agent signs in once, inside the app.
- `BREAK_GLASS` is the only way in when the login fails. There is no second system to fall back on.
- The app shell, the admin chunk and `/login` are readable by anyone from the first day. They
  hold no data, and that must stay true.
- The request quota is exposed from the first day. A zone rate-limiting rule in front of
  `/api/auth/*` limits each IP ([ADR-0035](0035-serve-the-app-on-a-domain-we-already-own.md)); a
  flood from many IPs can still exhaust the day's quota and stop the app until midnight UTC.
  Nothing bills.
- Docs that describe how the fallback behaves (`identity-access.md`, `api.md`, `data-model.md`,
  `design.md`) stay as they are until the code goes: they describe code that still exists.
- Follow-up, each in its own change: `epic-access-removed` shrinks to the removal above, and the
  own-login spec's `cutover.md` and the tickets that say "with Access still in front" are updated.
