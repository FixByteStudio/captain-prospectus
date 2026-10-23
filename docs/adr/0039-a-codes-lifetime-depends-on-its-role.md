# ADR-0039: A code's lifetime depends on its role

- Status: accepted
- Date: 2026-10-23
- Deciders: owner
- Amends: [ADR-0029](0029-own-login-instead-of-cloudflare-access.md) (decision 2: "valid for 15 minutes")

## Context

A one-time code works for 15 minutes. An admin often hands an agent their code ahead of time, by
message, for the next day's start, and 15 minutes forces a second round trip. The owner wants
agent codes to last a day.

What a longer life costs:
- **Guessing barely changes.** A code has 40 bits, and the throttle allows 10 failures per IP per
  15 minutes ([identity-access](../domains/identity-access.md)): 960 tries per IP per day. With
  10,000 IPs and 3 live codes, the odds of a hit are about 3 × 10⁻⁵ per day.
- **A leak matters more.** A code sent by message sits in that chat, a notification or a shared
  phone for the whole lifetime. Whoever types it first enrols a device whose sliding session lasts
  as long as it is used (90 days for an agent, 30 for an admin). The real user learns of it only
  from a refusal.
- An admin session reaches every prospect and user, while an agent's reaches one tournée. An admin
  usually generates their own code from a signed-in device, so they rarely need it to wait.

Other facts: `/api/auth/login` is not the sync contract, so `CLIENT_VERSION` does not move, and
nothing is billed ([ADR-0002](0002-zero-cost-constraint.md)).

## Decision

A code's lifetime follows its user's role at generation: **24 hours for an agent, 1 hour for an
admin** (`LOGIN_CODE_TTL_MS` in `src/worker/session.ts`). The role is read in the same statement
that inserts the code. Everything else in ADR-0029 decision 2 stands: one use, one live code per
user, refused as expired once `expires_at` passes.

## Alternatives considered

- **24 hours for both:** simplest, but it gives the riskier credential the longer leak window for
  no gain.
- **Keep 15 minutes:** safest, but it keeps the second round trip the owner wants gone.

## Consequences

- An agent can receive the code the day before and sign in on arrival.
- **Harder:** a leaked agent code stays usable for up to a day. Generating a new code or
  deactivating the user still cancels it, and so does signing in with it.
- The nightly sweep keeps used codes up to 24 hours instead of 15 minutes; the table stays tiny.
