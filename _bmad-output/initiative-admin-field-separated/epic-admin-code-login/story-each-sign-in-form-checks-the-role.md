---
tracker_id: "610"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/610"
tracker_status: backlog
id: 2
type: story
title: "Each sign-in form checks the role"
parent: epic-admin-code-login
covers: [R9, R10, R11]
after: [1]
risk: medium
---

# Each sign-in form checks the role

## Description

Replaces the `passphrase` login kind with `{ kind: "admin", email, code }` in schemas.ts and auth.ts, where the conditional UPDATE that spends a code accepts only an agent's code on the agent form and only the typed admin's code on the admin form (anything else the same 401, the code left unspent), break-glass tried first on the raw text; LoginScreen's admin form asks for Adresse e-mail and Code, with its copy in copy/field.ts, and api.md, identity-access.md, security.md and design.md › The login page follow.

## Acceptance Criteria

Verify: auth.test.ts shows an admin's email and code open an admin session on the admin kind while the same code on the code kind gets 401 and still works afterwards, an agent's code or another admin's email on the admin kind gets 401, and OWNER_EMAIL plus BREAK_GLASS still signs in; on `pnpm dev` an admin signs in with email and a fresh code and lands on /admin.

## References

- parent — _bmad-output/initiative-admin-field-separated/epic-admin-code-login/epic-admin-code-login.md
- adr — docs/adr/0038-admins-sign-in-with-an-email-and-a-code.md, Decision 2 and 3
- code — src/worker/routes/auth.ts
- code — src/client/auth/LoginScreen.tsx

## Notes

- Open question: The exact French of the admin form's lede and refusal (adminLede, adminRefused) once it asks for a code; the builder asks the owner.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
