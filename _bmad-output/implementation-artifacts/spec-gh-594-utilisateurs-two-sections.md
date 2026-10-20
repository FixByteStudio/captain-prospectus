---
title: 'Utilisateurs screen in two sections (GH #594, story 2.6)'
type: 'feature'
created: '2026-10-20'
status: 'done'
baseline_commit: '07c18b2cdd37f306c0034baf5e904d72e36d26f1'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
context:
  - '{project-root}/docs/adr/0037-admins-leave-the-field-side.md'
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Agents screen at `/admin/users` lists admins and agents in one table with a Rôle column. Since roles are fixed at creation (ADR-0037, #593), the screen should be called Utilisateurs and should show the role as structure, not as an editable-looking attribute (R8).

**Approach:** Build the screen to match the approved mockup, `_bmad-output/implementation-artifacts/mockup-utilisateurs-screen.png` (approved by the owner on 2026-10-20). The screen becomes « Utilisateurs » with the lede « Qui peut se connecter, et sur quels appareils. ». Active users go in two sections, Administrateurs and then Agents. Each section has a heading with its count and its own `Surface`, and neither has a Rôle column. Désactivés stays one shared list that keeps its role. Ajouter un utilisateur puts « Rôle » first, with a description saying the role is fixed.

## Boundaries & Constraints

**Always:** The French copy lives in `src/client/copy/admin.ts` and `copy/shared.ts`. Use vendored shadcn elements only. The form stays react-hook-form + shadcn `form`, with the same `z.pick` resolver. Rows, device lines, the row menu, the dialogs and the 768px list/table switch behave as they do today. `docs/design.md` and `docs/glossary.md` must match what ships.

**Never:**
- No API, schema or worker change.
- Do not change the row menu's items, including « Nouvelle phrase de passe » (epic 3 owns those).
- Do not rename the `agents/` folder, `AgentsScreen`, or the `copy.agents` key. That is the refactor sweep's job (story 7).
- No dark-only styling.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Two sections | active admins and agents | heading « Administrateurs » with count, its table; then « Agents » with count, its table; no « Rôle » header or role text in active rows | — |
| No active agent | only admins active | Agents section heading with 0 and the line « Aucun agent actif. Ajoutez-en un avec « Ajouter un utilisateur ». » | — |
| Désactivés | deactivated users of both roles | one collapsible list under both sections, Rôle column kept (table) / role in meta (list) | — |
| Phone <768px | any | same sections stacked; active rows' meta line has no « · Agent/Admin » | — |
| Add dialog | open | fields in order Rôle, Adresse e-mail, Nom; Rôle has the description; options « Agent » (default), « Administrateur » | existing messages unchanged |
| Last admin | one active admin | its « Désactiver » still disabled with the reason | — |

</frozen-after-approval>

## Code Map

- `src/client/copy/admin.ts:25-49` -- `agents.title` → « Utilisateurs », `subtitle` → « Qui peut se connecter, et sur quels appareils. ». Add `sections: { admins: "Administrateurs", agents: "Agents" }`, `noAgents`, and `addDialog.roleHint` « Le rôle est fixé à la création : pour en changer, il faudra un autre compte. ». `roles.admin` → « Administrateur ». Its other user, the Désactivés role, follows the same glossary word.
- `src/client/copy/shared.ts:35` -- `nav.agents` → « Utilisateurs ». The sidebar and the breadcrumb read it through `nav.ts:49`.
- `src/client/admin/agents/AgentsScreen.tsx:107-155` -- split `active` by role into two blocks. Each block is a heading (`h3`, `text-heading`, with the count in `text-muted-foreground tnum`) and then a `Surface` with `Rows`. The Agents block shows `noAgents` in muted text instead of the `Surface` when it is empty. Désactivés is unchanged except that it passes `showRole`.
- `src/client/admin/agents/UsersTable.tsx` -- add a `showRole?: boolean` prop. Without it, there is no Rôle head or cell, and the device row's `colSpan` follows the column count. Keep the column widths aligned across both tables.
- `src/client/admin/agents/UsersList.tsx:47` -- render the `· role` meta only when `showRole`.
- `src/client/admin/agents/AddUserDialog.tsx:109-134` -- move the role `FormField` first and add a shadcn `FormDescription` with `roleHint`.
- `src/client/admin/agents/AgentsScreen.test.tsx` -- add tests:
  - two sections, and their order;
  - no « Rôle » column header in the active tables;
  - the counts;
  - the no-agent line;
  - Désactivés keeps the role;
  - the dialog's field order and hint.

  Adjust any existing assertion that relied on the Rôle column or on « Admin ».
- `src/client/admin/AdminApp.test.tsx:153-156` -- test title wording only (it already uses `copy.agents.title`).
- `docs/design.md:240,1293-1403` -- the section becomes `### Utilisateurs`. Rewrite the ASCII sketch, the header, the add dialog, the rows and the Désactivés bullets to match the mockup. Line 240's Pilotage list reads Utilisateurs.
- `docs/glossary.md:14,62` -- the Admin term's French becomes « Administrateur », the approved mockup's word (the last-admin message already says « administrateur »). The Users screen row reads « Utilisateurs ». The design.md bullet that names "Admin" as the glossary's word follows.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/copy/admin.ts`, `src/client/copy/shared.ts` -- new and renamed strings.
- [ ] `src/client/admin/agents/UsersTable.tsx`, `UsersList.tsx` -- `showRole` prop.
- [ ] `src/client/admin/agents/AgentsScreen.tsx` -- two sections, empty-agents line, Désactivés with `showRole`.
- [ ] `src/client/admin/agents/AddUserDialog.tsx` -- role first, with its description.
- [ ] `src/client/admin/agents/AgentsScreen.test.tsx`, `src/client/admin/AdminApp.test.tsx` -- pin the matrix.
- [ ] `docs/design.md`, `docs/glossary.md` -- match what ships.

**Acceptance Criteria:**
- Given admins and agents, when `/admin/users` renders at ≥768px and <768px, then two headed sections appear, Administrateurs before Agents, and no role toggle or Rôle column is in them.
- Given the dev server, when `/admin/users` opens, then it matches the approved mockup.
- `pnpm build && pnpm check:precache` passes, and the PR quotes the total against 1,000 KiB.

## Implementation Notes

- Implemented by a sonnet `pwa-engineer` subagent. The no-agent line drops the mockup's outer « » (they were quoting marks around the sentence in the mockup's notes).
- Orchestrator renamed the `design.md › Agents` comment anchors to `› Utilisateurs` (the heading moved).
- Dev server `/admin/users` checked at 1280px and 375px against the mockup: `verify-utilisateurs-desktop.png`, `verify-utilisateurs-phone.png`.
- Review lenses ran on sonnet at the owner's instruction, not at the session's model. Duplication-map skipped (not a refactor sweep).
- Not renamed (story 7, refactor sweep): `agents/` folder, `AgentsScreen`, `copy.agents`, `copy.nav.agents`; worker comments saying "Agents page" (`src/worker/device-label.ts:2`, `src/worker/auth.test.ts:349,489`).

## Spec Change Log

## Review Triage Log

Pass 1 — high 0 / medium 0 / low 6 / false 6 / maybe-false 0.

| Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|
| verification-gap | Mobile test never checks which section a user lands in | low | patch: section-scoped assertions and the mobile no-agent line |
| verification-gap, intent | Sidebar label rename untested | low | patch: AdminApp test asserts the /admin/users link reads « Utilisateurs » |
| blind | Other docs still call it "the Agents page" | low | patch: identity-access.md, api.md, data-model.md, deployment.md |
| blind, edge | Administrateurs section has no empty guard | false | the reader is an active admin (`requireAdmin`), and the last-admin guard refuses deactivating the only one |
| edge | A role neither admin nor agent drops out | false | `roleSchema` is the `admin`/`agent` enum |
| blind, edge | Fixed `w-44`/`w-28` widths wrap the badge or role | false | `TableCell`/`TableHead` and `Badge` are `whitespace-nowrap` |
| edge | `/ · Agent$/` misses a regression | false | `getByText` matches the `<p>`'s full text; the Désactivés assertion in the same test proves it matches |
| edge | colSpan 5/4 hard-coded | low | rejected: cosmetic, one site, tested indirectly by the open-devices tests |
| blind | Tables have no aria-labelledby to their heading | low | rejected: each table follows its own h3; adding ids is extra surface for a negligible gain |
| blind | Internal names still say agents | false | the spec defers the renames to story 7 (refactor sweep) |
| blind | Role hint vague / no confirmation for admin | false | copy approved in the mockup; the server needs no confirm |
| blind | Row-index assertions are brittle | low | rejected: existing pattern in this file |

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: pass
- `pnpm build && pnpm check:precache` -- expected: pass; quote the total

**Manual checks:**
- Dev server `/admin/users` at desktop and 375px width, screenshot compared with the mockup.
