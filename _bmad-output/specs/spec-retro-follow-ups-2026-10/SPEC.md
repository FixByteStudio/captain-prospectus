---
id: SPEC-retro-follow-ups-2026-10
companions:
  - slices.md
sources:
  - ../../implementation-artifacts/epic-538-retro-2026-10-24.md
  - ../../implementation-artifacts/epic-579-retro-2026-10-24.md
  - ../../implementation-artifacts/epic-580-retro-2026-10-24.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Retro follow-ups, October 2026 (`retro-follow-ups-2026-10`)

Source notation: `538/5` is action 5 of the epic #538 retro; finding ids (N9, F-A, S-7…) are the retro's own.

## Why

Three retros closed on 2026-10-24 (#538 tournée, #579 admins leave the field side, #580 admin code login), all *accepted with open items*. Their actions overlap: five items appear in two or three retros, and two (the Visites feed cursor, the precache figure) have now been deferred twice, which CLAUDE.md turns into a scheduled enabler. Unless they become one counted list, the next retro finds the same items open. A mandate to meet (the two-deferral rule) plus a pain: invariant 5 and the Done-when greps are guarded by nothing but habit, and three owner decisions block code.

## Capabilities

Grouped into pull requests in `slices.md`.

- **CAP-1** — Prospect outbox drain pinned. *538/1, N9*
  - **intent:** A sent prospect the server did not list stays in the outbox, and a test says so (invariant 5).
  - **success:** The mutation "delete every prospect sent" in `src/client/field/sync.ts` fails a test; it survives today.
- **CAP-2** — Admin 403 on the field API proven with a real session. *579/3, 580/5, F-B*
  - **intent:** An admin D1 session is refused on `/api/agent/sync` and the visits route by a committed test, not through `DEV_USER_EMAIL`.
  - **success:** The Worker test sends an admin session cookie with `DEV_USER_EMAIL` unset and asserts 403 on both routes.
- **CAP-3** — The two Done-when greps kept true by a check. *579/3, 580/5, F-E, V-4*
  - **intent:** Reintroducing an admin branch on the field side, or a `passphrase` path in `src`, fails lint or a test.
  - **success:** Adding `role !== "admin"` to `agent.ts` or a client field file, or the word `passphrase` to `src`, turns CI red; the `"pass" + "phrase"` string in `users.test.ts` is gone.
- **CAP-4** — Admin outbox survives a 403. *579/3, C-4, C-8*
  - **intent:** An admin identity holding outbox rows keeps every row across a 403 and an `App` visit.
  - **success:** A client test fails if any row is deleted; today invariant 5 there rests on the comment at `App.tsx:508`.
- **CAP-5** — Menu and entry assertions that bite. *579/3, C-8*
  - **intent:** The Utilisateurs row menu is asserted as an exact set of items, so a re-added role toggle under any label fails.
  - **success:** The `/Passer (admin|agent)/` assertions are replaced; optionally a `start_url` manifest test and an App-level Hors ligne body assertion exist.
- **CAP-6** — Sign-in test gaps closed. *580/5, V-3, V-5, D-4*
  - **intent:** Tests pin what the code-login stories guard: a rejected `passphrase` kind; an admin code spent just before and at 1 h; two real admins with live codes; a role flip between mint and spend; break-glass on the agent form leaving no `users` or `sessions` row; the admin form's state on swap.
  - **success:** Swapping the TTL `CASE` branches at `identity.ts:190` fails a test.
- **CAP-7** — Break-glass refuses an agent row. *579/2, 580/2, F-A, S-7; owner decision*
  - **intent:** `OWNER_EMAIL` naming an existing agent cannot be promoted by break-glass; "roles are fixed at creation" has no exception.
  - **success:** A test shows break-glass on an agent row answers the same 401 as other refusals, writes nothing, and a deactivated admin owner is still reinstated.
- **CAP-8** — Code minting for any user accepted and written down. *579/2, 580/1, F-G, S-1; owner decision*
  - **intent:** The docs state that an admin can mint a code for any active user, an agent or another admin, sign in as them, and that nothing records it.
  - **success:** One line in ADR-0038 or ADR-0039 and one in `identity-access.md` say so; no code or schema changes.
- **CAP-9** — Docs and comment reconciliation in one pass. *579/4, 580/6, 538/2*
  - **intent:** Docs, ADRs, glossary, comments and names match what shipped, across the three epics.
  - **success:** Every line in the CAP-9 list of `slices.md` is changed or struck, and `pnpm lint` passes.
- **CAP-10** — #619 carries the ADR-0038 lines. *580/6, R-2, R-3*
  - **intent:** ADR-0038 notes the dropped dialog line, points to ADR-0039 where decision 1 calls the lifetime unchanged, and strikes its promise about ADR-0029 decisions 1 and 4.
  - **success:** #619 is closed by the docs pass with those three edits; no second issue exists.
- **CAP-11** — #621 carries the EXPERIENCE.md lines. *579/4*
  - **intent:** EXPERIENCE.md no longer sends an offline admin to the field side at `:72`, `:80`, `:88`, `:123`, `:264` or at the lines #621 already lists (`:23`, `:120`, `:189`).
  - **success:** #621 is closed by the docs pass; a grep of the file for the admin-in-the-field wording finds nothing.
- **CAP-12** — Planning files follow #580. *580/6, R-4*
  - **intent:** The dropped dialog line is out of `tickets.toml` entry 3, `epic-580-context.md:21,32,38` and `initiative-admin-field-separated.md:47`.
  - **success:** None of them lists the line as a requirement.
- **CAP-13** — #562 covers the whole admin offline polish. *579/5, C-2, C-3*
  - **intent:** A failed admin chunk renders `AdminOfflineScreen`; a failed « Réessayer » says the admin is still offline; the `deferred-work.md:376` wording is fixed; a timeout on the gate's `/api/me` is considered.
  - **success:** Tests for the first two; #562 lists all four items; precache total quoted.
- **CAP-14** — The code dialog and login forms say the right thing. *580/3, D-1, D-2*
  - **intent:** A 24-hour code shows its day, not just a time, and a 400 on either login form reads as a refusal rather than « Réessayez dans un instant ».
  - **success:** Dialog tests at +1 h and +24 h per role; a 400 test on both forms; `design.md:1367` updated. Copy in `copy/`.
- **CAP-15** — The #306 half has an owner. *580/7, R-7*
  - **intent:** The code route's guarded-insert remainder of the #306 deferral is tracked or closed.
  - **success:** `deferred-work.md:333-336` names an issue, or is closed with a test.
- **CAP-16** — Enabler: the Visites feed cursor in stamp order. *538/4, N2, N3*
  - **intent:** A sync that stamps `received_at` early and commits late cannot be skipped by the cursor, and a reason-filtered delta poll advances past dropped door-days.
  - **success:** A test with S1 stamped 1000 / committed 1800 and S2 stamped 1200 / committed 1300 lists both syncs' visits; a truncated `reason=` poll advances `nextSince`.
- **CAP-17** — Enabler: one precache figure. *580/8, 579/9, P-3*
  - **intent:** The only precache number a PR author sees is the `check:precache` line against the 1,000 KiB ceiling.
  - **success:** A clean `pnpm build`, or the CI job summary, ends with that line; the PR template tells authors to paste it; a client PR no longer quotes Workbox's lower total.
- **CAP-18** — R15 finished and test residue cleared. *538/6, N8, N11, N12, N13*
  - **intent:** Query-plan tests plan the statements the code runs, and the day-boundary tests use production builders and a fake clock.
  - **success:** The CAP-18 list in `slices.md` is covered; `doorDayCounts` is measured and has a row in `docs/free-tier-budget.md`.
- **CAP-19** — Process written down, once. *579/6, 579/7, 580/9, 580/10, 538/10*
  - **intent:** The lines the retros keep asking for exist where agents read them.
  - **success:** `CLAUDE.md` or the build skill says a `hitl` PR says `Refs #n` unless it is the owner's acceptance, and branches push with `git push -u origin HEAD`; `release-checklist` line 11 can be met; the build skill lists the review bot's actionable comments before "ready to merge"; the `d1-migration` skill covers a unique index on an unconstrained table; a spec that says "whatever the phone's clock" includes a midnight-crossing skew.
- **CAP-20** — Architect settles the day rule. *538/5, N1; owner: architect first*
  - **intent:** One decision says which clock decides "today" when phone and server disagree on the Brussels date, including #496's far-behind-clock case.
  - **success:** An ADR, or a recorded "no ADR" note, answers N1; implementation stories are cut from it afterwards.

## Constraints

- Disposable data stage: a schema change is one migration with no backfill. CAP-7 and CAP-8 need none.
- CAP-7's refusal is indistinguishable from the other login refusals: same 401 body, no `Set-Cookie` (580/S-3 stays true).
- CAP-16 leaves the sync contract unchanged; whether `received_at` is stamped at insert or compared another way is the story's call.
- No code story on the day rule before CAP-20 lands (owner, N1).
- One concern per PR; #627 stays its own fix and found-in-passing stays an issue.
- Client PRs quote the `check:precache` line; field chunks stay free of admin-only modules.
- `hitl` slices (CAP-8, CAP-13, CAP-14 wording) say `Refs #n` and the owner closes.

## Non-goals

- The production sign-in check (580/4); the owner does it.
- #627, the deactivate-dialog loop (579/1, 580 carried); #605 and #597 stay their own issues.
- Tracker hygiene (538/8, 579/8), the pavement test (538/9), replies to the three CodeRabbit comments (538/3): the owner's.
- N4, N5, N6 and N7 of #538 (538/11), and the findings the retros accepted (F-D, F-F, 579 C-4's rationale, 580 S-2, S-3, S-6, S-8, D-3).
- Any code, ADR or issue edit in the PR that adds this spec.

## Success signal

The next retro of this lineage finds none of CAP-1 to CAP-19 open, the day-rule decision exists, and no hand-copied precache number or unguarded Done-when grep is left to catch by review.

## Assumptions

- Beyond the stated rules, CAP-1, CAP-14, CAP-15, CAP-18 and the last three lines of CAP-19 were included because their retros assign them to roles other than the owner.
- 538/7 (spec reconciliation of the epic-538 files) is left out as owner-applied; CAP-12 covers only the #580 files that 580/6 assigns to the docs pass.
- CAP-7 refuses only an existing agent row; a deactivated admin owner is still reinstated.
- CAP-8 covers admin-to-admin minting (same cause, 580/S-1). CAP-7 also closes 580/S-7, so no spend-time lifetime check is added (580 question 5).
- The stories widen #619, #621 and #562; this PR does not edit those issues.

## Open Questions

- 538/7: should the epic-538 spec reconciliation join CAP-9?
- 538/11: open one issue for N4 and N5 so they stop being re-found?
- CAP-17: build ends with `check:precache`, or CI summary plus PR template? The story picks unless the owner prefers one.
