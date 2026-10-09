---
title: 'An admin signs in with a generated passphrase and enrols their own devices'
type: 'feature'
created: '2026-10-08'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '5cec15f78cf576abb68cb8b4028994fb9ff1f8cd'
context:
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Only break-glass and one-time codes open sessions, so an admin has no lasting credential of their own to sign in with on a new device or after a session ends (GH #306, CAP-3, CAP-4).

**Approach:** A route that generates the signed-in admin's own 20-character Crockford passphrase and stores only its HMAC in `users.passphrase_hash`; `kind: "passphrase"` on `POST /api/auth/login` accepts it for any active admin after the break-glass check; PATCH clears the hash on demotion or deactivation; "Nouvelle phrase de passe" on the admin's own row opens the confirming AlertDialog and then the passphrase Dialog, per design.md.

## Boundaries & Constraints

**Always:**
- Generate: `POST /api/admin/me/passphrase`, no body, acts only on `c.get("identity").email`. 20 chars from `crypto.getRandomValues` over `CROCKFORD` (100 bits). One `UPDATE users SET passphrase_hash = hmacHex(AUTH_PEPPER, passphrase) WHERE email = caller AND role = 'admin' AND active = 1 RETURNING`. 200 `{passphrase}`, the only time it is returned. No matching row (e.g. an Access-only admin with no `users` row) → 404 `not_found`, nothing written. No `AUTH_PEPPER` → 500 `misconfigured`. Sessions are left as they are.
- Login `kind: "passphrase"`: break-glass first, exactly as today (as typed, `OWNER_EMAIL` + `BREAK_GLASS`). If it does not match — or `OWNER_EMAIL`/`BREAK_GLASS` are unset — fall through to the user check: always compute `hmacHex(pepper, normaliseCredential(passphrase))`, read the user row, compare with `crypto.subtle.timingSafeEqual` against the stored hash or a fixed dummy of equal length when there is none. Success requires the row active, role admin and the hash equal. The session is inserted with an `INSERT … SELECT FROM users WHERE email = ? AND role = 'admin' AND active = 1 AND passphrase_hash = ?`, so a concurrent demotion, deactivation or regeneration opens no session. Role and TTL from `users`.
- Every refusal (unknown email, no passphrase, deactivated, agent, wrong passphrase) is the same 401 `REFUSED` body after the same HMAC and DB work; the throttle counts it.
- PATCH `/users/:email`: when the body sets `role: "agent"` or `active: false`, the same `UPDATE` also sets `passphrase_hash = NULL`. A refused PATCH (last_admin) writes nothing.
- Client: "Nouvelle phrase de passe" sits after "Générer un code", only where `user.email === self`. AlertDialog "Remplacer votre phrase de passe ?" → Annuler / Remplacer → POST → Dialog "Votre phrase de passe" in 5 groups of 4, `text-display` tabular, Copier and Terminé. A failed POST toasts the generic failure. Mutation `gcTime: 0`. Strings in `copy/admin.ts`.
- Decision (2026-10-08, owner): spec kept whole above 1,600 tokens; the refused-clipboard toast reads "Copie impossible. Recopiez-la à la main."; the route is `POST /api/admin/me/passphrase`, 404 without a matching row.
- Nothing logs a passphrase or a hash. docs/api.md, docs/data-model.md, docs/domains/identity-access.md change here.

**Never:** no migration; no route accepting a chosen passphrase or another user's email; no change to break-glass semantics, the login form or `/login` copy (entry 8); no device list or revoking (entry 10); no sign-out on regeneration; no new dependency; no sync contract change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Generate | active admin caller | 200 `{passphrase: 20 Crockford}`; column holds its HMAC only | — |
| Generate, no row | Access-only admin | — | 404, nothing written |
| Regenerate | second generate | old passphrase → 401, new → 200 | — |
| Login | `"k7qm-2xpa-…"` lowercase, hyphens, O for 0 | 200 `{email, role:"admin"}` + 30-day cookie | — |
| Refused | unknown email / null hash / inactive / agent / wrong | — | same 401 body; throttle counts |
| Break-glass | `OWNER_EMAIL` + `BREAK_GLASS` | unchanged 200 | — |
| Demote / deactivate | PATCH `{role:"agent"}` / `{active:false}` | `passphrase_hash` NULL | last_admin 409 writes nothing |
| Menu | another user's row | no "Nouvelle phrase de passe" | — |
| Copier | clipboard ok / refused | "Phrase de passe copiée." / "Copie impossible. Recopiez-la à la main." | stays on screen |

</frozen-after-approval>

## Code Map

- `src/worker/session.ts` L67-78 -- `newLoginCode()` builds 8 Crockford chars from 5 bytes; generalise to a `crockfordRandom(length)` helper (ceil(length*5/8) bytes) and add `newPassphrase()` = 20 chars; keep `newLoginCode` and its known-vector test passing.
- `src/shared/credential.ts` -- `CROCKFORD`, `normaliseCredential`; reuse unchanged.
- `src/shared/schemas.ts` L92-122 -- update the login comment (passphrase now covers break-glass and generated). Add `passphraseResponseSchema {passphrase: string}` beside `loginCodeResponseSchema` (L510).
- `src/worker/routes/auth.ts` L101-131 -- restructure the passphrase branch: break-glass success path kept verbatim; on miss, the user path per Always. `REFUSED` stays the single body. Update header comment.
- `src/worker/routes/identity.ts` -- add `POST /me/passphrase` (mounted under `/admin`, so `requireAdmin` applies; `c.get("identity")`); PATCH L95-98 `set.passphraseHash = null` when demoting/deactivating. Header comment.
- `src/worker/auth.test.ts` (break-glass describe ~L94, throttle ~L404) and `src/worker/users.test.ts` (`testSessionCookie`, `seedTestUsers`) -- worker tests; spy `console.*` and assert no call contains the passphrase; assert the column is 64-hex, not the passphrase.
- `src/client/admin/queries.ts` L221-233 -- `useGeneratePassphrase()` like `useGenerateCode`, POST `/api/admin/me/passphrase`.
- `src/client/admin/agents/RowMenu.tsx` -- optional `onNewPassphrase`; render item when given; update comment. `UsersTable.tsx` / `UsersList.tsx` -- `UsersActions.onNewPassphrase`, passed only when `user.email === actions.self`.
- `src/client/admin/agents/PassphraseDialog.tsx` (new) -- AlertDialog confirm then Dialog; model on `CodeDialog.tsx` and `DeactivateDialog.tsx` (AlertDialog). Wire in `AgentsScreen.tsx`.
- `src/client/copy/admin.ts` `agents` -- `newPassphrase`, `passphraseDialog {confirmTitle, confirmBody, cancel, replace, title, save, copy, done, copied, copyFailed}`.
- `src/client/admin/agents/AgentsScreen.test.tsx` -- own row only, confirm → shown 5×4, Copier both branches, failure toast, mobile list wiring.
- Docs: `docs/api.md` L15 login row + new row after the `/code` row; L36 "Created … with no passphrase" ok; PATCH row adds the clear. `docs/data-model.md` `passphrase_hash` comment. `docs/domains/identity-access.md` L39-40 replace "a later entry" with the rule.

## Tasks & Acceptance

**Execution:**
- [x] `src/worker/session.ts` + `session.test.ts` -- passphrase generator.
- [x] `src/shared/schemas.ts` -- response schema, comments.
- [x] `src/worker/routes/identity.ts`, `routes/auth.ts` + `users.test.ts`, `auth.test.ts` -- generate, login, PATCH clear; every worker matrix row and the issue's worker list.
- [x] `src/client/copy/admin.ts`, `admin/queries.ts`, `admin/agents/*` + `AgentsScreen.test.tsx` -- menu item and dialogs.
- [x] `docs/api.md`, `docs/data-model.md`, `docs/domains/identity-access.md`.

**Acceptance Criteria:**
- Given `pnpm build`, when the precache check runs, then it passes and the PR quotes the total against 1,000 KiB.
- Given the existing suites, when they run, then only tests whose expectations this story changes are edited.
- Given the PR, when it is opened, then it asks for the security-reviewer agent's review before merge.

## Implementation Notes

- Implemented by a general-purpose subagent, which also applied the pass-1 patches.
- `newLoginCode` and `newPassphrase` share a private `crockfordRandom(length)` in `session.ts`; the code's known-vector tests are unchanged.
- Verification after the patches: `pnpm typecheck`, `lint`, `test` (95 files, 2,440 tests) and `build` green; precache 940.85 KiB of 1,000 KiB. The manual `pnpm dev` checks were not run here.
- Baseline re-stamped at PR time to `5cec15f78cf576abb68cb8b4028994fb9ff1f8cd` (was `35ad4c107d91d88b20d5bc2b6b044fdd105399b1`): the branch was rebased onto `origin/main` after refinement PR #334 (planning files only) merged.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough; blind-hunter, edge-case-hunter, verification-gap, intent-alignment; plus security-reviewer, which the story asks for). Verdicts: high 0, medium 0, low 9, false 5, maybe-false 0.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | edge, blind | Escape or a scrim click on the result Dialog discards the only display of the passphrase | low | patch: Escape and scrim blocked; the admin is still signed in and could regenerate, so not worse than low |
| 2 | security | `/me/passphrase` 200 lacks `Cache-Control: no-store` | low | patch: one header, as `routes/admin.ts` does |
| 3 | blind | Login test exercises O→0 on ~47% of runs and I/L→1 never | low | patch: fixed seeded passphrase with 0 and 1 |
| 4 | vgap, blind | The `INSERT … SELECT` re-check is never reached by a test (no hook between read and insert) | low | defer (lens's filed disposition): same untested pattern as `/users/:email/code`; deferred-work.md |
| 5 | security | Generating needs no fresh sign-in: a stolen admin session mints a lasting passphrase | false | no added exposure: the same session can already mint a code for its own row and enrol a lasting device (#305); the issue's decisions settle the route's shape |
| 6 | edge | Double click on Remplacer sends two POSTs | low | reject: Remplacer is disabled while pending and Radix re-renders before a second click lands in practice; fix adds a ref guard |
| 7 | blind | First generation still says "Remplacer… L'ancienne…" | false | the wording is design.md's, verbatim |
| 8 | blind | Copy does not say other sessions survive regeneration | low | reject: wording is design.md's; revoking is entry 10 |
| 9 | blind | Session insert is positional SQL, not `newSession` | low | reject: same `INSERT … SELECT` pattern as the code login (#305); reuse needs a refactor |
| 10 | blind | No login test after demote→promote | low | reject: the column is NULL (tested) and the login requires a hash match |
| 11 | blind | 500 test asserts only one row's hash | low | reject: the route writes the caller's row only, tested elsewhere |
| 12 | blind | Glossary has no "passphrase" entry | false | CLAUDE.md asks to use glossary words, not to add every term; no rule broken |
| 13 | blind | Spec review record empty | false | this log is written in the review step |
| 14 | blind | Fixture `agentHash` also seeds an admin row | false | cosmetic name only; the test asserts what it says |
| — | intent | Diff implements the API reading; the `/login` end-to-end is only the manual `pnpm dev` check | — | noted in the PR; no code finding |

## Design Notes

The user path runs even when break-glass is configured but missed, so the owner's generated passphrase also works. Timing parity: break-glass costs two HMACs whenever configured, and the user path always costs one HMAC plus one indexed read, whichever way it ends.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- all green.

**Manual checks:**
- On `pnpm dev`: the issue's Verify list (own-row menu, confirm, 5×4 display, Copier; second browser lowercase/hyphen/O sign-in; regenerate refuses the old one; same Alert for wrong email and wrong passphrase; another row lacks the item; break-glass works).
