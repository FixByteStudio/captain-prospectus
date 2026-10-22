# ADR-0033: Rollout rules wait until the data stage is protected

- Status: accepted
- Date: 2026-10-12
- Deciders: mohss, Claude
- Amends: [ADR-0005](0005-d1-with-drizzle.md), [ADR-0007](0007-offline-first-insert-only-sync.md)

## Context
Nothing is deployed. There is no Cloudflare account, production D1 or API token yet
(`.github/workflows/deploy.yml`), so no stored row and no installed phone exists outside local dev.

The rules were written as if there were. ADR-0005 makes every migration backward compatible
with "the currently deployed Worker" (expand → migrate → contract). ADR-0007 and
`field-operations.md` keep a `clientVersion` window for phones running an old build. `CLAUDE.md`,
the `d1-migration` and `sync-contract-change` skills and the `migration-guard` agent repeat both.
Agents follow them faithfully. They propose backfills, two-release migrations, compatibility
shims and rollout phases for data that does not exist, and each of those costs review time and
leaves code behind (`search-backfill.ts`, for one).

"Not deployed yet" is the wrong trigger too. The first deploy is not a release: after M6 the
owner may still wipe production and redeploy it fresh while the app is being tried out. The only
thing the rollout rules protect is **data or an installed phone that must survive a change**.

## Decision
We will keep one switch, the **data stage**, in `CLAUDE.md`. It is `disposable` or `protected`.

1. **While `disposable`**, no stored row and no installed build has to survive a change. A visit
   still in an outbox does (invariant 5):
   - a schema change goes in one migration: no backfill, no expand/contract;
   - a sync contract change goes to both sides at once, with no compatibility with an old build.
     A breaking one raises `CLIENT_VERSION` and `MIN_CLIENT_VERSION` together, with no window:
     an old build gets 426, updates itself with its outbox intact, and the Dexie upgrade
     migrates the queued rows;
   - a fresh redeploy (recreate D1, apply every migration from zero) is a normal fix, run by the
     owner ([deployment](../deployment.md#fresh-redeploy));
   - squashing `drizzle/` into one migration is allowed only as its own PR, when the owner asks
     for it. Agents never squash on their own.
2. **Once `protected`**, the rollout rules of ADR-0005 and ADR-0007 apply as written.
3. **Only the owner flips the stage**, by editing that heading in `CLAUDE.md`, on the first field
   day whose visits are meant to be kept. Deploying, CI or a `wrangler.jsonc` does not flip it.
   Going back from `protected` takes a new ADR.
4. **Every invariant in `CLAUDE.md` except 9 holds in both stages**, in particular: insert-only
   sync and the outbox (invariants 2 and 5), server-derived status (3), idempotent writes (4), the
   `visited_at` clamp (12), append-only `visits`, never editing a migration already on `main`, and
   agents never running `--remote`.

## Alternatives considered
| Option | Why not |
|---|---|
| "Pre-launch until M6" | Deploying is not shipping. A live but throwaway database would switch the rollout rules on with nothing to protect |
| A third stage between the two (real data, nobody relying on it yet) | Agents have to guess which of three applies. Two states can be read off one line |
| Delete the rollout rules until they are needed | They took real incidents to write. Scoping them keeps them ready for the day the stage flips |

## Consequences
- Schema and contract changes get smaller and land in one PR while the stage is `disposable`.
- Code written only for rollout (backfills, compatibility shims, the Access fallback of the
  [ADR-0029](0029-own-login-instead-of-cloudflare-access.md) cutover) can be reconsidered. Each is
  its own change.
- Harder: the owner has to remember to flip the stage before real data arrives. A forgotten flip
  lets an agent ship a one-step destructive migration over real visits. The M6 checklist and the
  PR template both name the stage to make that unlikely.
