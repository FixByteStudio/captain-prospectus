---
tracker_id: "640"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/640"
tracker_status: done
status: done
id: 9
type: story
title: "Docs pass: docs, ADRs, glossary, comments and planning files match what shipped"
parent: epic-retro-follow-ups
covers: [CAP-7, CAP-8, CAP-9, CAP-10, CAP-11, CAP-12]
after: [1, 2, 4, 7, 8]
hitl: true
risk: low
---

# Docs pass: docs, ADRs, glossary, comments and planning files match what shipped

## Description

S9, CAP-8 (579/2, 580/1, F-G, S-1), CAP-9 (579/4, 580/6, 538/2), CAP-10 (580/6, R-2, R-3), CAP-11 (579/4), CAP-12 (580/6, R-4) and entry 1's docs line: one line in ADR-0038 or ADR-0039 and one in docs/domains/identity-access.md say an admin can mint a code for any active user, agent or admin, and sign in as them, and that nothing records it (CAP-8); identity-access.md says break-glass refuses an agent row; every line of the CAP-9 list in slices.md is changed or struck; ADR-0038 notes the dropped dialog line, points to ADR-0039 for the unchanged lifetime and strikes its promise about ADR-0029 decisions 1 and 4, closing #619 (CAP-10); EXPERIENCE.md stops sending an offline admin to the field side at :23, :72, :80, :88, :120, :123, :189 and :264, closing #621 (CAP-11); the dropped dialog line leaves _bmad-output/initiative-admin-field-separated/epic-admin-code-login/tickets.toml entry 3 and epic-580-context.md:21,32,38, and initiative-admin-field-separated.md:47 stops saying no passphrase exists in the docs, since ADR-0029 and ADR-0038 keep the word as history (CAP-12, R-4); EXPERIENCE.md:189 and docs/design.md take entry 7's final offline wording; it waits on entry 2 for the names and comments its tests settle, on entry 4 for docs/api.md and the received_at docs, and on entries 1, 7 and 8 for the code they change; no code behaviour or schema changes.

## Acceptance Criteria

Verify: Each CAP-9 line is ticked or struck in the PR, a grep of EXPERIENCE.md for the admin-in-the-field wording finds nothing, the ADR-0038 and identity-access.md lines exist, #619 and #621 close on merge, and pnpm lint passes.

## References

- parent — _bmad-output/initiative-retro-follow-ups-2026-10/epic-retro-follow-ups/epic-retro-follow-ups.md

## Notes

- Open question: Which of the optional CAP-9 lines (the C-7 copy, the AdminOfflineScreen raw button comment, the security.md and deployment.md:94 code-lifetime lines, constants.ts:172) the builder takes; each is ticked or struck in the PR.
- The CAP-8 docs line is hitl: PR says "Refs #n", I close.
- S9 closes #619 and #621 — link them, don't duplicate.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
