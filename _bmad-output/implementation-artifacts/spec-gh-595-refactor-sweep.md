---
title: 'Refactor sweep (#595, story 2.7)'
type: 'refactor'
created: '2026-10-20'
status: 'done'
baseline_commit: 'a842b26748cedd2922b447270286d4e3dbb41925'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: [quick, duplication-map]
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic #579 (admins leave the field side) left cleanup its build records and review triage named but deferred: the Utilisateurs screen still lives in `admin/agents/` as `AgentsScreen` reading `copy.agents` (#594 left the rename to this story); the field `AccountMenu` still takes a `role` prop and carries `accountCard.role.admin`, though only an agent mounts the field frame since #592 (review finding 8); a « not awaited, self-deactivation » comment sits on `useCreateUser` instead of `useUpdateUser` (#593 triage); comments still say "the Agents page"; and #590's deferred agent→admin role-PATCH entry in `deferred-work.md` is closed by #593 but not marked so.

**Approach:** Cleanup only, no behaviour change. Rename `src/client/admin/agents/` → `src/client/admin/users/`, `AgentsScreen` → `UsersScreen` (file, test, describe), and `copy.agents` → `copy.users`. Drop the `role` prop from `FieldFrame` and `AccountMenu`; `accountCard.role` becomes the one string « Agent ». Move the misplaced comment. Rename "Agents page" comments to "Utilisateurs page". Mark the #590 deferral closed by #593.

Kept out: `useAgents`, `adminKeys.agents()` and `/api/admin/agents/*` stay — they really are the agent roster. #597 (seed onto the dev admin) is a behaviour fix with its own issue, not cleanup. #592 finding 1 (an error boundary for a failed admin chunk) is new behaviour; it was rejected, not deferred.

</frozen-after-approval>

## Implementation Notes

Oneshot: the change is a mechanical rename (git mv + imports + one copy key) plus three small edits, about 60 changed lines.

- Files: `src/client/admin/agents/` → `users/` (13 files, `AgentsScreen` → `UsersScreen`), `copy/admin.ts` (`agents` → `users`), `App.tsx`, `field/AccountMenu.tsx` and its test (no `role` prop; the admin-role test goes), `copy/field.ts` (`accountCard.role` is « Agent »), `admin/queries.ts` (comment moved), `worker/device-label.ts` and `worker/auth.test.ts` (comments), `deferred-work.md` (#590 entry `closed_by` #593).
- `docs/design.md` › Account card already sketches the role line as « Agent » only, so no doc change.
- Verification: typecheck, lint, 117 files / 3,074 tests pass; `pnpm build` precache 25 entries, 943.33 KiB of 1,000 KiB; the done-grep prints nothing.

## Spec Change Log

## Review Triage Log

Pass 1 (quick, duplication-map; sonnet per the owner): high 0 · medium 0 · low 1 deferred · false 1 · low rejected 3.

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| quick: no unmet criterion, rule or bug | — | — | Reviewer re-ran the done-grep and checked the copy key, imports and the `closed_by` sha |
| Users list re-inlines `UserCell`, Réactiver and `RowMenu` from the table (duplication-map) | low | defer | Pre-existing since #594; the list puts `EnrolmentBadge` inside the name row, so sharing needs a slot, not a rename. Filed as found-in-passing #605 |
| Bare `toast.error(copy.users.toast.failed)` bypasses `failureToast` (duplication-map) | false | reject | Those calls (revoke, generate code, passphrase, re-check) can never get `last_admin`, the only case `failureToast` adds |
| Revealed-secret display repeated in `CodeDialog` / `PassphraseDialog` (duplication-map) | low | reject | Two sites with different copy objects; the logic is already in `copy-to-clipboard.ts` |
| « Radix would close at once » AlertDialog guard repeated (duplication-map) | low | reject | Two sites with different pending flags; a helper adds more than it removes |
| Field `accountCard.role` « Agent » duplicates the admin section label (duplication-map) | low | reject | Forced: field-reachable copy lives in `copy/field` (invariant 15) |

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: all pass.
- `pnpm build` -- expected: success; quote the precache total against 1,000 KiB (the field `AccountMenu` changes).
- `grep -rn "AgentsScreen\|copy\.agents\|admin/agents/\|Agents page" src docs --include=*.ts --include=*.tsx --include=*.md | grep -v "docs/adr/\|docs/backlog/\|api/admin/agents"` -- expected: no output.
