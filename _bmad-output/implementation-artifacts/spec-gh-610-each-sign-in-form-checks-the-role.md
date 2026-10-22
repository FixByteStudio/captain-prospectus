---
title: 'Each sign-in form checks the role (3.2, #610)'
type: 'feature'
created: '2026-10-21'
status: 'done'
baseline_commit: 'ca9811fb3bdc8a447dab4331703e453a8367c3fa'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment, security-reviewer]
review_loop_iteration: 0
context:
  - '{project-root}/docs/adr/0038-admins-sign-in-with-an-email-and-a-code.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-580-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The admin form takes an email and a generated passphrase, and the agent form takes any user's code, so an admin's code opens an admin session from a field phone (ADR-0038 Context).

**Approach:** Replace the `passphrase` login kind with `{ kind: "admin", email, code }`. The conditional UPDATE that spends a code carries the role check (agent form: an active agent's code; admin form: an active admin's code whose user is the typed email), so a refused code stays unspent; on the admin kind, break-glass is tried first on the raw text (ADR-0038 decisions 2 and 3). The admin form asks for Adresse e-mail and Code.

## Boundaries & Constraints

**Always:** one route, `zod/mini` union in `schemas.ts`; every refusal the same 401 body; every refusal counts against the throttle; nothing logs the code, token or hash; `CLIENT_VERSION` does not move; French copy only in `copy/field.ts`.

**Never:** remove `POST /api/admin/me/passphrase`, `passphrase_hash`, `PassphraseDialog`, `newPassphrase` or the Utilisateurs passphrase UI (story 3.3, #611); touch `deployment.md` or `data-model.md` (3.3); change the code's format, lifetime or normaliser; add a migration.

**Decisions (owner, 2026-10-22):**
- `adminLede`: « Connectez-vous avec votre adresse e-mail et un code généré par un administrateur. »
- `adminRefused`: « Adresse e-mail ou code incorrect. Le code a peut-être expiré ou déjà servi : demandez-en un nouveau. » (non-breaking space before the colon, as `codeRefused`).
- The admin form's Code field is masked: `type="password"`, `autocomplete="one-time-code"`, so break-glass never shows on screen and no password manager saves a one-time code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin signs in | `{admin, email: TEST_ADMIN, code}` from their row | 200 `{email, role: admin}`, 30-day session, code spent | — |
| Admin code on agent form | `{code}` with an admin's code | 401; code still works on the admin kind afterwards | same 401 body |
| Agent code on admin form | `{admin, email: agent, code}` | 401, code still works on the code kind | same 401 body |
| Other admin's email | `{admin, email: OWNER, code of TEST_ADMIN}` | 401, code unspent | same 401 body |
| Break-glass | `{admin, email: OWNER, code: BREAK_GLASS}` as typed | 200 admin, owner created or reactivated | wrong secret → same 401 |
| Owner with a code | `{admin, email: OWNER, code}` from owner's row | 200 (break-glass misses, the code is spent) | — |

</frozen-after-approval>

## Code Map

- `src/shared/schemas.ts:100-135` -- `passphraseLoginSchema` → `adminLoginSchema` (`kind: "admin"`, email trimmed+lowercased as today, `code` as `codeLoginSchema.code`); union doc comment says a kind names the form now (ADR-0038 d.2).
- `src/worker/routes/auth.ts` -- `code` branch's batch becomes the one spend for both kinds: add `users.role = role` inside the EXISTS (and in the session INSERT…SELECT, replacing the CASE with the role's TTL), plus `eq(loginCodes.userEmail, email)` on the admin kind. Break-glass block (HMAC + `timingSafeEqual`, upsert owner) runs first on the admin kind, unchanged. Delete the generated-passphrase lookup, `DUMMY_HASH`, `REFUSED`; one refusal body. Update the header comment.
- `src/client/auth/LoginScreen.tsx` -- `adminFormSchema = z.pick(adminLoginSchema, {email, code})`; admin field `name="code"`, label `copy.login.code`, message `copy.login.codeRequired`; sends `kind: "admin"`; header comment.
- `src/client/copy/field.ts:263-270` -- new `adminLede`, `adminRefused`; drop `passphrase`, `passphraseRequired`.
- Tests: `src/worker/auth.test.ts` (~40 `kind: "passphrase"` sites; the "generated passphrase (GH #306)" describe goes; "gives an admin's own code an admin session" becomes the cross-form test; throttle "counts a refused generated passphrase" and device-sessions "generated-passphrase login" switch to admin codes), `src/worker/origin.test.ts:73`, `src/worker/retention.test.ts:635`, `src/shared/schemas.test.ts`, `src/client/auth/LoginScreen.test.tsx`.
- Docs: `docs/api.md:11,15`, `docs/domains/identity-access.md:29-49` (the passphrase paragraph becomes the admin-code one; one line notes « Nouvelle phrase de passe » still exists but no form takes it until #611), `docs/security.md:16,23,25`, `docs/design.md:1497-1565` (The login page: sketch, admin form bullet, validation, refusal).

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/schemas.ts` -- add `adminLoginSchema`, drop `passphraseLoginSchema` from the union -- contract (d.2).
- [ ] `src/worker/routes/auth.ts` -- role-checked spend for both kinds, break-glass first on the admin kind, remove the passphrase branch -- R10, d.2–3.
- [ ] `src/worker/auth.test.ts` + `origin.test.ts` + `retention.test.ts` + `schemas.test.ts` -- convert and add the I/O matrix cases -- AC.
- [ ] `src/client/copy/field.ts` + `LoginScreen.tsx` + `LoginScreen.test.tsx` -- admin form asks for Code -- R9.
- [ ] `docs/api.md`, `docs/domains/identity-access.md`, `docs/security.md`, `docs/design.md` -- match what ships.

**Acceptance Criteria:**
- Given a fresh admin code, when it is sent on the code kind and gets 401, then the same code on the admin kind with that admin's email opens a session.
- Given `pnpm dev`, when an admin types their email and a fresh code in Accès administrateur, then they land on `/admin`.
- Given the change, `grep -rn '"passphrase"' src/shared src/worker/routes/auth.ts src/client/auth` finds nothing.

## Design Notes

The role filter must live in the UPDATE's WHERE, not after it: a check after the spend would burn a code typed on the wrong form, which ADR-0038 forbids. With the role fixed per kind, the RETURNING no longer needs the role subquery.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all pass; quote the field precache total.

**Manual checks:**
- `pnpm dev`: generate a code on the admin's own row, sign out, Accès administrateur → email + code → `/admin`.

## Implementation Notes

- One spend for both kinds: the role (and on the admin kind the email) sits in the UPDATE's WHERE and the session INSERT…SELECT; the refusal body is now one constant.
- `.dev.vars.example` still told the owner to type break-glass in "the passphrase form"; fixed in passing since this change made it wrong.
- Verified on `pnpm dev` with curl: an admin code gets 401 on the code kind, 401 on the admin kind with another email, then 200 admin (30-day cookie) with the right email; break-glass 200; the old `passphrase` kind 400. The in-browser landing on `/admin` was not run (reading `.dev.vars` to drop `DEV_USER_EMAIL` was denied); `LoginScreen.test.tsx` covers the landing.

## Spec Change Log

## Review Triage Log

### Pass 1 (2026-10-22) — high 0, medium 0, low 6 (5 patched, 1 rejected as unlikely), false 8, maybe-false 1

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | verification-gap, edge-case, intent | `adminLoginSchema` has no schema test; caps and the removed `passphrase` kind unpinned | low | patch | Added an admin block to `schemas.test.ts` |
| 2 | verification-gap | Deactivated-admin test does not assert the code stays unspent | low | patch | Added the `unspent()` assert |
| 3 | verification-gap | Masked Code field (owner decision) not asserted | low | patch | `LoginScreen.test.tsx` asserts type and autocomplete |
| 4 | security, blind | identity-access.md "role of the form that took it" reads as if the form assigns the role | low | patch | Reworded |
| 5 | security | design.md claims no password manager saves the code; untested across browsers | maybe-false | patch (doc) | Softened to what `one-time-code` asks for; a manual browser check would settle it |
| 6 | edge-case, security, verification-gap | Dropped `beforeStatement` race test; no demotion test for the role filter | low | reject | Roles are fixed at creation (ADR-0037), so nothing demotes; the UPDATE and the INSERT run in one D1 batch; cross-form tests exercise the role filter in the UPDATE |
| 7 | blind | Removing `passphrase` kind needs a CLIENT_VERSION bump | false | reject | ADR-0038: `/api/auth/login` is not the sync contract; the data stage is disposable (CLAUDE.md) |
| 8 | blind | Passphrase UI still issues an unusable credential | false | reject | Accepted in the epic notes (2026-10-21); removed by #611 |
| 9 | blind | Break-glass HMACs only on the admin kind leak which form was used | false | reject | The kind is chosen by the client and is not secret; work is the same for every refusal within a kind |
| 10 | blind | The INSERT does not re-check the email | false | reject | The INSERT keys on `code_hash`, `used_at = now` and `changes() = 1`, so it only matches the row this UPDATE spent, whose email the UPDATE already checked |
| 11 | blind | Missing edge tests (expired on admin form, right secret wrong email) | false | reject | Expiry is the same shared WHERE, already tested; "refuses a wrong email and a wrong secret" covers the fall-through |
| 12 | blind, edge-case | Masked input hurts typing, and has no autocapitalize or spellcheck hints | false | reject | Masking was the owner's decision (2026-10-22); a password field has no autocorrect or spellcheck |
| 13 | blind | `one-time-code` may trigger SMS autofill | false | reject | Harmless; codes are never sent by SMS |
| 14 | edge-case | BREAK_GLASS with a non-owner email falls through as a code | false | reject | It hashes to no code; ADR-0038 d.3 says only otherwise is it spent as a code |
| 15 | blind | `_bmad-output` artifacts status / tracking | false | reject | Statuses are set by the workflow before the PR |
