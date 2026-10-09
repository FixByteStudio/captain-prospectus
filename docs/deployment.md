# Deployment

## Environments
| Env | Where | Database | Auth |
|---|---|---|---|
| Local | `pnpm dev` (Vite + workerd via `@cloudflare/vite-plugin`) | Local D1 (in `.wrangler/`) | `DEV_USER_EMAIL` in `.dev.vars` |
| Production | `captain-prospectus.<account>.workers.dev` | D1 `captain-prospectus` | Our own login, behind Cloudflare Access until the [cutover](#cutover-to-our-own-login) ends |

A staging environment is not planned for v1 (two agents, low risk). If added: a wrangler `env.staging` with its own Worker name and D1 database, and its own Access application.

## One-time setup (production)

1. **Cloudflare account** (free). `npx wrangler login`.
2. **Database**: `npx wrangler d1 create captain-prospectus`, paste the returned `database_id` into `wrangler.jsonc`.
3. **First deploy**: `pnpm build && npx wrangler deploy` to create the Worker. There is deliberately no `deploy` npm script: routine deploys go through CI (see the release process below).
4. **Access** — protect the Worker (one click, no zone or custom domain needed):
   - Cloudflare dashboard → **Workers & Pages** → `captain-prospectus` → **Settings** → **Domains & Routes**.
   - Next to `workers.dev`, select **Enable Cloudflare Access**, scope **All traffic**.
     This creates a reusable policy named `captain-prospectus - Production`.
   - **Manage Cloudflare Access** → set the policy to *Allow* → the emails of the admins and agents,
     and enable the **One-time PIN** login method. First use also creates the team domain
     `<team>.cloudflareaccess.com`.
   - In **Zero Trust** → **Access** → **Applications**, open the application and copy its **AUD tag**.
     The Worker needs it to verify the JWT — the identity still comes from the verified token, never
     from `ctx.access`, which Static Assets do not forward ([ADR-0006](adr/0006-cloudflare-access-auth.md)).
5. **Worker variables** in `wrangler.jsonc`: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS`. Redeploy.
6. **The sign-in secrets** ([ADR-0029](adr/0029-own-login-instead-of-cloudflare-access.md)). Set all three with
   `wrangler secret put`, never as a var in `wrangler.jsonc` and never in the repo: a secret survives every CI
   deploy, and a variable typed into the dashboard does not. `OWNER_EMAIL` is a secret for the same reason, and
   because the owner's address does not belong in the repo. Run these after the first deploy, since a secret
   needs the Worker to exist:
   - `openssl rand -hex 32 | npx wrangler secret put AUTH_PEPPER`: a long random value that keys every stored
     hash. Nobody needs to read it. **Changing it signs everyone out and voids every code and passphrase**, so
     set it once.
   - `openssl rand -hex 32` prints a value: copy it into the owner's offline password store, then
     `npx wrangler secret put BREAK_GLASS` and paste it. This is the owner's way in when nothing else works,
     typed exactly as stored.
   - `npx wrangler secret put OWNER_EMAIL` and type the owner's email.

   Without `AUTH_PEPPER` the Worker skips sessions and `/api/auth/login` answers 500, so Access alone keeps
   working; without `BREAK_GLASS` or `OWNER_EMAIL` the break-glass sign-in answers 401.
7. **Verify**: open the URL in a private window → Access login → app loads → `GET /api/me` shows the right role. Call `/api/me` with `curl` and no cookie → must be 401/redirect.
8. **Check nothing bypasses Access.** Preview URLs are disabled by `preview_urls: false` in
   `wrangler.jsonc`, asserted in `config.test.ts` ([security](security.md)), so the first deploy
   already applies it. In the same **Domains & Routes** panel, confirm the preview URLs toggle
   reads off. Verify no other route reaches the Worker unprotected.
9. **GitHub secrets** for CI deploys: `CLOUDFLARE_API_TOKEN` (scoped: Workers Scripts Edit, D1 Edit, on this account only) and `CLOUDFLARE_ACCOUNT_ID`.
10. **The backup bucket** ([ADR-0023](adr/0023-retention-by-redaction.md), closing
   [#34](https://github.com/FixbyteStudio/captain-prospectus/issues/34)):
   `npx wrangler r2 bucket create captain-prospectus-backups`. Backups used to land in a
   GitHub artifact, which put a full copy of every visit note and agent position on a
   third party for 90 days; they go to R2 so `docs/security.md`'s "data stays in the
   Cloudflare account" is true. R2's free tier is 10 GB against a database measured in
   megabytes ([ADR-0002](adr/0002-zero-cost-constraint.md)).
   - Add **R2 Storage: Edit** to `CLOUDFLARE_API_TOKEN`, or `backup.yml` fails at the
     upload step with the export already taken.
   - Set a lifecycle rule on the bucket to expire objects after 90 days, matching
     `RETENTION_DAYS` — a backup that outlives the retention window puts the data back.
   - The workflow runs in the `production` environment, so create it in GitHub with the
     same reviewers as the deploy.
11. **The retention sweep** runs from a Cron Trigger declared in `wrangler.jsonc`
    (`40 3 * * *`); it needs no setup beyond deploying. It fails quietly by nature, so
    after the first night check the Workers log for the `retention: redacted N visit(s)`
    line. No line means the cron is not firing.
12. **Optional — the Google map provider** ([ADR-0020](adr/0020-google-places-as-a-second-map-provider.md)):
   `npx wrangler secret put GOOGLE_PLACES_KEY` with a key that has the Places API (New) enabled.
   A secret, never a var in `wrangler.jsonc`. Skip this and the map import still works on
   OpenStreetMap; the Google option answers 503 and the screen says it is not configured.

## Cutover to our own login

[ADR-0029](adr/0029-own-login-instead-of-cloudflare-access.md) replaces Access in three phases:

1. **Phase 1**: the login ships and the Worker accepts a session, falling back to the Access JWT. Access still fronts the hostname.
2. **Phase 2**: each agent enrols with a code, then the owner revokes the Access tokens and deletes the Access application.
3. **Phase 3**: a pull request removes the JWT check, `jose` and the Access variables.

Phase 1, in order:

1. Set the three secrets (setup step 6).
2. Deploy through CI ([release process](#release-process)).
3. Open `/login`, choose "Accès administrateur" and sign in with `OWNER_EMAIL` and `BREAK_GLASS`. That
   creates the owner as an admin.
4. On the **Agents** page, pick "Nouvelle phrase de passe" on the owner's own row and keep what it shows:
   it appears once. It is the everyday admin sign-in; `BREAK_GLASS` stays for emergencies.
5. Create every user on the Agents page, admins and agents, before anyone is assigned a prospect.
6. Give each agent a code with "Générer un code" on their row. It works once, for 15 minutes.

Then check, on production:
- The owner's session survives a reload.
- The 11th wrong login from one network gets 429 with a `Retry-After` header.
- A `POST` to `/api/auth/login` with a foreign `Origin` gets 403.
- After the first night, the retention log line (setup step 11) ends with the login codes, sessions and login
  attempts it deleted.

Phases 2 and 3 are documented by the Access-removal epic (`epic-access-removed`), which also removes Access
from the setup above.

## Release process

Trunk-based. `main` is always deployable.

1. PR → CI green (typecheck, tests, build) → review → squash-merge.
2. The `Deploy` workflow on `main`:
   1. `wrangler d1 migrations apply captain-prospectus --remote`
   2. `wrangler deploy`
3. Smoke test: load the app, run a sync from a phone.

Migrations run **before** the new code, so each migration must work with the currently deployed Worker (expand → deploy → contract across two releases).

## Rollback
- **Code**: `npx wrangler rollback` to the previous version (Workers keep version history).
- **Data**: D1 Time Travel: `npx wrangler d1 time-travel restore captain-prospectus --timestamp=<unix>`. Retention window depends on the plan; check the D1 docs. Restore overwrites the database; export first.
- A destructive migration (drop/rename column) is never rolled back by code rollback alone. That is why contract steps ship separately.

## Backups
Weekly `npx wrangler d1 export captain-prospectus --remote --output=backup.sql`, stored outside Cloudflare. Automate later as a scheduled GitHub Action (roadmap).

## Mobile install
Agents open the URL in the phone browser and pass Access (until phase 2), then type the code an admin gave them at `/login`, then "Add to Home Screen". On iOS, install from Safari.
