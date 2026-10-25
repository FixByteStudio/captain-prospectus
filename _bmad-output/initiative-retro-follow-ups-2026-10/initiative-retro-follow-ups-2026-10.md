---
tracker_id: "7"
remote: "https://github.com/FixByteStudio/captain-prospectus/milestone/7"
type: initiative
title: "Retro follow-ups, October 2026"
parent: none
covers: [CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-6, CAP-7, CAP-8, CAP-9, CAP-10, CAP-11, CAP-12, CAP-13, CAP-14, CAP-15, CAP-16, CAP-17, CAP-18, CAP-19, CAP-20]
after: []
assignee: ""
risk: medium
---

# Retro follow-ups, October 2026

## Description

Three retros closed on 2026-10-24: epic #538 (the numbered tournée holds), epic #579 (admins leave the field side) and epic #580 (admins sign in with an email and a code). All three were accepted with open items, and their actions overlap. This initiative turns those actions into one counted list, so the next retro does not find them open again. The spec owns the capabilities (CAP-1 to CAP-20), constraints and non-goals: `_bmad-output/specs/spec-retro-follow-ups-2026-10/SPEC.md`. The work fits one epic, `epic-retro-follow-ups`, cut along the spec's slices (`slices.md`, S1–S11).

## Outcome

The owner and the agents who build this repo stop re-finding the same retro items. The signal is the spec's success signal: the next retro of this lineage finds none of CAP-1 to CAP-19 open, the day-rule decision exists, and no hand-copied precache number or unguarded Done-when grep is left for review to catch.

## Requirements

Held by the spec: `_bmad-output/specs/spec-retro-follow-ups-2026-10/SPEC.md`, section Capabilities (CAP-1 to CAP-20). The one epic covers all of them.

## Done when

1. Invariant 5 is pinned on both outboxes: deleting every sent prospect in `src/client/field/sync.ts`, or any admin outbox row on a 403, fails a test.
2. Adding `role !== "admin"` to the field side, or the word `passphrase` to `src`, turns CI red. An admin D1 session gets 403 on the field API in a committed test with `DEV_USER_EMAIL` unset.
3. The two twice-deferred enablers are done: the Visites feed cursor lists every sync's visits whatever order they commit in, and the only precache number a PR author sees is the `check:precache` line against 1,000 KiB.
4. Break-glass refuses an agent row; the docs say that an admin can mint a code for any active user and that nothing records it; #562, #619 and #621 are closed.
5. The process lines the retros asked for are in `CLAUDE.md` or the skills, and an ADR, or a recorded "no ADR" note, says which clock decides "today".
6. Every code change reached production through CI.

## Boundaries

Tests, lint, the break-glass login, the Visites feed cursor, the build and CI precache output, the admin offline screen, the code dialog and login forms, the docs, ADRs and planning files the three retros name, and the process lines in `CLAUDE.md` and the skills. Not the spec's non-goals: the production sign-in check (580/4), #627, #605 and #597, tracker hygiene (538/8, 579/8), the pavement test (538/9), replies to the CodeRabbit comments (538/3), N4–N7 of #538, and the findings the retros accepted. No code story on the day rule before CAP-20 lands.

## References

- spec — _bmad-output/specs/spec-retro-follow-ups-2026-10/SPEC.md, section Capabilities
- spec — _bmad-output/specs/spec-retro-follow-ups-2026-10/slices.md, sections Slices, CAP-9 list, CAP-18 list, Source trace
- retro — _bmad-output/implementation-artifacts/epic-538-retro-2026-10-24.md, section Action items
- retro — _bmad-output/implementation-artifacts/epic-579-retro-2026-10-24.md, section Action items
- retro — _bmad-output/implementation-artifacts/epic-580-retro-2026-10-24.md, section Action items
- constraint — _bmad-output/specs/spec-retro-follow-ups-2026-10/SPEC.md, section Constraints
- constraint — docs/adr/0033-rollout-rules-wait-for-protected-data.md

## Notes

- Decision (2026-10-25): a new initiative with one epic, as `initiative-tournee-hardening` did for the #496 retro. The owner asked for one story per slice of `slices.md`, in its order.
- Decision (2026-10-25): no platform-baseline epic. The platform is in production; this initiative fixes and pins shipped work.
- Parked: the spec's open questions (538/7, the epic-538 spec reconciliation; 538/11, one issue for N4 and N5). The owner did not add them to the breakdown.
