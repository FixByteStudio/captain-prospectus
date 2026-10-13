---
title: 'The Worker accepts a session and nothing else'
type: 'refactor'
created: '2026-10-13'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
baseline_commit: 736278c1b8c66e516e2da34ca9ebc241117316ce
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Worker still carries the Cloudflare Access JWT fallback (`identityFromAccess`, the JWKS cache, `roleFor`, `jose`) and four Access and roster vars, although production runs on the own login alone (ADR-0034). Two branches exist only for a caller with no `users` row, and several docs still name the Access JWT as the identity (GH #457).

**Approach:** Delete the fallback and everything only it used, move the Worker tests to the D1 session helper, and rewrite the Access wording of the docs this code owns in the same change. A request that carries a Cloudflare Access token and no session gets a 401.

## Boundaries & Constraints

**Always:** Identity comes from a D1 session, or `DEV_USER_EMAIL` on a local host (INVARIANT 10). `worker-configuration.d.ts` is regenerated with `pnpm cf-typegen`, not hand-edited.

**Never:** The client-side Access pieces (`?reconnect=1`, the `/cdn-cgi/` denylist entry, the Access logout link), `sessions.id` NOT NULL, `docs/deployment.md` and `docs/free-tier-budget.md` beyond a false claim, and the opening paragraph of `docs/domains/identity-access.md` belong to other entries of epic-access-removed.

</frozen-after-approval>

## Code Map

- `src/worker/auth.ts` -- `identityFromAccess`, `getJwks`, `roleFor`, `parseEmails`, `readAccessToken` removed; `requireIdentity` ends at 401 after the session and dev user.
- `src/worker/routes/agent.ts` -- position gate no longer re-reads `users`: a session or dev identity always has an active row.
- `src/worker/routes/identity.ts` -- `POST /me/passphrase` keeps its guarded UPDATE and 404: a race (deactivated or demoted mid-request) still writes nothing and must not return a passphrase that was not stored.
- `src/worker/types.ts`, `wrangler.jsonc`, `worker-configuration.d.ts`, `.dev.vars.example`, `vitest.config.ts`, `scripts/measure-*.mjs`, `package.json` -- the four vars and `jose` removed.
- `test/access-jwt.ts` -- deleted. `auth.test.ts`, `users.test.ts`, `sync.test.ts` -- Access tests removed; one test shows an Access header with no session is a 401; the passphrase 404 is tested through a mid-request deactivation (`test/d1-hook.ts`).

## Tasks & Acceptance

**Execution:**
- [x] Worker code, config, types and `jose` removed as above.
- [x] Tests moved off the Access stub; `test/access-jwt.ts` deleted.
- [x] `docs/domains/identity-access.md` (caller list), `docs/api.md`, `docs/data-model.md`, `docs/domains/field-operations.md`, `docs/security.md` and the false line of `docs/deployment.md` and `.claude/agents/security-reviewer.md` rewritten.

**Acceptance Criteria:**
- Given a request with `Cf-Access-Jwt-Assertion` and no session, when it calls `/api/me`, then it gets 401.
- Given the repository, when src/worker, test, scripts, package.json, wrangler.jsonc, worker-configuration.d.ts, vitest.config.ts and .dev.vars.example are searched, then none contains `jose`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS` or `AGENT_EMAILS`.

## Implementation Notes

- `pnpm cf-typegen` regenerated `worker-configuration.d.ts` cleanly but also moved it to the installed workerd (1.20261006.1); its diff therefore carries runtime-type changes this entry did not cause. Prettier is run on it so `pnpm lint` passes.
- The `wrangler.jsonc` `vars` block is gone entirely: every remaining binding is a secret (`docs/deployment.md`) and `config.test.ts` already reads `vars ?? {}`.
- The own-passphrase 404 is kept as a race guard rather than deleted: with no row the UPDATE writes nothing, and answering 200 with a passphrase that was never stored would lock the admin out of that credential.
- baseline_commit re-stamped from 4dd874b (stale local main) to the merge-base with origin/main, 736278c.
- Two client comments (`src/client/App.tsx`, `src/client/field/db.ts`) and `identity-access.md` line 79 said the Worker verifies an Access JWT or falls back to Access; reworded in the same change as part of GH #457.
- `CLAUDE.md` invariants 10 and 13 and `docs/free-tier-budget.md` still mention the Access JWT and JWKS; they belong to #472 (agent rules and budget docs).

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm test` -- expected: all green
- `pnpm lint` -- expected: clean
- `pnpm build` -- expected: succeeds

## Spec Change Log

## Review Triage Log

Pass 1, four lenses. No intent_gap or bad_spec.

- verification-gap: the 401 test also passes on the old code (no Access vars set) -- medium, defer. A discriminating test needs Access vars and a signed JWT, which the acceptance grep forbids in `test/` and `jose` removal makes costly. The spec's grep is the guard. Patched in part: the test now also sends `Cf-Access-Authenticated-User-Email`.
- edge-case: position gate no longer re-reads `users` at write time -- low, rejected. The intent says delete that branch; the window is the length of one sync request, and the role is the session's.
- edge-case / blind: stale "verified Access JWT" comments in `src/client/App.tsx`, `src/client/field/db.ts`, `identity-access.md:79` -- low, patched (one-word comment edits).
- blind: no test for demotion mid-request on the passphrase route -- low, rejected; the guard is one WHERE clause covered by the deactivation case.
- blind: `CLAUDE.md` invariants 10 and 13, `free-tier-budget.md` still name the fallback and JWKS -- defer to #472. Client Access pieces -- #468/#469. `roadmap.md:26` is a ticked historical line.
- blind: regenerated `worker-configuration.d.ts` carries a workerd bump -- accepted, stated in Implementation Notes and the PR.
- intent-alignment: reading A implemented; the passphrase 404 kept as a race guard on purpose.
