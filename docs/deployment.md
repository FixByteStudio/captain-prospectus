# Deployment

## Environments
| Env | Where | Database | Auth |
|---|---|---|---|
| Local | `pnpm dev` (Vite + workerd via `@cloudflare/vite-plugin`) | Local D1 (in `.wrangler/`) | `DEV_USER_EMAIL` in `.dev.vars` |
| Production | `https://prospectus.fixbyte.cloud` ([ADR-0035](adr/0035-serve-the-app-on-a-domain-we-already-own.md)) | D1 `captain-prospectus` | Our own login ([ADR-0034](adr/0034-launch-on-our-own-login-alone.md)) |

While the [data stage](adr/0033-rollout-rules-wait-for-protected-data.md) in `CLAUDE.md` is `disposable`, production is as throwaway as local: it may be [redeployed fresh](#fresh-redeploy) at any time.

A staging environment is not planned for v1 (two agents, low risk). If added: a wrangler `env.staging` with its own Worker name, D1 database and hostname.

## One-time setup (production)

Each step is done in the Cloudflare dashboard; the `wrangler` command beside it does the same from a
terminal, after `npx wrangler login`. An agent runs neither.

1. **Cloudflare account** (free): the one that holds the `fixbyte.cloud` zone.
2. **Database**: **Storage & databases** → **D1 SQL database** → **Create database**, named
   `captain-prospectus` (`npx wrangler d1 create captain-prospectus`). Put its `database_id` in
   `wrangler.jsonc` through a pull request. It is an identifier, not a secret: it opens nothing without the
   token of step 3.
3. **GitHub secrets**, in the `production` environment: `CLOUDFLARE_API_TOKEN` (an account API token for
   this account only: Workers Scripts Edit, D1 Edit, Workers R2 Storage Edit) and `CLOUDFLARE_ACCOUNT_ID`.
   A token or an account ID from another account fails the first migration with error 7403.
   Restrict the environment to `main` (**Settings** → **Environments** → **production** → **Deployment branches
   and tags** → **Selected branches and tags**, `main`): without it a workflow on any branch can read the token.
4. **First deploy**: run the `Deploy` workflow on `main` (**Actions** → **Deploy** → **Run workflow**). It
   applies every migration, then creates the Worker. Every later merge deploys by itself. There is deliberately
   no `deploy` npm script and no local `wrangler deploy`: every deploy goes through CI (see the release process
   below).
5. **The sign-in secrets** ([ADR-0029](adr/0029-own-login-instead-of-cloudflare-access.md)). Set all three as
   secrets, never as a var in `wrangler.jsonc` and never in the repo: in the Worker's **Settings** →
   **Variables and Secrets** → **Add**, type **Secret**, or with `wrangler secret put`. A secret survives every
   CI deploy, and a Text variable typed into the dashboard does not. `OWNER_EMAIL` is a secret for the same
   reason, and because the owner's address does not belong in the repo. Set them after the first deploy,
   since a secret needs the Worker to exist:
   - `AUTH_PEPPER`: a long random value (`openssl rand -hex 32`) that keys every stored hash. Nobody needs
     to read it. **Changing it signs everyone out and voids every code and passphrase**, so set it once.
   - `BREAK_GLASS`: another `openssl rand -hex 32`, copied into the owner's offline password store before
     it is pasted. This is the owner's way in when nothing else works, typed exactly as stored.
   - `OWNER_EMAIL`: the owner's email.

   Without `AUTH_PEPPER` the Worker skips sessions and `/api/auth/login` answers 500, so nobody can sign in;
   without `BREAK_GLASS` or `OWNER_EMAIL` the break-glass sign-in answers 401.
6. **The hostname** ([ADR-0035](adr/0035-serve-the-app-on-a-domain-we-already-own.md)). In the Worker's
   **Settings** → **Domains & Routes**: add the custom domain `prospectus.fixbyte.cloud`, switch the
   `workers.dev` route off, and confirm the preview URLs toggle reads off. `preview_urls: false` in
   `wrangler.jsonc`, asserted in `config.test.ts` ([security](security.md)), already applies the last one on
   every deploy. No other hostname may reach the Worker: the rule of step 7 would not cover it.
7. **The rate-limiting rule** ([ADR-0035](adr/0035-serve-the-app-on-a-domain-we-already-own.md)). In the
   `fixbyte.cloud` zone: **Security** → **Security rules** → **Create rule** → **Rate limiting rule**, matching
   `http.host eq "prospectus.fixbyte.cloud" and starts_with(http.request.uri.path, "/api/auth/")`, counted
   per IP, action Block. The Free plan gives one rule, a 10-second period and a 10-second block; 10 requests
   per period leaves a person signing in well under it.
8. **Verify**: open the URL in a private window → `/login` shows.
   `curl -i https://prospectus.fixbyte.cloud/api/me` with no cookie → must be 401.
   `curl -sI https://prospectus.fixbyte.cloud/login` → must carry `strict-transport-security` and a
   `content-security-policy` with `frame-ancestors 'none'` (`public/_headers`). Then do the
   [first sign-in](#first-sign-in).
9. **The backup bucket** ([ADR-0023](adr/0023-retention-by-redaction.md), closing
   [#34](https://github.com/FixbyteStudio/captain-prospectus/issues/34)): **R2 object storage** →
   **Create bucket**, named `captain-prospectus-backups`
   (`npx wrangler r2 bucket create captain-prospectus-backups`). Backups used to land in a
   GitHub artifact, which put a full copy of every visit note and agent position on a
   third party for 90 days; they go to R2 so `docs/security.md`'s "data stays in the
   Cloudflare account" is true. R2's free tier is 10 GB against a database measured in
   megabytes ([ADR-0002](adr/0002-zero-cost-constraint.md)).
   - The token of step 3 needs **Workers R2 Storage: Edit**, or `backup.yml` fails at the
     upload step with the export already taken.
   - Set a lifecycle rule on the bucket to expire objects after 90 days, matching
     `RETENTION_DAYS` — a backup that outlives the retention window puts the data back.
   - The workflow runs in the `production` environment, the one that holds the secrets of step 3.
   - Run the `Backup` workflow once and check that an object lands under `d1/`.
10. **The retention sweep** runs from a Cron Trigger declared in `wrangler.jsonc`
    (`40 3 * * *`); it needs no setup beyond deploying. It fails quietly by nature, so
    after the first night check the Workers log for the `retention: redacted N visit(s)`
    line. No line means the cron is not firing.
11. **Optional — the Google map provider** ([ADR-0020](adr/0020-google-places-as-a-second-map-provider.md)):
    `npx wrangler secret put GOOGLE_PLACES_KEY` with a key that has the Places API (New) enabled.
    A secret, never a var in `wrangler.jsonc`. Skip this and the map import still works on
    OpenStreetMap; the Google option answers 503 and the screen says it is not configured.

## First sign-in

Sign-in is our own login ([ADR-0029](adr/0029-own-login-instead-of-cloudflare-access.md)). After the first deploy,
and after every [fresh redeploy](#fresh-redeploy), in order:

1. Open `/login`, choose "Accès administrateur" and sign in with `OWNER_EMAIL` and `BREAK_GLASS`. That
   creates the owner as an admin.
2. On the **Utilisateurs** page, pick "Nouvelle phrase de passe" on the owner's own row and keep what it shows:
   it appears once. It is the everyday admin sign-in; `BREAK_GLASS` stays for emergencies.
3. Create every user on the Utilisateurs page, admins and agents, before anyone is assigned a prospect.
4. Give each agent a code with "Générer un code" on their row. It works once, for 15 minutes.

Then check, on production:
- The owner's session survives a reload.
- Of wrong logins sent from one network at least two seconds apart, the 11th gets 429 with a `Retry-After`
  header and the JSON error `too_many_attempts`. Sent faster, the rule of setup step 7 blocks first, and its
  429 is not the Worker's.
- A `POST` to `/api/auth/login` with a foreign `Origin` gets 403.
- After the first night, the retention log line (setup step 10) ends with the login codes, sessions and login
  attempts it deleted.

## Release process

Trunk-based. `main` is always deployable.

1. PR → CI green (typecheck, tests, build) → review → squash-merge. **Merging deploys**, whatever the change: a
   dependency bump, and a docs-only merge too. That one ships the same files, the build being reproducible, so
   phones see no update.
2. Once CI passes on that push to `main`, the `Deploy` workflow starts by itself:
   1. `wrangler d1 migrations apply captain-prospectus --remote`
   2. `wrangler deploy`
   3. a smoke test: `/login` answers 200, and `/api/me` with no cookie answers 401
3. By hand: load the app, run a sync from a phone.

Nothing in the workflow sends an alert: a failed run reaches whoever merged, or started it by hand, through GitHub's
own notifications, if theirs are on for failed workflows. A CI run that is not a push to `main`, or whose commit is no
longer its tip, is skipped rather than deployed; the reasons are in `deploy.yml`. To deploy again without a merge:
**Actions** → **Deploy** → **Run workflow**. Re-running an old `Deploy` run deploys the commit of that run, not `main`.

Migrations run **before** the new code. Once the data stage is `protected`, each migration must work with the deployed Worker (expand → deploy → contract across two releases). While it is `disposable`, a change ships in one migration ([ADR-0033](adr/0033-rollout-rules-wait-for-protected-data.md)).

## Rollback
- **Code**: `npx wrangler rollback` to the previous version (Workers keep version history). Then revert the commit
  on `main`: the next merge deploys `main` as it stands, the bad commit included.
- **Data**: D1 Time Travel: `npx wrangler d1 time-travel restore captain-prospectus --timestamp=<unix>`. Retention window depends on the plan; check the D1 docs. Restore overwrites the database; export first.
- A destructive migration (drop/rename column) is never rolled back by code rollback alone. That is why, once the data stage is `protected`, contract steps ship separately. While it is `disposable`, the fix is a [fresh redeploy](#fresh-redeploy).

## Fresh redeploy
Only while the data stage is `disposable`, and only by the owner: an agent never runs any of this.

1. Ask the testers to sync until nothing is pending, and to record no visit until step 6.
2. Export, in case: `npx wrangler d1 export captain-prospectus --remote --output=before-wipe.sql`.
3. `npx wrangler d1 delete captain-prospectus`, then `npx wrangler d1 create captain-prospectus`.
4. Put the new `database_id` in `wrangler.jsonc` through a pull request; merging it deploys, and the run applies
   every migration from zero. The Worker's secrets survive, since they belong to the Worker, not the database.
5. Bootstrap the owner and users again, as in the [first sign-in](#first-sign-in) steps 1 to 4: the `users` table went with the database.
6. Each tester checks the pending count still reads zero, then clears the site data (or reinstalls the PWA) and signs in
   with their new code. Clearing site data with a visit pending loses it (INVARIANT 5).

## Backups
The `Backup` workflow exports the database every day at 04:17 UTC, after the retention sweep, into the R2 bucket of
[setup step 9](#one-time-setup-production), as `d1/<run id>-backup.sql`
([ADR-0023](adr/0023-retention-by-redaction.md)). The bucket's lifecycle rule drops an object after 90 days. It is
daily because Time Travel only reaches back over its retention window, and goes with the database when that is deleted.

- **Is it running?** **Actions** → **Backup** shows a run each morning, and the bucket a new object. A run fails when
  the export is empty or holds no schema. GitHub notifies whoever last changed its `cron` line of a failed run, if
  their notifications are on for failed workflows; nothing else alerts.
- **GitHub switches a schedule off** after 60 days without activity in a public repository. It emails first; switch it
  back on from **Actions** → **Backup**.
- **One more**, before anything risky: **Actions** → **Backup** → **Run workflow**.

### Restore from a backup
By the owner only, and **not yet rehearsed**: do it once before the data stage is `protected`. It is the last resort,
since every visit synced after that export is lost. For a mistake inside the Time Travel window, [rollback](#rollback)
loses less.

1. Ask the agents to record no visit until step 5.
2. `npx wrangler r2 object get captain-prospectus-backups/d1/<run id>-backup.sql --file=backup.sql --remote`
3. `npx wrangler d1 delete captain-prospectus`, then `npx wrangler d1 create captain-prospectus`. Put the new
   `database_id` in `wrangler.jsonc` on a branch, and run step 4 from it: `wrangler` reads the id there.
4. `npx wrangler d1 execute captain-prospectus --remote --file=backup.sql`, into the empty database: the export carries
   the schema, so no migration runs first. Then `npx wrangler d1 migrations list captain-prospectus --remote` must show
   nothing left to apply, unless `main` has gained a migration since the export.
5. Open the pull request for that branch; merging it deploys. Users, passphrases and sessions come back with the
   data, since `AUTH_PEPPER` belongs to the Worker.

## Mobile install
Agents open the URL in the phone browser, type the code an admin gave them at `/login`, then "Add to Home Screen". On iOS, install from Safari.
