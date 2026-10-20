---
title: 'Utilisateurs screen in two sections (#594, story 2.6)'
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
  - '{project-root}/_bmad-output/implementation-artifacts/epic-579-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/mockup-utilisateurs-screen.png'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Roles are fixed at creation (#593, ADR-0037), yet `/admin/users` is still titled "Agents" and mixes admins and agents in one table with a Rôle column, so the screen reads as if a role were a property you manage per row.

**Approach:** Rename the screen and its nav item to « Utilisateurs » and list users in two sections, Agents first then Administrateurs, each a heading with its count over its own Surface, with no role column; each section keeps its own « Désactivés (n) » toggle. Matches the owner-approved mockup `mockup-utilisateurs-screen.png` (2026-10-20).

Owner decisions (2026-10-20): section order is Agents then Administrateurs; one Désactivés toggle under each section, as drawn; the add dialog's Rôle Select keeps "Agent" / "Admin"; the add dialog stays exactly as it is today (no hint).

## Boundaries & Constraints

**Always:** French strings in `src/client/copy/` modules (`copy.agents`, `copy.nav`); shadcn elements already vendored; `useIsMobile()` table/list split as today; the last-admin rule still counts active admins across the whole list; docs/design.md › Agents and docs/glossary.md updated in the same change.

**Never:** No change to the add dialog, row menu, device lines, deactivate/code/passphrase dialogs, API, schemas or server. No file or folder renames (`agents/`, `AgentsScreen`, `copy.agents` keep their names; the refactor sweep, story 7, may rename). No new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Both roles | 3 active agents, 2 active admins | « Agents 3 » section then « Administrateurs 2 », each its own table/list, no Rôle column, no « · Agent » meta | — |
| No agent | only the signed-in admin | Agents section shows « Aucun agent. Ajoutez-en un pour lancer les tournées. » in its Surface; Administrateurs lists 1 | — |
| Deactivated agent | 1 inactive agent, 0 inactive admins | « Désactivés (1) » under Agents only; none under Administrateurs | — |
| Deactivated in both | 1 inactive of each | one toggle per section, each opening only that section's rows | — |
| Load/fail | pending / 500 | unchanged ScreenState skeleton / retry | unchanged |

</frozen-after-approval>

## Code Map

- `src/client/admin/agents/AgentsScreen.tsx` -- splits `users` into active/deactivated; renders one Surface + one global Désactivés toggle. Becomes two sections. `lastAdmin` computed from all active admins (keep).
- `src/client/admin/agents/UsersTable.tsx` -- desktop table; drop the Rôle `TableHead`/cell, fix `colSpan` (5 → 4). Give columns fixed widths so the two tables line up.
- `src/client/admin/agents/UsersList.tsx` -- phone list; drop `` ` · ${roles[user.role]}` `` from the meta line.
- `src/client/copy/admin.ts` `agents` (line ~26) -- `title` → "Utilisateurs", `subtitle` → "Qui peut se connecter, et sur quels appareils.", remove `columns.role`; add `sections: { agent: "Agents", admin: "Administrateurs" }`, `noAgent`, per-section deactivated labels (e.g. `deactivatedLabel: (role) => …` "Agents désactivés" / "Administrateurs désactivés"). Keep `roles` (AddUserDialog uses it).
- `src/client/copy/shared.ts:35` `nav.agents` -- "Agents" → "Utilisateurs".
- `src/client/admin/agents/AgentsScreen.test.tsx` -- row-order test (line ~120) and Désactivés tests assume one table; update with `within(section)`.
- `src/client/admin/AdminApp.test.tsx:156` -- uses `copy.agents.title`; passes unchanged.
- `docs/design.md:1293-1402` (### Agents) and `:240` (nav group list) -- rewrite for the new screen; `docs/glossary.md:62` `| Users | Agents |` → `Utilisateurs`.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/copy/admin.ts`, `src/client/copy/shared.ts` -- the copy changes above.
- [x] `src/client/admin/agents/AgentsScreen.tsx` -- render a `UsersSection` (local component, same file) per role in order `agent`, `admin`: a `<section aria-labelledby>` with an `h3` (`text-heading`) plus a meta tabular count, the Surface with `Rows`, or the `noAgent` line in a Surface when an agent section has no active rows; then that section's own Désactivés ghost toggle (own open state per role) and deactivated Surface (`aria-label` per role). Header button and dialogs unchanged.
- [x] `src/client/admin/agents/UsersTable.tsx`, `UsersList.tsx` -- remove the role column / meta; fixed column widths on desktop.
- [x] `src/client/admin/agents/AgentsScreen.test.tsx` -- add: two sections in order Agents then Administrateurs with counts; no Rôle column header and no role text on rows (desktop and mobile); empty Agents line; per-section Désactivés toggles. Fix existing tests that relied on the single table.
- [x] `docs/design.md`, `docs/glossary.md` -- describe the shipped screen (title, lede, sections, per-section Désactivés, empty line, phone shape); ASCII sketch redrawn.

**Acceptance Criteria:**
- Given an admin on `/admin/users`, when the page loads, then the heading is « Utilisateurs », the sidebar item reads « Utilisateurs », and no role toggle or Rôle column exists.
- Given the dev server at 1280 and 375, light and dark, when compared to `mockup-utilisateurs-screen.png`, then the layout matches.
- Given the PR, then it quotes the precache total against the 1,000 KiB ceiling.

## Implementation Notes

- Owner approved the mockup on 2026-10-20 with four answers (frozen block); the go-ahead was taken as spec approval.
- Implemented by a sonnet pwa-engineer; then `Role` from `shared/constants` replaced two hand-typed unions.
- Review patches applied directly: `min-w-xl` on the fixed table; menu column `w-16` (a 36px icon button overflowed `w-10`); the Désactivés table swaps Appareils `w-12` / last `w-32` so « Réactiver » fits and Inscription still lines up; design.md heading renamed `### Utilisateurs` with its sketch redrawn and `› Agents` pointers updated; "Agents page" → "Utilisateurs page" in api.md, data-model.md, deployment.md, identity-access.md; AdminApp test asserts the heading and the sidebar link text.
- Dev server check (CDP screenshots, 1280 and 375, light and dark, Désactivés open): matches the mockup, no table overflow.
- Precache: 25 entries, 943.39 KiB of 1,000 KiB.

## Spec Change Log

## Review Triage Log

Pass 1 — high 0 · medium 2 · low 4 · false 6 · rejected-low 6.

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| table-fixed squeezes the user column at narrow widths (edge, blind) | medium | patch | `min-w-xl` added; the table container already scrolls |
| Menu/Réactiver overflow the fixed last column (found at dev-server check) | medium | patch | scrollWidth − clientWidth was 4 px / 28 px; now 0 |
| design.md `### Agents` heading and `› Agents` pointers stale (blind, edge, intent) | low | patch | heading and six comment pointers renamed |
| ASCII sketch borders wrong (blind, edge) | low | patch | sketch redrawn: headings above closed Surfaces, both tables |
| Long unwrapped design.md lines (blind) | low | patch | rewrapped |
| Sidebar label untested (verification-gap, intent) | low | patch | AdminApp test asserts link text and href |
| h3 skips a level (blind) | false | reject | ScreenHeader title is an h2 (AdminApp.test asserts level 2) |
| `/^Agents/` region also matches « Agents désactivés » (blind, edge) | false | reject | Surface is a plain div; aria-label gives it no region role |
| Empty Administrateurs renders a bare header (blind, edge) | false | reject | the viewer is an active admin, so the section always has a row |
| showDeactivated persists after the list empties (edge) | false | reject | same as before the change (state lived in AgentsScreen) |
| Unstaged changes beyond the diff (blind) | false | reject | the diff was rewritten from the working tree after the Role patch |
| "the section says it" misleads (blind) | false | reject | the section heading names the role; reworded anyway |
| SECTION_ORDER not exhaustive over Role (edge) | low | reject | Role has two members; adding a role is a hard-to-reverse change with its own ADR |
| deactivatedLabel not derived from sections (blind) | low | reject | two literal strings in one copy module |
| aria-label per role untested (verification-gap) | low | reject | cosmetic a11y copy; section-scoped tests cover the rows |
| listitem[1] index brittle (blind, edge) | low | reject | consistent with the fixed section order |
| h3 query assumes no other h3 (edge) | low | reject | the screen renders no other h3 |
| No identifier rename (blind, intent) | low | reject | the frozen intent defers renames to story 7 (the refactor sweep) |

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: all pass.
- `pnpm build` -- expected: success; read the precache total from the PWA plugin output.

**Manual checks:**
- `pnpm dev`, sign in with a seeded admin, open `/admin/users` at 1280 and 375 in light and dark; compare to the mockup.
