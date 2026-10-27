---
tracker_id: "634"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/634"
tracker_status: done
status: done
id: 2
type: story
title: "Tests and lint pin what the admin-field split and the code login loosened"
parent: epic-retro-follow-ups
covers: [CAP-2, CAP-3, CAP-4, CAP-5, CAP-6]
after: [1]
risk: medium
---

# Tests and lint pin what the admin-field split and the code login loosened

## Description

S2, CAP-2 to CAP-6 (579/3, 580/5; F-B, F-E, V-4, C-4, C-8, V-3, V-5, D-4): a Worker test sends a real admin D1 session with DEV_USER_EMAIL unset and gets 403 on /api/agent/sync and the visits route, in src/worker/auth.test.ts rather than sync.test.ts, which entries 4 and 6 edit (CAP-2); a lint rule or test fails on role !== "admin" in agent.ts or a client field file and on the word passphrase in src, and the "pass" + "phrase" string leaves users.test.ts (CAP-3); a client test shows an admin identity keeps every outbox row across a 403 and an App visit, in the App tests rather than src/client/field/sync.test.ts, which entries 3 and 6 edit (CAP-4); the Utilisateurs row menu is asserted as an exact item set in place of the /Passer (admin|agent)/ assertions, optionally with a start_url manifest test and an App-level Hors ligne body assertion (CAP-5); and the sign-in tests pin a rejected passphrase kind, an admin code spent just before and at 1 h, two real admins with live codes, a role flip between mint and spend, break-glass on the agent form leaving no users or sessions row (the form-level check only; entry 1 owns the Worker-level refusal test), and the admin form's state on swap (CAP-6).

## Acceptance Criteria

Verify: Five hand mutations each turn pnpm lint or pnpm test red: role !== "admin" added to src/worker/routes/agent.ts, the word passphrase added to a file in src, any outbox row deleted on an admin 403, a role toggle re-added to the Utilisateurs row menu under a new label, and the TTL CASE branches swapped in src/worker/routes/identity.ts.

## References

- parent — _bmad-output/initiative-retro-follow-ups-2026-10/epic-retro-follow-ups/epic-retro-follow-ups.md

## Notes

- Open question: Whether the Done-when greps are best kept by an ESLint rule (no-restricted-syntax or a custom rule in eslint.config.js) or by a test that scans src; and how CAP-6's rejected passphrase kind test coexists with CAP-3's ban on the word: assumed one named allowlist entry for that test, in place of the "pass" + "phrase" trick at src/worker/users.test.ts:429, unless the owner prefers otherwise.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
