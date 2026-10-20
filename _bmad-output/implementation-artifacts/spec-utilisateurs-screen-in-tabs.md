---
title: 'Utilisateurs screen in tabs'
type: 'feature'
created: '2026-10-20'
status: 'done'
baseline_commit: '6770fb1e2a62d3879d76cba24f2ad205a7310d7a'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/forge/utilisateurs-screen-rethink/forged-idea.md'
  - '{project-root}/_bmad-output/forge/utilisateurs-screen-rethink/mockup-b-nom.png'
  - '{project-root}/_bmad-output/forge/utilisateurs-screen-rethink/mockup-b-phone.png'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** #594 shipped `/admin/users` as two stacked sections (Agents, then Administrateurs), each with its own heading, table frame, header row and Désactivés toggle. For about five people that is mostly chrome, and the owner is not satisfied with it (forge `utilisateurs-screen-rethink`, 2026-10-20).

**Approach:** Replace the two sections with shadcn `Tabs`: « Agents n » (default) and « Administrateurs n », with one table or list under the selected tab and that tab's own « Désactivés (n) » toggle. Rename the first column header from « Utilisateur » to « Nom ». Matches the owner-approved mockups `mockup-b-nom.png` (desktop) and `mockup-b-phone.png` (phone).

Owner decisions (2026-10-20):
- Tabs, not one table with a role badge.
- The first column is « Nom », not « Nom et e-mail ».
- After adding a user, the screen opens the tab their row lands in.
- On a phone the tabs are full width, two equal halves.
- The selected tab is not put in the URL: Agents opens on every visit, and a reload returns to it.

## Boundaries & Constraints

**Always:**
- French strings live in `src/client/copy/admin.ts` (`copy.users`).
- Tabs is vendored shadcn over the `radix-ui` umbrella package, which is already a dependency.
- The `useIsMobile()` table/list split stays as it is today.
- `lastAdmin` still counts active admins across both roles.
- An empty Agents tab keeps the `noAgent` line in its Surface.
- `docs/design.md › Utilisateurs` and its sketch describe the shipped screen in the same change.

**Never:**
- No change to the add dialog's fields, the row menu, device lines, the deactivate, code or passphrase dialogs, the API, schemas or server.
- No role badge, no Rôle column.
- No new npm dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default | 3 active agents, 2 active admins | Tabs « Agents 3 » (selected) and « Administrateurs 2 »; only agent rows are shown; header « Nom » | — |
| Switch | click « Administrateurs » | only admin rows are shown, « Vous » on your own row | — |
| No agent | only the signed-in admin | Agents tab « 0 » shows the noAgent line; Administrateurs « 1 » | — |
| Deactivated | 1 inactive agent, 0 inactive admins | « Désactivés (1) » under the Agents tab only | — |
| Add an admin from Agents | submit role Admin | toast as today, and the Administrateurs tab becomes selected | failed add: tab unchanged |
| Add an agent from Administrateurs | submit role Agent | the Agents tab becomes selected | — |
| Load/fail | pending / 500 | unchanged ScreenState skeleton / retry | unchanged |

</frozen-after-approval>

## Code Map

- `src/client/ui/tabs.tsx` -- new. Vendor shadcn `tabs` (Tabs, TabsList, TabsTrigger, TabsContent) and import `radix-ui/tabs` the way `ui/toggle-group.tsx` imports `radix-ui/toggle-group`. Style the list as in the mockup: a `secondary` track, with the active trigger on `card` with a shadow, like `PeriodToggle`.
- `src/client/admin/users/UsersScreen.tsx` -- today it has `SECTION_ORDER` and `UsersSection`, a heading, a Surface and a toggle per role. Turn it into a tab panel per role. Selected-tab state lives in `UsersScreen` and starts at `"agent"`. `SECTION_ORDER`, `lastAdmin` and the actions object are kept.
- `src/client/admin/users/AddUserDialog.tsx:50-60` -- after `mutateAsync` succeeds, call a new optional prop `onAdded(role)` before the success toast. `UsersScreen` passes a callback that selects that role's tab.
- `src/client/copy/admin.ts` `users.columns.user` -- "Utilisateur" → "Nom". `sections` labels the tabs. Add `tabsLabel: "Rôle"` only if the tab list needs an accessible name; radix gives it role tablist.
- `src/client/admin/users/UsersTable.tsx` -- reads `columns.user` (the header text changes through copy alone). Nothing else changes.
- `src/client/admin/users/UsersScreen.test.tsx:134-181` -- the section, count, empty and Désactivés tests use `within(section)` by heading. Rewrite them to work with tabs.
- `docs/design.md:1293-~1402` `### Utilisateurs` -- rewrite the intro, the sketch, and the section and Désactivés bullets for tabs. Point to the forge mockups.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/ui/tabs.tsx` -- vendor shadcn tabs over `radix-ui/tabs` -- ADR-0014: shadcn provides it.
- [ ] `src/client/copy/admin.ts` -- `columns.user` → "Nom".
- [ ] `src/client/admin/users/AddUserDialog.tsx` -- optional `onAdded(role)` called on success.
- [ ] `src/client/admin/users/UsersScreen.tsx` -- controlled `Tabs`, one `TabsContent` per role in `SECTION_ORDER`. Each trigger reads `sections[role]` plus a `tnum` muted count of that role's active users. Each panel holds its Surface (rows or noAgent) and its own Désactivés toggle and Surface. The list is `w-full` with two equal triggers below 768px and auto width from 768px. `onAdded` selects the role's tab.
- [ ] `src/client/admin/users/UsersScreen.test.tsx` -- cover:
  - tabs in order with counts, Agents selected
  - only that role's rows in the panel, and « Nom » as the header
  - switching tabs
  - the noAgent line
  - Désactivés only in its own tab
  - adding an admin from Agents selects Administrateurs
  - adding an agent from Administrateurs selects Agents
  - a failed add leaves the tab unchanged
  - fix the existing tests that relied on the sections
- [ ] `docs/design.md` -- describe the shipped screen and redraw the sketch.

**Acceptance Criteria:**
- Given the dev server at 1280 and 375 in light and dark, when `/admin/users` is compared to `mockup-b-nom.png` and `mockup-b-phone.png`, then the layout matches.
- Given the tabs, when they are used from the keyboard, then arrow keys move between tabs and the panel is labelled by its tab (radix defaults kept).
- Given the PR, then it quotes the precache total against the 1,000 KiB ceiling.

## Implementation Notes

- Implemented by a sonnet pwa-engineer. The trigger text in tabs.tsx moved from `text-body` to `text-label` (weight 500, as the mockup's tab labels), and a duplicated `showAdmins()` call was removed from one test.
- Review patch: design.md said leaving a tab closes its Désactivés list. It does not, because the state lives in the mounted `UsersPanel`. The doc now says each tab remembers it, and a round-trip test pins that.
- Dev server check (CDP screenshots at 1280 and 375, light and dark, Désactivés open, both tabs): matches both mockups. The phone tabs are 170/170 px, and no table overflows. In dark mode the selected tab (`card`) is slightly darker than the `secondary` track, the same pairing PeriodToggle uses.
- Precache: 25 entries, 943.89 KiB of 1,000 KiB.

## Spec Change Log

## Review Triage Log

Pass 1 — high 0 · medium 0 · low 1 · false 9 · rejected-low 4. Lenses ran on sonnet (owner rule: no opus subagents), not the session's model.

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| Désactivés open state survives a tab switch, contradicting design.md (edge, verification-gap) | low | patch | `useState` sits in `UsersPanel`, which renders `TabsContent` and stays mounted; doc sentence corrected, round-trip test added |
| Failed-add test passes even if `onAdded` fired (blind, verification-gap) | false | reject | it adds an *admin* from Agents; a wrong call would select Administrateurs and fail the assertion |
| `onAdded` fires before the list refetches (blind, intent) | false | reject | `useCreateUser` invalidates the users query on success; the row arrives on refetch as before, the tab is already right |
| `SECTION_ORDER.find` narrowing is awkward (blind) | low | reject | cosmetic; avoids an `as` cast |
| Keyboard / panel labelling untested (blind) | low | reject | radix defaults, unchanged; not this screen's logic |
| Phone tab width untested (blind, intent) | false | reject | a CSS breakpoint, which jsdom cannot see; checked on the dev server at 375 |
| `tabs.tsx` import style / new dependency (blind) | false | reject | same as `ui/toggle-group.tsx`; `radix-ui` is already in `package.json` |
| `min-h-9`, `p-0.5`, `shadow-sm` are hardcoded (blind) | false | reject | Tailwind scale utilities, as `PeriodToggle` uses; colours are tokens |
| Two copies of the segmented-control style (blind) | low | reject | different primitives (tabs vs toggle-group); sharing a class string adds coupling for two sites |
| Other docs still say « Utilisateur » (blind) | false | reject | grep of docs and src finds none |
| `columns.user` key no longer matches « Nom » (blind) | low | reject | the key names the column's subject, not its label |
| Tab not in the URL is a UX cost (blind) | false | reject | owner decision in the frozen intent |
| Mockups untracked, so design.md link dangles (blind, intent) | false | reject | the forge folder is committed with this change |
| Selected tab can show an empty non-agent panel (edge) | false | reject | the viewer is an active admin, so Administrateurs always has a row |
| Mockup match not tested (intent) | false | reject | acceptance is a dev-server check at 1280 and 375, done before the PR |

## Design Notes

Radix unmounts an inactive `TabsContent`, so a tab's Désactivés open state resets when you leave the tab. This is accepted: it's what the toggle did before #594 whenever the list re-rendered, and nothing is lost. The count on a tab is that role's *active* users, the same number the #594 heading showed.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: all pass.
- `pnpm build` -- expected: success; read the precache total from the PWA plugin output.

**Manual checks:**
- `pnpm dev`, sign in with a seeded admin, open `/admin/users` at 1280 and 375 in light and dark, and compare to the two mockups; add an admin from the Agents tab.

