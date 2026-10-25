---
tracker_id: "632"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/632"
type: epic
title: "The October 2026 retro actions are done, pinned and written down"
parent: initiative-retro-follow-ups-2026-10
covers: [CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-6, CAP-7, CAP-8, CAP-9, CAP-10, CAP-11, CAP-12, CAP-13, CAP-14, CAP-15, CAP-16, CAP-17, CAP-18, CAP-19, CAP-20]
after: []
assignee: ""
risk: medium
---

# The October 2026 retro actions are done, pinned and written down

## Description

The actions of the #538, #579 and #580 retros, one story per slice of the spec's `slices.md` (S1–S11 are entries 1–11). Break-glass stops promoting an agent. Tests and a lint check pin what the admin-field split and the code login loosened, and the prospect outbox drain. The two twice-deferred enablers land: the Visites feed cursor in stamp order and one precache figure. The R15 query-plan work and the day-boundary test residue are finished. #562 grows into the whole admin offline polish. The code dialog shows a day and the login forms read a 400 as a refusal. One docs pass reconciles docs, ADRs, glossary, comments and planning files with what shipped, and closes #619 and #621. The process lines go into `CLAUDE.md` and the skills. The architect settles which clock decides "today".

## Outcome

The owner, reviewing the next retro of this lineage, finds none of CAP-1 to CAP-19 open and the day-rule decision recorded (the spec's success signal).

## Requirements

Source: `_bmad-output/specs/spec-retro-follow-ups-2026-10/SPEC.md`, section Capabilities (CAP-1 to CAP-20), with the CAP-9 and CAP-18 lists in `slices.md`. Each story cites its CAP ids and its retro sources in `538/5` notation.

The breakdown is in `tickets.toml` beside this file.

## Done when

1. Each of these mutations fails a test or lint: delete every sent prospect in `src/client/field/sync.ts`; delete an admin outbox row on a 403; add `role !== "admin"` to `agent.ts` or a client field file; add the word `passphrase` to `src`; swap the TTL `CASE` branches in `src/worker/routes/identity.ts`.
2. A Worker test sends an admin session cookie with `DEV_USER_EMAIL` unset and gets 403 on `/api/agent/sync` and the visits route. Break-glass on an agent row answers the same 401 as other refusals and writes nothing.
3. A feed test with S1 stamped 1000 / committed 1800 and S2 stamped 1200 / committed 1300 lists both syncs' visits, and a truncated `reason=` poll advances `nextSince`. A clean `pnpm build` or the CI job summary ends with the `check:precache` line, and the PR template asks for it.
4. #562, #619 and #621 are closed; every line of the CAP-9 list is changed or struck; the docs state that an admin can mint a code for any active user and that nothing records it.
5. `CLAUDE.md` or the build skill carries the `Refs #n` and `git push -u origin HEAD` lines, and an ADR or a recorded "no ADR" note answers N1.
6. Every code story is on production through CI; `pnpm lint`, `typecheck`, `test`, `build` and `check:precache` are green.

## Boundaries

The Worker auth and field routes and their tests, `eslint.config.js`, the client field outbox and admin shell, the Visites feed cursor, the build and CI precache output, the code dialog and login forms, the docs, ADRs, glossary and planning files the CAP-9 and CAP-12 lists name, and `CLAUDE.md` and the skills CAP-19 names. Not the spec's non-goals, and not a day-rule code change before entry 11's decision.

## References

- parent — _bmad-output/initiative-retro-follow-ups-2026-10/initiative-retro-follow-ups-2026-10.md
- spec — _bmad-output/specs/spec-retro-follow-ups-2026-10/SPEC.md, sections Capabilities, Constraints, Non-goals
- spec — _bmad-output/specs/spec-retro-follow-ups-2026-10/slices.md, sections Slices, CAP-9 list, CAP-18 list
- retro — _bmad-output/implementation-artifacts/epic-538-retro-2026-10-24.md, section Action items
- retro — _bmad-output/implementation-artifacts/epic-579-retro-2026-10-24.md, section Action items
- retro — _bmad-output/implementation-artifacts/epic-580-retro-2026-10-24.md, section Action items
- adr — docs/adr/0037-admins-leave-the-field-side.md
- adr — docs/adr/0038-admins-sign-in-with-an-email-and-a-code.md
- constraint — docs/adr/0007-offline-first-insert-only-sync.md
- constraint — docs/adr/0031-the-precache-ceiling-counts-every-precached-entry.md
- constraint — docs/adr/0033-rollout-rules-wait-for-protected-data.md
- domain — docs/domains/identity-access.md
- domain — docs/domains/field-operations.md, section Rules

## Notes

- Decision (2026-10-25): one story per slice S1–S11, in `slices.md`'s order (decisions and enablers first, pins next, docs last). Entry ids equal slice numbers.
- Decision (2026-10-25): no closing refactor sweep. The owner fixed the set at S1–S11, and the docs pass (entry 9) already closes the epic.
- Decision (2026-10-25): entry 7 is #562, reused and widened to CAP-13; no second issue. Entry 9 closes #619 and #621 rather than duplicating them.
- Decision (2026-10-25): `hitl` on entries 7, 8 and 9 (entry 9 for its CAP-8 line). Their PRs say `Refs #n` and the owner closes the issue; entry 9's PR still says `Closes #619` and `Closes #621`.
- Decision (2026-10-25): entries 4 and 5 are the two-deferral enablers (CLAUDE.md, retro epic #59), labelled `enabler`.
- Decision (2026-10-25): entry 11 is architect-only. No implementation story on the day rule is cut until its ADR, or its "no ADR" note, lands.
- Decision (2026-10-25): no tracer bullet. The epic is fixes, pins and docs on shipped work, with no new path through the layers.
- Decision (2026-10-25): lanes. Entries 1 → 2 share the break-glass code and `src/worker/auth.test.ts`. Entries 3 and 4 → 6 share the client sync tests and the feed query. Entries 2 and 5 → 7 and 8 share `App` and login-form tests, and 7 and 8 quote the `check:precache` line entry 5 makes. Entries 1, 2, 4, 7 and 8 → 9, whose comments and docs describe their final code. Entry 9 → 10 share `docs/deployment.md` when entry 9 takes the optional `deployment.md:94` line, and entry 10 edits `CLAUDE.md` after entry 5's precache line.
- Assumption: entry 11 runs beside anything. Its only shared file is the ADR index, `docs/adr/README.md`, which entry 9 also edits; a one-row overlap is settled at rebase.
- Assumption: entry 1 changes code and tests only; the docs line that break-glass refuses an agent row goes into entry 9 (`slices.md`, S1).
- Assumption: entries 7 and 8 run side by side. Both touch `_bmad-output/implementation-artifacts/deferred-work.md` (`:376` and `:333-336`) and may add keys to the same `copy/` module; the regions differ, so the overlap is settled at rebase.
- Decision (2026-10-25): new tests have named homes so parallel entries do not collide: entry 2's CAP-2 test in `src/worker/auth.test.ts` and its CAP-4 test in the App tests, away from the sync test files entries 3, 4 and 6 edit.
- Source conflict: CAP-12 — the spec lists `initiative-admin-field-separated.md:47` with the dropped dialog line, but that line carries no dialog line; the #580 retro (R-4) says it is wrong because it claims no passphrase exists in the docs while ADR-0029 and ADR-0038 keep the word as history. Entry 9 rewords line 47 for that reason.
- Assumption: CAP-6's rejected `passphrase` kind test and CAP-3's ban on the word in `src` meet through one named allowlist entry for that test (entry 2's `unknown`).
