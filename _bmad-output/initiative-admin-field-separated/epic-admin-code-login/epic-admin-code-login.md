---
tracker_id: "580"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/580"
tracker_status: done
status: done
type: epic
title: "Admins sign in with an email and a code"
parent: initiative-admin-field-separated
covers: [R9, R10, R11, R12]
after: []
assignee: ""
risk: medium
---

# Admins sign in with an email and a code

## Description

The admin form on `/login` takes an email and a generated passphrase (ADR-0029, decision 3). The owner wants one kind of credential: the admin form takes an email and a code, generated from the Utilisateurs screen by the admin on a device already signed in, or by another admin. The passphrase goes everywhere. Each form checks the role, so the two forms stay two doors. Break-glass stays in the admin form as today, for when no admin is signed in anywhere.

## Outcome

Every sign-in uses a one-time code, and break-glass is the only other way in, used rarely. The signal is that `passphrase` appears nowhere in `src`.

## Requirements

- R9: the admin form takes Adresse e-mail and Code; the passphrase is removed (the `passphrase_hash` column, `PassphraseDialog`, Nouvelle phrase de passe, the passphrase check and schema, their throttle and session branches, and copy). The admin route stays: it takes email + code, or break-glass.
- R10: the agent form accepts only an agent's code; the admin form only an admin's code for the email typed; anything else gets the same 401 as a wrong code.
- R11: an admin generates a code for themselves or another admin from Utilisateurs; `CodeDialog.tsx` is unchanged (its admin line was dropped, Decision 2026-10-22). Break-glass is unchanged: `OWNER_EMAIL` plus the raw `BREAK_GLASS`, tested before the code is normalised.
- R12: an ADR amending ADR-0029 (decisions 3 and 7, and an alternatives row for codes only) is accepted before the other stories are cut.

## Done when

1. An admin signs in with email and a fresh code on the admin form and lands on `/admin`; the same code on the agent form gets 401.
2. An agent's code on the admin form gets 401, and break-glass still opens `OWNER_EMAIL`.
3. A grep for `passphrase` in `src` finds nothing, and one migration drops `passphrase_hash`.
4. The amending ADR is accepted, the epic is on production through CI, and `docs/design.md` (the login page), `docs/domains/identity-access.md`, `docs/api.md`, `docs/data-model.md`, `docs/security.md` and `docs/deployment.md` match what shipped.

## Boundaries

The login page, the auth routes, the codes and users tables, the Code généré dialog and ADR-0029. Not the code's format, lifetime or normaliser. Not passkeys. Not the agent form's behaviour for agents.

## References

- parent — _bmad-output/initiative-admin-field-separated/initiative-admin-field-separated.md, Requirements R9–R12
- adr — docs/adr/0029-own-login-instead-of-cloudflare-access.md, decisions 3 and 7, and Alternatives considered
- domain — docs/domains/identity-access.md
- design — docs/design.md, section The login page
- skill — .claude/skills/d1-migration/SKILL.md

## Notes

- Decision (2026-10-19): two forms stay; the owner declined a single code field.
- Decision (2026-10-19): only the ADR story is planned now; the rest is cut once the ADR is accepted.
- Decision (2026-10-19): the ADR story waits on 2.1 only because both take the next ADR number and edit docs/adr/README.md; the implementation stories pin the epic `after` when they are cut.
- Waits on epic-admins-leave-the-field because: both edit the Utilisateurs screen's row menu.
- Decision (2026-10-21): first story (tracer bullet) is 3.2, the role-checked login with the `admin` kind, through schema, Worker and login form. The chain is 3.2 → 3.3 → 3.4 with no parallel lane: 3.3 shares auth.ts, schemas.ts and auth.test.ts with 3.2, and its grep only passes after both.
- Decision (2026-10-21): the CodeDialog line for admins rides with the passphrase removal in 3.3, not on its own: both edit the tabbed UsersScreen (#607) and design.md › Utilisateurs.
- Decision (2026-10-21): between the merges of 3.2 and 3.3, Nouvelle phrase de passe still issues a passphrase no form accepts; accepted while the data stage is disposable and the owner is the only admin.
- Decision (2026-10-21): no mockups. The admin form's Phrase de passe → Code and the CodeDialog line for admins are copy-only (owner); everything else is removal.
- Decision (2026-10-21): a refactor sweep (3.4) closes the epic and confirms the Done when on production.
- Decision (2026-10-22): R11's code-dialog line is dropped (owner). An admin who types their code on the agent form gets the same refusal as an agent with a wrong code, and the code stays unspent; `CodeDialog` is unchanged.
- Closed (2026-10-22): closure check passed on R9–R12 and every Done when; stories #583, #610, #611 and #612 are done and on production through the Deploy run on c187e9b. The dropped code-dialog line is the only scope change; ADR-0038's follow-up list still names it (#619).
