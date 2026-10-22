---
title: 'Refactor sweep (3.4, #612)'
type: 'chore'
created: '2026-10-22'
status: 'done'
baseline_commit: 'd65e0350222df690bf02bdf474cd150db6c76521'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: [quick, duplication-map]
review_loop_iteration: 0
context:
  - '{project-root}/docs/adr/0038-admins-sign-in-with-an-email-and-a-code.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-580-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic #580 (admins sign in with an email and a code) closes with a sweep. The build records of 3.2 (#610) and 3.3 (#611) deferred only one finding: #615, where `.claude/agents/security-reviewer.md:14-15` still lists passphrases. A doc audit found two lines in the epic's six docs that do not match what shipped. `docs/domains/identity-access.md:24` puts « Générer un code » on "the Agents page", but it sits on every active row of the Utilisateurs page, on both tabs. `docs/data-model.md:183` leaves the role and email check out of the spend `UPDATE`. One entry from #306 in `deferred-work.md` still names the passphrase login, which no longer exists.

**Approach:** Cleanup only. Drop the passphrase words from the security-reviewer checklist (closes #615). Correct the two doc lines. Mark the two deferred-work entries as closed or narrowed. Check the epic's four Done-when items and record the result. Anything bigger becomes a found-in-passing issue.

</frozen-after-approval>

## Implementation Notes

Oneshot: three one-line text fixes plus bookkeeping, well under 100 lines, no code.

- Scope came from the 3.2 and 3.3 triage logs, which deferred one finding (#615), and from a sonnet audit of the six docs, which found two drifted lines. Nothing bigger turned up.
- `.claude/agents/security-reviewer.md` also points at ADR-0038 next to ADR-0029, because ADR-0038 amends the login decisions.
- In `deferred-work.md`, the #611 entry is `closed_by` this story, and the #306 entry is `narrowed_by` it. The code-generate half of #306 is still open.
- Found in passing: #617. `StartScreen.test.tsx:228` asserts the path before the swipe's `navigate` renders. It failed CI on main for #616 (run 39769375245), so Deploy was skipped.

### Epic #580 Done-when (checked 2026-10-22)

1. Admin email + code on the admin form lands on `/admin`, and the same code on the agent form gets 401. Holds in `auth.test.ts` and `LoginScreen.test.tsx` (3.2), and 3.2 checked it with curl on `pnpm dev`. **Not checked on production**: that needs a fresh admin code there, so the owner does it.
2. An agent's code on the admin form gets 401, and break-glass still opens `OWNER_EMAIL`. Holds in `auth.test.ts`. **Not checked on production** (owner).
3. `grep -ri passphrase src` finds nothing, and one migration (`drizzle/0020_workable_human_fly.sql`) drops `passphrase_hash`. **Holds.**
4. ADR-0038 is accepted, and ADR-0029's status names it. The six docs match once this change lands. **Not yet on production**: main's CI for #616 failed on the flaky test (#617) and Deploy was skipped. Production runs #614 (3.2) without 3.3. This PR's merge runs CI and Deploy, which ships 3.3.

## Review Triage Log

### Pass 1 (2026-10-22): quick and duplication-map (sonnet). low 1 (patched), 1 recorded, false 1, accepted 2

| # | Lens | Finding | Verdict | Evidence / action |
|---|---|---|---|---|
| 1 | duplication-map | data-model.md restated the spend conditions that api.md › Sign-in owns | low | patch: data-model now links to api.md for the role and email ("a rule has one home") |
| 2 | quick | Done-when result not recorded | low | recorded above. The diff was taken before finalising |
| 3 | quick | Spec frontmatter `review`/`lenses_ran` disagree with the diff | false | the diff was written before the frontmatter was set |
| 4 | duplication-map | "Générer un code" placement stated in 5 docs | accepted | they now agree (Utilisateurs page). ADR-0029's "Agents page" is history |
| 5 | duplication-map | #615/#306 bookkeeping in the spec and deferred-work | accepted | the deferred-work format requires its own entry |

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all pass.
- `grep -ri passphrase src` -- expected: no output.
- `git grep -l passphrase_hash -- drizzle/*.sql` -- expected: 0009 (adds) and 0020 (drops) only.
- `gh run list --branch main --workflow Deploy` -- expected: a successful Deploy for `d65e035` (#616).
