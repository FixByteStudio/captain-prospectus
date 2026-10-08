---
title: 'The Agents page lists, creates and deactivates users'
type: 'feature'
created: '2026-10-08'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '864e4d6edb093bcd46b48c4e1211c4867065216a'
context:
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/api/admin/users` (GH #302) exists but no screen calls it, so adding, re-roling or deactivating a user still needs a hand-made request (GH #304, CAP-1).

**Approach:** A new `/admin/agents` screen, second in Pilotage (Lucide `Users`), built exactly to design.md § Agents on the users routes: active list, add dialog, role change, deactivation dialog, Désactivés with Réactiver, last-admin guard, mobile list, `ScreenState` gate.

## Boundaries & Constraints

**Always:**
- design.md § Agents is the authority for layout, words and toasts; every French string goes in `src/client/copy/admin.ts`.
- Rows sort as the server sends them (no client re-sort). Badge "Inscrit" when `sessions > 0`, else "Pas encore inscrit". The signed-in admin's row says "Vous" after the email.
- Add dialog: shadcn `form` with `standardSchemaResolver` over `z.pick(userCreateSchema, {email, name, role})`; role `Select` defaults to agent; email trimmed and lowercased before sending. 409 `email_taken` → design.md's sentence, shown in the dialog under the email field (the dialog stays open).
- Last active admin = an active admin row when exactly one active admin row is listed. On it, "Passer agent" and "Désactiver" are disabled with "Il faut au moins un administrateur actif." in meta under them. A 409 `last_admin` toasts that sentence.
- Any other failed action toasts "L'action n'a pas abouti. Réessayez." and leaves the screen as it was.
- Every successful mutation invalidates the users query and `adminKeys.agents()` so the assign menu follows.
- Deactivation `AlertDialog` refetches the users list when it opens and states the count from the refetched row; the destructive button waits for that refetch.
- Demoting yourself, on success, does a full-page load of `/tournee`; deactivating yourself, on success, of `/login` (App's identity must be re-read, so not a router `navigate`).
- Decision (2026-10-08, story): no "Générer un code" or "Nouvelle phrase de passe" item, not even disabled; no device rows, chevron or Révoquer (entry 10); no À traiter row (entry 11).
- Decision (2026-10-08, story): deactivating your own row opens `/login` on success.

**Never:** no worker, schema or migration change; no new dependency; no client re-sort or client-side role/active rule beyond the last-admin disable; no 401 handling (entry 12); no change to the assign menu's own code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Load | GET users ok | active rows in table; "Désactivés ({n})" ghost button only if n > 0 | failure → `ScreenState` "Impossible de charger les utilisateurs." + Réessayer |
| Add | `" Lea@X.be "`, "Léa", Agent | POST `lea@x.be`; row "Pas encore inscrit"; toast "Utilisateur ajouté."; dialog closes | 400/other → generic toast |
| Add duplicate | 409 `email_taken` | sentence under the email field; dialog open | — |
| Add invalid | empty name / bad email | "Saisissez un nom." / "Saisissez une adresse e-mail valide."; no request | — |
| Role change | Passer admin / Passer agent | PATCH `{role}`; toast "Rôle modifié." | 409 `last_admin` → its sentence as toast |
| Demote self | own row, another admin active | PATCH ok → full load `/tournee` | — |
| Deactivate | confirm on agent with 3 open | dialog says "3 prospects restent assignés à {nom}…"; PATCH `{active:false}`; toast "Utilisateur désactivé."; row moves to Désactivés | 409 `last_admin` → its toast |
| Deactivate counts | 0 / 1 / n open | the three design.md sentences | — |
| Deactivate self | another admin active | PATCH ok → full load `/login` | — |
| Last admin | one active admin row | its Passer agent and Désactiver disabled + meta sentence | — |
| Reactivate | Réactiver on a Désactivés row | PATCH `{active:true}`; toast "Utilisateur réactivé."; back as Pas encore inscrit | generic toast |
| Mobile | width < 768px | list rows: name + badge / email + role / count + menu | — |
| Null name | break-glass row, `name: null` | email stands in for the name everywhere `{nom}` appears | — |

</frozen-after-approval>

## Code Map

- `src/client/admin/queries.ts` -- `adminKeys` (L59-70): add `users: () => ["admin","users"]`. Add `useUsers()` (GET `/api/admin/users` → `UsersResponse`), `useCreateUser()` (POST), `useUpdateUser()` (PATCH `/api/admin/users/${encodeURIComponent(email)}` with `UserUpdate`), each invalidating `adminKeys.users()` and `adminKeys.agents()`. Follow `useAssign` (L210) / `useCreateScript` (L537). Do not fix `useAgents`' stale comment (L160) — found-in-passing issue instead.
- `src/client/api.ts` -- `ApiError(status, code, message)`, `apiFetch<T>`; branch on `error.code` like `ProspectsScreen.tsx` L41.
- `src/client/admin/agents/AgentsScreen.tsx` (new) -- `AgentsScreen({email})`: `ScreenHeader` (title, subtitle, `actions` = add Button), `ScreenState` (skeleton rows, `loading`, `loadFailed`), one `Surface` with `UsersTable` or `UsersList` by `useIsMobile()` (`src/client/hooks/use-mobile.ts`), then the Désactivés toggle (`aria-expanded`) and list. Split row menu, add dialog and deactivate dialog into sibling files (`RowMenu.tsx`, `AddUserDialog.tsx`, `DeactivateDialog.tsx`) as `admin/prospects/` does.
- Patterns: table vs list `ProspectsScreen.tsx` L54, L339-341 and `admin/prospects/ProspectsTable.tsx`; row menu `admin/prospects/RowMenu.tsx` (`onSelect`, `disabled`); resolver `src/client/auth/LoginScreen.tsx` L17, L32, L54-55, L119; `AlertDialog` `src/client/field/leave-guard.tsx` L69-94; dialog that cannot close mid-save `scripts/ScriptsScreen.tsx` L362-386; toasts `import { toast } from "sonner"`.
- `src/client/admin/AdminApp.tsx` -- `<Route path="agents" element={<AgentsScreen email={email} />} />`.
- `src/client/admin/nav.ts` -- Pilotage gets `{label: copy.nav.agents, path: "/admin/agents", icon: Users}` after Tableau de bord; update the header comment's route count.
- `src/client/copy/shared.ts` (~L32) -- `nav.agents: "Agents"`. `src/client/copy/admin.ts` -- new `agents` section with every design.md § Agents string used here (incl. role labels, badge words, "Vous", the three count sentences and the always-sentence, toasts, generic failure, loading/failed).
- `src/client/admin/nav.test.ts` -- add `/admin/agents` to `ADMIN_APP_ROUTES` (L18) and the Pilotage order assertion.
- Tests: `src/client/admin/agents/AgentsScreen.test.tsx` (new) following `ProspectsScreen.test.tsx` (`vi.stubGlobal("fetch")` routed by URL+method, `createAdminQueryClient`, `MemoryRouter`, `<Toaster/>`, `matchMedia` spy for mobile). Stub `window.location.assign` for the two full loads.
- Docs: `docs/design.md` only if a choice here departs from it (expected none).

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/copy/shared.ts`, `src/client/copy/admin.ts` -- nav label and `agents` copy section -- invariant 15.
- [ ] `src/client/admin/queries.ts` -- key, `useUsers`, `useCreateUser`, `useUpdateUser` -- one cache, assign menu follows.
- [ ] `src/client/admin/agents/*.tsx` -- screen, table, list, row menu, add dialog, deactivate dialog, Désactivés -- design.md § Agents.
- [ ] `src/client/admin/AdminApp.tsx`, `src/client/admin/nav.ts`, `src/client/admin/nav.test.ts` -- route and nav entry.
- [ ] `src/client/admin/agents/AgentsScreen.test.tsx` -- every matrix row, plus: the add dialog's request body is trimmed/lowercased; the deactivate dialog's count comes from the refetch, not the stale list; mutations invalidate the agents key.

**Acceptance Criteria:**
- Given `pnpm build`, when the precache check runs, then it passes and no field chunk gains admin code; quote the precache total against 1,000 KiB.
- Given the built `dist/` admin chunk, when grepped for the seeded emails (`admin@example.com`, `agent@example.com`), then nothing matches.
- Given the existing client suite, when it runs, then it passes with only `nav.test.ts` edited.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- all green.
- `grep -l "example.com" dist/assets/*.js` -- no admin chunk listed.

**Manual checks:**
- On `pnpm dev` as admin: the story's Verify list (create → in assign menu; duplicate; deactivate count and Désactivés; Réactiver; last-admin disabled; self-deactivate lands on `/login`; 375px).

## Implementation Notes

- Implemented by a pwa-engineer subagent, and so were the pass-1 patches.
- The build writes to `dist/client/assets`, not `dist/assets`; the signed-out chunk grep runs there.
- Sonner's toast store is module-level, so the screen tests call `toast.dismiss()` in `afterEach`.
- Verification (after pass-1 patches): `pnpm typecheck`, `lint`, `test` (93 files, 2357 tests) and `build` green; precache 938.43 KiB of 1,000 KiB; `grep -l example.com dist/client/assets/*.js` matches nothing.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough; blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: high 1, medium 2, low 13, false 3, maybe-false 1.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | blind | PATCH answers 204 with no body; `apiFetch` always parses JSON, so every role change, deactivation and reactivation shows the generic failure, skips invalidation and never redirects | high | patch: `apiFetch` returns `undefined` on 204 (`identity.ts:133`, `api.ts:37`) |
| 2 | blind | Test stubs answer PATCH with a JSON 200 and hide #1 | high | patch with #1: stubs return 204, no body |
| 3 | blind, edge | Awaited `onSuccess` invalidation delays the self redirect behind a 403/401 refetch, and the load-failed state flashes | medium | patch: fire-and-forget, as `query-client.ts` documents |
| 4 | blind, edge, vgap | Deactivate dialog stuck on "Vérification…" if its refetch fails or the user is gone | medium | patch: toast the generic failure and close; failed-refetch test |
| 5 | blind | "Ses appareils seront déconnectés…" hidden until the refetch, though design.md says always | low | patch: rendered unconditionally |
| 6 | blind, edge | "Déjà un compte" sentence stays after the email is edited | low | patch: `taken` cleared on email change |
| 7 | vgap | `/admin/agents` route registration untested | low | patch: AdminApp.test case |
| 8 | vgap | Mobile `UsersList` actions untested | low | patch: last-admin, Vous and Réactiver cases in both layouts |
| 9 | blind | `useUsers` comment claims freshness the hook does not set | low | patch: comment reworded |
| 10 | blind, edge | Row actions can fire twice while a PATCH is pending | low | reject: a menu item closes its menu; a double Réactiver sends the same idempotent PATCH; the fix threads pending state through every row |
| 11 | blind, edge, intent | Deactivated rows show "Pas encore inscrit" and a blank Appareils header | low | reject: design.md asks for "the same columns" and says a reactivated user returns as Pas encore inscrit |
| 12 | edge | Name over 200 characters shows "Saisissez un nom." | low | reject: unlikely for a person's name; fix adds copy and a branch |
| 13 | edge | Désactivés reopens expanded after its count drops to 0 and rises again | low | reject: cosmetic and rare; fix adds a guard |
| 14 | blind | `displayName` in RowMenu.tsx, `UsersActions` in UsersTable.tsx | low | reject: no caller diverges; naming only |
| 15 | blind | No test for choosing Admin in the Select, or for an inactive admin beside one active | low | reject: Radix Select is unreliable in happy-dom; `lastAdmin` filters active rows first |
| 16 | intent | Tests stub fetch; the assign menu is not rendered; the signed-out chunk is not tested | low | reject as code work: the chunk is grepped after the build, the rest is the manual `pnpm dev` pass |
| 17 | blind, intent | Code, passphrase and device rows from design.md are absent and unrecorded | false | the frozen intent's decisions defer them to entries 8–10 |
| 18 | edge | Rows not sorted by name on the client | false | the server sorts by name (`docs/api.md`, GET users row); the spec forbids a client re-sort |
| 19 | intent | Deactivation copy points to « Prospects sans agent actif », built only in entry 11 | false | design.md's sentence, kept on purpose; entry 11 adds the row |
| 20 | edge | Opening the AlertDialog from a modal DropdownMenu item may leave `pointer-events: none` on body | maybe-false | defer: would be medium; settled by opening and cancelling the dialog on `pnpm dev`, then clicking the page |
