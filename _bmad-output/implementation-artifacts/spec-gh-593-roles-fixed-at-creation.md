---
title: 'Roles are fixed at creation (GH #593, story 2.5)'
type: 'feature'
created: '2026-10-20'
status: 'done'
baseline_commit: '5c68aae947056ca97f32299f716e78cf32e497b2'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment, security-reviewer]
review_loop_iteration: 0
context:
  - '{project-root}/docs/adr/0037-admins-leave-the-field-side.md'
  - '{project-root}/docs/domains/identity-access.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An admin can switch a user between admin and agent from the Agents screen (« Passer admin » / « Passer agent »), and a self-demotion jumps to the field. ADR-0037 fixes roles at creation: a role change becomes a new account plus deactivating the old one, which can strand visits in the old account's outbox.

**Approach:** `PATCH /api/admin/users/:email` takes only `active`; a body carrying `role` is a 400 and the last-admin guard protects only against deactivation. The row menu loses the role toggle and the self-demotion jump, and the deactivation confirmation tells the admin to have the user sync first (R7).

## Boundaries & Constraints

**Always:** zod/mini, refusal by the schema (strict object), not by a hand check. The guard stays inside the single UPDATE (no read-then-write). Deactivating still clears the passphrase, sessions and unused codes in the same batch. French copy lives in `src/client/copy/admin.ts`. Docs (`docs/api.md`, `docs/design.md` › Agents, `docs/domains/identity-access.md`) match what ships.

**Never:** No two-section Utilisateurs screen and no role picker changes in Ajouter un utilisateur (story 6). No change to `/api/agent/*`, the roster, or the admin field side (stories 2, 4). No change to break-glass in `routes/auth.ts`. No migration (the `role` column stays).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Deactivate | `{active:false}`, another active admin exists or target is an agent | 204; sessions, unused codes, passphrase gone | — |
| Reactivate | `{active:true}` | 204 | — |
| Role in body | `{role:"admin"}`, `{role:"agent",active:false}` | 400 validation; nothing written | — |
| Empty / unknown key | `{}`, `{foo:1}` | 400 | — |
| Last admin | `{active:false}` on the only active admin | 409 `last_admin`; nothing written, codes and passphrase kept | toast « Il faut au moins un administrateur actif. » |
| Row menu | any row | « Générer un code », own-row « Nouvelle phrase de passe », separator, « Désactiver »; no role item | last admin: « Désactiver » disabled + reason |
| Deactivate dialog | agent row | count sentence, then the sync sentence, then « Ses appareils seront déconnectés… » | — |

## Decisions

- The sync sentence (owner approved the proposal, 2026-10-20): « Demandez-lui d'abord de synchroniser son téléphone : une visite qui n'est pas encore partie ne pourra plus l'être. »
- It shows on agent rows only: after story 2 an admin has no outbox.

</frozen-after-approval>

## Code Map

- `src/shared/schemas.ts:597-604` -- `userUpdateSchema` becomes `z.strictObject({ active: z.boolean() })`; `UserUpdate` type follows.
- `src/worker/routes/identity.ts:1-12` -- header comment mentions demotion; reword.
- `src/worker/routes/identity.ts:134-180` -- PATCH: drop `role` from `set`, `newRole`, and the passphrase rule's `role === "agent"`; guard becomes "not an active admin, OR stays active, OR another active admin exists". Keep the batch for `active:false`.
- `src/worker/routes/identity.ts:221-226` -- `/me/passphrase` comment says "or demoted"; drop it.
- `src/worker/users.test.ts:202-378` -- rewrite role cases: "changes a role" → 400 for any body with `role`, nothing written; last-admin test loops only `{active:false}`; "accepts a change that leaves…" keeps `{active:true}`; drop "demoting an admin keeps their session…" and the demotion half of the passphrase test; "lands two PATCHes" uses two `active` PATCHes or goes; empty-body 400 stays.
- `src/client/admin/agents/RowMenu.tsx` -- remove `onToggleRole` prop and item; doc comment says the last admin cannot be deactivated.
- `src/client/admin/agents/UsersTable.tsx:19,114`, `UsersList.tsx:64` -- drop `onToggleRole` from `UsersActions` and the pass-through.
- `src/client/admin/agents/AgentsScreen.tsx:82-92,138` -- delete `toggleRole` and the `/round` jump.
- `src/client/admin/agents/DeactivateDialog.tsx` -- render `t.syncFirst(name)` between the count sentence and `t.always`, for agent rows only.
- `src/client/copy/admin.ts:45-46,118` -- delete `makeAdmin`, `makeAgent`, `toast.roleChanged`; add `deactivateDialog.syncFirst`.
- `src/client/admin/queries.ts:215` -- comment cites a self-demotion; the reason is now a self-deactivation.
- `src/client/admin/agents/AgentsScreen.test.tsx:460-520,836-844` -- replace the "role change" block with: no role item in the menu (desktop and <768px), last admin's « Désactiver » disabled with the reason; deactivate test asserts the sync sentence for an agent and its absence for an admin.
- `docs/design.md:1336-1346,1369-1378`, `docs/api.md:38`, `docs/domains/identity-access.md:45,65` -- describe fixed roles, the 400, the sync sentence.

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/schemas.ts` -- strict `{active}` schema -- a role in the body is refused by validation (400).
- [ ] `src/worker/routes/identity.ts` -- simplify PATCH set/guard and comments -- only deactivation can break the last-admin rule.
- [ ] `src/worker/users.test.ts` -- update PATCH tests per Code Map -- pins the matrix rows server-side.
- [ ] `src/client/copy/admin.ts`, `RowMenu.tsx`, `UsersTable.tsx`, `UsersList.tsx`, `AgentsScreen.tsx`, `queries.ts` -- remove the toggle, its jump and its copy.
- [ ] `src/client/admin/agents/DeactivateDialog.tsx` + copy -- the sync sentence.
- [ ] `src/client/admin/agents/AgentsScreen.test.tsx` -- screen tests per Code Map.
- [ ] `docs/design.md`, `docs/api.md`, `docs/domains/identity-access.md` -- match what ships.

**Acceptance Criteria:**
- Given an admin session, when PATCH carries `role`, then 400 and the row is unchanged.
- Given one active admin, when PATCH `{active:false}` targets them, then 409 `last_admin` and nothing is written.
- Given the Agents screen, when any row menu opens, then no « Passer admin » / « Passer agent » item exists.
- Given an agent row, when « Désactiver » opens the dialog, then the sync sentence shows.
- `grep -rn "makeAdmin\|makeAgent\|roleChanged\|onToggleRole" src` finds nothing.

## Implementation Notes

- Implemented by a sonnet subagent; `syncFirst` is a plain string (the sentence names no one), not `t.syncFirst(name)`.
- Orchestrator rewrapped two long comment lines and fixed `docs/data-model.md:123` (passphrase "cleared on demotion").
- Review lenses ran on sonnet at the owner's instruction, not at the session's model.

## Spec Change Log

## Review Triage Log

Pass 1 — high 0 / medium 0 / low 3 / false 9 / maybe-false 0.

| Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|
| blind, edge | No test for `{}` body | false | `users.test.ts:356-360` still asserts 400 for `{}` |
| blind, edge | Self-deactivation lost its redirect | false | `DeactivateDialog.tsx:68` still loads `/login` on your own row |
| blind, edge | Sync sentence shows before the count resolves / `false` renders | false | role comes from the cached row and cannot change; React renders nothing for `false`; spacing joins correctly |
| blind, edge | Admin PATCH contract needs CLIENT_VERSION | false | CLIENT_VERSION gates the field sync contract; the admin chunk ships with the same build (ADR-0019) |
| blind | Reactivated former admin has no passphrase | false | unchanged behaviour: deactivation always cleared it |
| blind | `lands two PATCHes` weakened | false | only one field remains; the test still proves two sequential PATCHes land |
| blind | `adminKeys.agents()` invalidation untested | false | still exercised by the deactivate/reactivate paths through `useInvalidateUsers`; not changed here |
| edge | Guard relies on schema having one field | false | intended: the schema is strict and is the only input to `set` |
| blind | Sync sentence unverified against invariant 5 | false | ADR-0037 §Consequences: a deactivated user's outbox cannot sync until reactivated, which the sentence states |
| blind, security | `${body.active ? 1 : 0} = 1` bound constant is less readable | low | rejected: cosmetic, tested, not injectable |
| edge | `queries.ts:215` comment sits on `useCreateUser` | low | rejected: placement pre-dates this change; wording only |
| blind, intent | Domain doc does not own the "fixed at creation" rule | low | patch: `docs/domains/identity-access.md:65` now says so, linking ADR-0037 |

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: pass
- `pnpm build && pnpm check:precache` -- expected: pass; quote the precache total vs 1,000 KiB in the PR
