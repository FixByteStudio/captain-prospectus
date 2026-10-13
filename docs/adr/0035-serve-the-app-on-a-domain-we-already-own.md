# ADR-0035: Serve the app on a domain we already own

- Status: accepted
- Date: 2026-10-12
- Deciders: mohss, Claude
- Supersedes: [ADR-0012](0012-workers-dev-hostname.md). Amends: [ADR-0002](0002-zero-cost-constraint.md)
  (its "No custom domain" consequence)

## Context
[ADR-0012](0012-workers-dev-hostname.md) chose `captain-prospectus.<account>.workers.dev` because
a custom domain has to be bought and renewed, which breaks [ADR-0002](0002-zero-cost-constraint.md).

Facts since then:
- The owner already owns `fixbyte.cloud`, bought for other work and hosted on Cloudflare. A
  subdomain of it costs nothing more.
- Production runs without Cloudflare Access ([ADR-0034](0034-launch-on-our-own-login-alone.md)),
  so anonymous requests to `/api/auth/*` run the Worker and count against the 100,000 requests a
  day. [ADR-0029](0029-own-login-instead-of-cloudflare-access.md) left open whether a free
  rate-limiting rule could front those routes.
- Cloudflare rate-limiting rules belong to a zone. `workers.dev` is not a zone we control, so no
  rule can front a `workers.dev` hostname. A zone on the Free plan gets one rule, counted per IP.
- A Worker reachable on two hostnames has two front doors, and a rule on one does not cover the
  other.

## Decision
We will serve the app on `prospectus.fixbyte.cloud`, a custom domain of the zone the owner
already owns.

1. The Worker's `workers.dev` route is off, and preview URLs stay off (`preview_urls: false`), so
   that hostname is the only one.
2. The zone's rate-limiting rule fronts `/api/auth/*` on that hostname
   ([deployment](../deployment.md#one-time-setup-production)).

## Alternatives considered
| Option | Why not |
|---|---|
| Stay on `workers.dev` | No rate-limiting rule can front it, so the sign-in routes stay open to a flood from a single IP |
| Buy a domain for the app | A recurring cost, which ADR-0002 forbids |
| The Workers rate-limiting binding | ADR-0029 found no price and no Free-plan availability for it, and a request it refuses has already run the Worker and been counted |

## Consequences
- No added cost. The app now depends on a renewal it does not pay for: if `fixbyte.cloud` lapses,
  the app is unreachable.
- The zone's one free rate-limiting rule is spent on this app. Another site on the zone cannot
  have one without a paid plan.
- **Changing the hostname later is not a config change.** An installed PWA keeps its outbox, its
  cached round and its session per origin, so a phone left on the old hostname keeps visits the
  new one never sees. A move needs every outbox drained first, as a
  [fresh redeploy](../deployment.md#fresh-redeploy) does (invariant 5).
- The domain is attached in the Cloudflare dashboard only. `wrangler.jsonc` does not declare it
  yet, so the repo cannot recreate it. Follow-up: declare the route and `workers_dev: false` there.
- [free-tier-budget](../free-tier-budget.md) gets the rule's row and the remaining risk.
