---
title: 'An agent enrols a device with a one-time code'
type: 'feature'
created: '2026-10-08'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '299938c2996f7473cdee8e2683cd69d508f381d7'
context:
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Only break-glass can open a session, so no agent can sign in through our own login (GH #305, CAP-2, CAP-3's own-device code, CAP-4, CAP-7).

**Approach:** A `login_codes` table, an admin route that generates an 8-char Crockford code, `kind: "code"` on `POST /api/auth/login`, `/login` with the code form by default and the admin form behind a swap, the 429 lockout Alert, and "Générer un code" with its Dialog on the Agents page — all per design.md.

## Boundaries & Constraints

**Always:**
- A code is stored only as `hmacHex(AUTH_PEPPER, normalise(code))`; never stored, logged or echoed except in the generate response.
- One shared pure normaliser in `src/shared`: uppercase, strip spaces and hyphens, I/L→1, O→0. The server normalises; the client sends the code as typed.
- Code login is one conditional `UPDATE … SET used_at WHERE hash, used_at IS NULL, expires_at > now, user active RETURNING` — the single winner opens the session; role and TTL come from `users`.
- Generate: unknown email 404, deactivated 409 `user_inactive`; deletes the user's unused codes and inserts the new one in one batch; answers 201 `{code, expiresAt}` (`expiresAt` = now + 15 min). Works on the admin's own row.
- Deactivation's PATCH batch also deletes the user's unused codes, under the same "now inactive" guard as sessions.
- Code login sits behind the existing `loginThrottle`; a refused code is 401 `unauthorized`.
- `/login`: code form default (`type="text"`, `autocomplete="one-time-code"`, `autocapitalize="characters"`, spellcheck off, no maxlength); ghost "Accès administrateur" / "Retour au code" swap in place, clear a refusal, keep the lockout, focus the first field. Native inputs, `copy/field` strings.
- Lockout: one Alert slot, offline > lockout > refusal; button disabled until now + `Retry-After` (Brussels "HH:MM"), then re-enables and the Alert goes; no usable header → the "quelques minutes" sentence and 15 min.
- Code Dialog per design.md: "Code pour {nom}", code split 4 + 4, expiry in Brussels time from `expiresAt`, Copier (toast success / clipboard refusal), Terminé. "Générer un code" is the first item of every active row's menu. A failed generate toasts the generic failure.
- docs/api.md, docs/data-model.md and docs/domains/identity-access.md change in this PR.
- Decision (2026-10-08, story): the swap moves here from entry 9; Générer un code works on the admin's own row; 409 `user_inactive` / 404 as PATCH does; security-reviewer reviews before merge.

**Never:** no passphrase generation or normalising passphrases (entry 9); no outbox line, no 426 prompt (entry 12); no sweep of expired codes (entry 13); no new dependency; no change to break-glass behaviour or the sync contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Generate | admin, active user | 201 `{code: 8 Crockford chars, expiresAt}`; older unused codes gone | — |
| Generate inactive / unknown | deactivated / no row | — | 409 `user_inactive` / 404 |
| Login with code | `"k7qm 2xpa"` within 15 min | 200 `{email, role}` + session cookie; code marked used | — |
| Code refused | wrong, expired, used, superseded, user deactivated | — | 401, counted by throttle |
| Race | two concurrent logins, one code | exactly one 200, one 401, one session | — |
| Deactivate | PATCH `{active:false}` | sessions and unused codes deleted | — |
| /login 401 | code form | "Ce code ne fonctionne pas…" Alert, typed code kept | — |
| /login 429 | `Retry-After: 600` | lockout sentence with Brussels time; button disabled, re-enabled after 600 s | no header → minutes sentence, 15 min |
| Swap | Accès administrateur ↔ Retour au code | other form, refusal cleared, lockout kept, focus first field | — |
| Code Dialog Copier | clipboard ok / refused | "Code copié." / "Copie impossible…"; code stays | — |

</frozen-after-approval>

## Code Map

- `src/shared/credential.ts` (new) -- `normaliseCredential(s)`, `CROCKFORD` alphabet; pure, tested in `credential.test.ts`.
- `src/shared/schemas.ts` L90-109 -- add `codeLoginSchema {kind:"code", code: 1..200 as typed}` to `loginRequestSchema`'s union; add `loginCodeResponseSchema {code, expiresAt}` near `userUpdateSchema` (L489). Update the L92 comment.
- `src/worker/db/schema.ts` L270-320 -- `loginCodes`: `code_hash` PK, `user_email` FK users + index, `created_at`, `expires_at`, `used_at` nullable. Then `pnpm db:generate` (→ `drizzle/0011_*`), `d1-migration` skill.
- `src/worker/session.ts` -- add `newLoginCode()` (5 random bytes → 8 Crockford chars) beside `newSessionToken`; reuse `hmacHex`, `SESSION_TTL_MS`, `sessionCookie`.
- `src/worker/routes/auth.ts` -- branch on `body.kind`; keep break-glass as is; `code` branch per Always. Extract a `openSession(db, email, role)` helper only if both branches share it cleanly. Header comment update.
- `src/worker/routes/identity.ts` -- `POST /users/:email/code` (`agentEmailParamSchema`), and add the `login_codes` delete to the PATCH deactivation batch (L109-119 pattern).
- Tests: `src/worker/auth.test.ts` (login kinds; follow its break-glass `describe` L94 and throttle L404), `src/worker/users.test.ts` (generate route, deactivation; `testSessionCookie`, `seedTestUsers` from `test/`). Log assertion: spy `console.*` across generate + login and assert no call contains the code; assert `login_codes` row holds no plaintext.
- `src/client/api.ts` -- `ApiError` gains an optional `retryAfter: number | null` read from `Retry-After` on a 429 (additive, existing callers unchanged).
- `src/client/format.ts` -- `formatBrusselsTime(epochMs)` → "15:24" (fr-FR, Europe/Brussels); format.ts is already field-reachable.
- `src/client/auth/LoginScreen.tsx` -- mode state, second `useForm` with `z.pick(codeLoginSchema, {code:true})`, lockout timer (clear on unmount). Tests in `LoginScreen.test.tsx` (fake timers for re-enable).
- `src/client/copy/field.ts` L189-204 -- code lede, label, required, refused, switch labels, the two lockout sentences.
- `src/client/admin/queries.ts` -- `useGenerateCode()` POST, no invalidation (list unchanged).
- `src/client/admin/agents/RowMenu.tsx` -- `onGenerateCode` first item; update the "No code item" comment. Wire through `UsersTable.tsx` / `UsersList.tsx` `actions` and `AgentsScreen.tsx` (L93 pattern).
- `src/client/admin/agents/CodeDialog.tsx` (new) -- shadcn `Dialog`; `navigator.clipboard.writeText`; `toast` from sonner. Strings in `src/client/copy/admin.ts` `agents`.
- `src/client/admin/agents/AgentsScreen.test.tsx` -- generate → dialog content, Copier both branches, failure toast.
- Docs: `docs/api.md` L15 (login row) + new row after L37; `docs/data-model.md` ER block + paragraph near L118 + rule at L185; `docs/domains/identity-access.md` L26-31.

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/credential.ts`, `schemas.ts` + tests -- normaliser and wire contract (additive member of the union).
- [ ] `src/worker/db/schema.ts`, `drizzle/0011_*` -- expand-only table.
- [ ] `src/worker/session.ts`, `routes/auth.ts`, `routes/identity.ts` + worker tests -- generate, login, deactivation; every matrix row on the worker side.
- [ ] `src/client/api.ts`, `format.ts`, `copy/field.ts`, `auth/LoginScreen.tsx` + tests -- code form, swap, lockout.
- [ ] `src/client/copy/admin.ts`, `admin/queries.ts`, `admin/agents/*` + tests -- menu item and code Dialog.
- [ ] `docs/api.md`, `docs/data-model.md`, `docs/domains/identity-access.md` -- new table, route and login kind.

**Acceptance Criteria:**
- Given `pnpm build`, when the precache check runs, then it passes; the PR quotes the total against 1,000 KiB.
- Given the migration, when applied to a database the deployed Worker uses, then the Worker still works (new table only).
- Given the existing suites, when they run, then only tests whose expectations this story changes are edited.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- all green.
- `pnpm db:migrate:local` -- applies cleanly.

**Manual checks:**
- On `pnpm dev`: the story's Verify list (agent enrols with lowercase+space and the row turns Inscrit; admin own-row code opens /admin; swap and break-glass; lockout after 10 failures re-enables on its own).

## Implementation Notes

- Implemented by a general-purpose subagent, which also applied the pass-1 patches.
- Code login spends the code and inserts the session in one `db.batch`; the insert is an `INSERT … SELECT` gated on `used_at = now`, an active user and `changes() = 1`, so a loser in the same millisecond inserts nothing (tested with a frozen clock).
- The generate route inserts with `INSERT … SELECT … FROM users WHERE active = 1`, so a user deactivated meanwhile gets no code.
- Verification after the patches: `pnpm typecheck`, `lint`, `test` (95 files, 2409 tests), `build` and `db:migrate:local` green; precache 940.85 KiB of 1,000 KiB. The manual `pnpm dev` checks were not run here.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough; blind-hunter, edge-case-hunter, verification-gap, intent-alignment; plus security-reviewer and migration-guard, which the story and the d1-migration skill ask for). Verdicts: high 0, medium 1, low 14, false 6, maybe-false 0.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | blind, edge, vgap, security | Code spend and session insert are two statements: a deactivation between them leaves a session that revives on reactivation; a failed insert burns the code | medium | patch: one `db.batch`, session `INSERT … SELECT` gated on the spend and an active user |
| 2 | blind, edge | Swapping forms mid-sign-in re-enables the other submit and words the refusal for the wrong form | low | patch: `submitting` covers both forms; swap disabled while submitting |
| 3 | vgap | Mobile `UsersList` "Générer un code" wiring never exercised | low | patch: `setMobile(true)` case |
| 4 | blind | Issued code stays in the mutation cache after the dialog closes | low | patch: `gcTime: 0` |
| 5 | blind | `newLoginCode` bit slicing only checked by a regex | low | patch: known-vector unit test |
| 6 | blind | Generate without `AUTH_PEPPER` untested | low | patch: 500 test, no row stored |
| 7 | blind, edge | Two generates in flight may show the superseded code | low | reject: the menu closes on select and D1 serialises the batches in arrival order; the fix adds pending state |
| 8 | edge | Huge `Retry-After` overflows `setTimeout` / throws in formatting | low | reject: the server sends at most 900 s (`login-throttle.ts`); fix adds a guard |
| 9 | edge | A code over 200 chars gets 400 and the generic message | low | reject: no 8-char code is typed that long; fix adds a branch |
| 10 | blind | 409 `user_inactive` does not refresh the stale row | low | reject: needs two admins acting at once; generic toast per design.md |
| 11 | blind | Typographic dashes are not ignored by the normaliser | low | reject: Copier writes the code without separators and the rule (auth-data.md) names hyphens; widening it changes the shared contract |
| 12 | blind | 404 body has no `message`; api.md omits 500/403 | low | reject: same 404 shape as PATCH; 403 is the documented convention for every admin route |
| 13 | blind | No client tests for 426, HTTP-date `Retry-After` | low | reject: 426 is entry 12; HTTP-date falls to the tested fallback |
| 14 | edge | 40-bit hash collision with a kept row → 500 | low | reject: negligible odds with one live code per user; the sweep (entry 13) bounds the table |
| 15 | security | No record of which admin minted a code (impersonation without audit) | low | reject as code work: admins are trusted by design (ADR-0029); stated as accepted risk in the PR |
| 16 | blind | Drizzle snapshot 0011 missing | false | `drizzle/meta/0011_snapshot.json` exists and chains to 0010 (migration-guard); it was only excluded from the review diff |
| 17 | edge | Generate on an inactive user still deletes unused codes | false | deactivation only happens through PATCH, which deletes them, so an inactive user holds none |
| 18 | edge | Lockout time uses the device clock | false | design.md § The login page defines it as `Retry-After` added to now |
| 19 | blind | No sweep index; a repeated deferral should schedule the enabler | false | the sweep is already its own story (epic entry 13), not a deferral |
| 20 | intent | Real `Retry-After` never meets the client parser | false | the throttle test asserts the header's seconds value; the client parses the same delta-seconds form |
| 21 | intent | No end-to-end run joins the Agents page, `/login` and the round | false | not a code defect: it is the story's manual `pnpm dev` check, reported in the PR |
| — | migration-guard | Expand-only, generated, snapshot chain intact | — | safe; one release step |
