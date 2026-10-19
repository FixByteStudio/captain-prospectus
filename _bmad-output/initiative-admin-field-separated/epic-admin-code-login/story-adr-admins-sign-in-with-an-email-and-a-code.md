---
tracker_id: "583"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/583"
tracker_status: backlog
id: 1
type: story
title: "ADR: admins sign in with an email and a code"
parent: epic-admin-code-login
covers: [R9, R10, R11, R12]
after: [2.1]
hitl: true
risk: low
---

# ADR: admins sign in with an email and a code

## Description

Writes, through the new-adr skill, an ADR recording R9–R11: the admin form takes an email and a one-time code instead of a passphrase, each form checks the role, an admin gets a code from their own row or another admin, and break-glass stays in the admin form; it amends ADR-0029's decisions 3 and 7, adds codes-only to its alternatives, and updates the ADR index.

## Acceptance Criteria

Verify: The ADR is proposed in a pull request, ADR-0029 links to it where it is amended, and the owner sets it accepted.

## References

- parent — _bmad-output/initiative-admin-field-separated/epic-admin-code-login/epic-admin-code-login.md

## Notes

- Open question: Whether a code typed on the admin form with OWNER_EMAIL is tried as break-glass first or as a code first when both could match.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->

- ADR-0038 (`docs/adr/0038-admins-sign-in-with-an-email-and-a-code.md`), status `proposed`.
- Open question answered in the ADR, decision 3: break-glass is tried first, on the raw text, then the field is spent as a code.
- The ADR also amends decision 5: `passphrase` becomes `kind: "admin"` (email + code), and each kind serves one role.
- ADR-0029's status line and `docs/adr/README.md` link to it.
