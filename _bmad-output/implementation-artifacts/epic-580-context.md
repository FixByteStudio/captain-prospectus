# Epic 580 Context: Admins sign in with an email and a code

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Every sign-in uses one kind of credential: a one-time code. The admin form on `/login` takes an email and a code instead of a generated passphrase, and each form checks the role, so the agent form and the admin form stay two doors. Break-glass stays in the admin form for when no admin is signed in anywhere. The signal is that `passphrase` appears nowhere in `src`. (Planning artifacts dir holds only research and UX; the epic, the accepted ADR-0038 and the stories were the sources.)

## Stories

- Story 1: ADR: admins sign in with an email and a code (accepted, ADR-0038)
- Story 2: Each sign-in form checks the role
- Story 3: Utilisateurs offers codes only
- Story 4: Refactor sweep

## Requirements & Constraints

- The admin form asks for Adresse e-mail and Code. The passphrase goes entirely: `passphrase_hash` column, `PassphraseDialog`, Nouvelle phrase de passe, its check, schema, throttle and session branches, and copy.
- The agent form accepts only an active agent's code; the admin form only an active admin's code for the email typed. Any other combination (admin code on agent form, agent code on admin form, another admin's code, wrong email) gets the same 401 as a wrong code.
- A refused code is not spent: it still works on the right form. Every refusal counts against the per-IP throttle.
- An admin generates a code for themselves or another admin from Utilisateurs. The code dialog (« Code pour {name} ») gets no line about Accès administrateur (dropped by the owner, 2026-10-22).
- Break-glass is unchanged: `OWNER_EMAIL` plus the raw `BREAK_GLASS`, compared as typed (`timingSafeEqual` over HMACs) and tried before the field is normalised as a code.
- Out of scope: the code's format, lifetime and normaliser, passkeys, the agent form's behaviour for agents.
- Done when: admin email + fresh code lands on `/admin` and the same code on the agent form gets 401; an agent's code on the admin form gets 401 and break-glass still opens `OWNER_EMAIL`; `grep passphrase src` is empty and one migration drops `passphrase_hash`; the epic is on production through CI and `docs/design.md` (login page), `docs/domains/identity-access.md`, `docs/api.md`, `docs/data-model.md`, `docs/security.md`, `docs/deployment.md` match.

## Technical Decisions

- `POST /api/auth/login` keeps one route and a `zod/mini` union in `src/shared/schemas.ts`: `{ kind: "code", code }` (agent form) and `{ kind: "admin", email, code }` (admin form). A kind now names the form, replacing ADR-0029's "kind names the credential, never the role". A later `passkey` kind stays additive.
- The role check lives in the conditional UPDATE that spends the code (in `src/worker/routes/auth.ts`), which is why a refused code stays unspent.
- Not a sync contract change: `CLIENT_VERSION` does not move. Data stage is disposable: one migration dropping `users.passphrase_hash`, no backfill (use the `d1-migration` skill; migration-guard reviews it).
- Remove `POST /api/admin/me/passphrase`, `newPassphrase`, `passphraseResponseSchema`, `useGeneratePassphrase`, the clear-on-deactivate branch and the passphrase cleanup on demotion in `identity.ts`.
- `CodeDialog` is unchanged for admins: no admin-only line (owner, 2026-10-22).
- French strings go in `src/client/copy.ts` modules (admin form copy in `copy/field.ts`); forms use react-hook-form with shadcn `form`.
- A code costs one HMAC, well inside the 10 ms CPU budget; nothing new is billed.

## UX & Interaction Patterns

- No mockups: Phrase de passe becomes Code on the admin form, copy only. The exact French of the admin form's lede and refusal (`adminLede`, `adminRefused`) is asked of the owner by the builder.
- Check the login page and Utilisateurs sections of `docs/design.md`.

## Cross-Story Dependencies

- Strict chain 2 -> 3 -> 4, no parallel lane: stories 2 and 3 share `auth.ts`, `schemas.ts` and `auth.test.ts`, and the grep only passes after both. Story 2 is the tracer bullet and needs only story 1 (accepted).
- Story 3 waits on the admins-leave-the-field epic's story 6 (tabbed `UsersScreen`, #607, and its row menu); story 4 closes the epic and confirms Done when on production.
- Between the merges of 2 and 3, Nouvelle phrase de passe still issues a passphrase no form accepts; accepted while the stage is disposable and the owner is the only admin.
- Unknown for the builder: whether drizzle-kit emits a plain DROP COLUMN or rebuilds the users table.
