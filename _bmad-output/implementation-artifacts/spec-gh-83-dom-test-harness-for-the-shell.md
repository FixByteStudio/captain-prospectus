---
title: 'DOM test harness for the shell'
type: 'chore'
created: '2026-09-25'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: 'fc2d4cda39ae6280e5bf52bad3738742461b8649'
context:
  - '{project-root}/CLAUDE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The vitest `unit` project runs in node with no DOM, so everything reachable only through JSX is unverified: which frame and redirect each route and role gets, the sync strip and update-prompt wiring, the admin top bar's controls, and the field leave guard. Deleting the forbidden route, the `updatePrompt` prop, a top-bar handler, `useRegisterDirty` or `FieldTabs`' `preventDefault` passes CI today (GH #61, #63, #64, #65 review deferrals), and the refactor sweep (#67) is about to rewrite exactly this code.

**Approach:** Add a third vitest project that runs `*.test.tsx` in a DOM environment with Testing Library, and write component tests for those five rows. Dev-only dependencies; no production code changes beyond what a test needs to be reachable.

## Boundaries & Constraints

**Always:** New packages are `devDependencies` only, so nothing enters the client bundle or the 1,000 KiB precache (ADR-0026). The PR states each package's measured size, latest release date, React 19 / vitest 4 support, workerd applicability (none — DOM tests never run in the `worker` project) and why the platform cannot do it. Tests assert behaviour (roles, accessible names, `href`, `aria-current`, `aria-live`, whether navigation happened), never Tailwind class strings. French strings come from `copy.ts`, never inlined (INVARIANT 15). Each new test must fail when the behaviour it guards is removed — verified, not assumed.

**Never:** No change to the existing `unit` or `worker` projects, their `include` globs or `test/setup-unit.ts`. No production behaviour change, no restyling, no refactor of the shell (that is #67). No new runtime dependency. No `@testing-library/jest-dom` — plain vitest assertions keep the dependency count down. No snapshot tests, no screenshot or browser-mode testing. No test for the OSM map, the sync engine or admin screens beyond the top bar.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Agent hits `/` | `me.role = "agent"` | Redirect to `/tournee`; field band renders, no admin frame | No error expected |
| Admin online hits `/` | `me.role = "admin"`, live `/api/me` | Redirect to `/admin/prospects` | No error expected |
| Agent hits `/admin/prospects` | `me.role = "agent"` | Forbidden empty state inside the field frame, with a link back to `/tournee` | No error expected |
| Unknown path | any role, `/nulle-part` | Not-found empty state inside the field frame | No error expected |
| Update waiting, strip quiet | `pwa.needRefresh`, sync `ok` | `UpdatePrompt` renders once under the band | No error expected |
| Update waiting, update-needed strip | sync status `upgrade-required` | No `UpdatePrompt`; the assertive strip carries the update button (`hidesUpdateBanner`) | No error expected |
| Session expired | sync status `auth` | Strip is in the `aria-live="assertive"` region, with "Se reconnecter" | No error expected |
| Pending writes | `pending > 0`, not running | Polite region carries the waiting message and count; assertive region stays empty | No error expected |
| Theme toggle clicked | `<html>` unpinned, system light | `data-theme="dark"` on `<html>`; the button's label swaps | No error expected |
| ⌘K / Ctrl+K pressed | admin top bar mounted | Search palette opens showing the inert-search message; no network request | No error expected |
| Sign out | avatar menu opened | A plain `<a href="/cdn-cgi/access/logout">`, not a router link | No error expected |
| Tab tap, clean form | no dirty form, tap Ajouter | Navigates; no dialog | No error expected |
| Tab tap, dirty form | open form registered dirty, tap Tournée | `preventDefault`: dialog first; confirming navigates, cancelling stays | No error expected |
| Dirty form unmounts | dirty form leaves | Guard resets to clean, so the next tap does not ask | No error expected |

</frozen-after-approval>

## Code Map

- Work only in the checkout `/home/m0/PROJECTs/captain-prospectus-harness` (branch `test/shell-dom-harness`, clean at `fc2d4cd`, **dependencies not installed yet — run `pnpm install` first**). Never touch `/home/m0/PROJECTs/captain-prospectus` or the other `captain-prospectus-*` worktrees: concurrent story sessions own them. Paths below are relative to that checkout; this spec and everything under `/home/m0/PROJECTs/captain-prospectus/_bmad-output/` is read-only.
- `vitest.config.ts` — two projects today (`unit`: node, `src/client/**/*.test.ts` + `src/shared`, setup `test/setup-unit.ts`; `worker`: workerd). Add a third, `dom`. The file has no `resolve.alias`, so the new project needs its own: `@` → `src/client` (mirrors `vite.config.ts:13` and `tsconfig.client.json`), and a stub for `virtual:pwa-register/react` — `src/client/pwa.ts:17` imports it and VitePWA is not loaded under vitest, so anything importing `App.tsx` fails to resolve without one. `vitest.config.ts` is in no tsconfig `include`; leave that alone.
- `src/client/App.tsx` — the whole routing subject. `:307` `isAdmin = me.role === "admin" && !offline`; `:314` the `/` redirect; `:321-345` `FieldFrame` wrapping `/tournee/*`, the admin-only forbidden route (`:323`) and `*` not-found; `:348` the admin branch. `:244-287` the identity effect calls `apiFetch("/api/me")` (`src/client/api.ts:19`) and reads/writes Dexie via `getMeta`/`setMeta` (`src/client/field/db.ts`). Mock `./api` per test for the role; Dexie works under `fake-indexeddb/auto` as the unit setup already does.
- `src/client/App.tsx:113,144-145` — `hidesUpdateBanner(useSyncView())` gates `UpdatePrompt`; `SyncStrip` follows it. `src/client/field/SyncIndicator.tsx:56,118` (`useSyncView`, `SyncStrip`, two always-mounted `StripRegion`s at `:152`, polite and assertive). `useSyncState` (`src/client/field/useSync.tsx:35`) throws outside `SyncProvider`; mock that module to drive `{ status, running, pending }` rather than running the real engine and its timers.
- `src/client/admin/TopBar.tsx:63` — `TopBar({ pathname, email })`; renders `SearchPalette` (`src/client/admin/SearchPalette.tsx:121`, window `keydown` → `isPaletteShortcut`), a disabled bell, `ThemeToggle` (`src/client/admin/ThemeToggle.tsx:27`, click → `pinTheme(next, document.documentElement)`) and `AccountMenu` (`src/client/admin/AccountMenu.tsx:78`, Radix dropdown holding `<a href={LOGOUT_PATH}>`). Render `TopBar` directly inside a router, not the whole `AdminApp` — `AdminLayout` pulls in TanStack Query, sonner and the Sidebar.
- `src/client/field/FieldTabs.tsx:49-53` — `handleClick` calls `shouldAsk` and `event.preventDefault()`, then the AlertDialog at `:137` navigates on confirm. `src/client/field/leave-guard.tsx:25,43` — `LeaveGuardProvider`, `useRegisterDirty` (registers on change, clears on unmount). Pure parts (`shouldAsk`, `fieldTabs`, `isCurrentTab`) are already covered by `tabs.test.ts` / `leave-guard.test.ts` — do not duplicate them.
- `src/client/field/VisitScreen.tsx:132` and `src/client/field/AddProspectScreen.tsx:107` — the two `useRegisterDirty(form.formState.isDirty)` call sites. They are lazy, Dexie-backed screens; prefer a small in-test form component over mounting them, and assert the call sites separately (see Design Notes).
- `test/setup-unit.ts` — one line, `fake-indexeddb/auto`. The DOM setup file mirrors it and adds Testing Library cleanup.
- `eslint.config.js:12-20` and `tsconfig.client.json` (`include: ["src/client"]`, `jsx: react-jsx`, `@/*` path) already cover `src/client/**/*.test.tsx`; no config change needed there.
- `.github/workflows/ci.yml:26` runs `pnpm test`, which runs every project — the new one is in CI as soon as it exists.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json` — add `happy-dom`, `@testing-library/react` and `@testing-library/user-event` as devDependencies; record each one's measured unpacked size, latest release date and React 19 / vitest 4 support for the PR body. If a Radix or cmdk component cannot be driven under happy-dom, switch the whole `dom` project to `jsdom` rather than mixing environments, and say why in Design Notes.
- [ ] `test/stubs/pwa-register.ts` — minimal `useRegisterSW` stub matching what `src/client/pwa.ts` destructures.
- [ ] `test/setup-dom.ts` — `fake-indexeddb/auto` plus Testing Library `cleanup` after each test.
- [ ] `vitest.config.ts` — third project `dom`: `environment` as chosen, `include: ["src/client/**/*.test.tsx"]`, `setupFiles: ["./test/setup-dom.ts"]`, `resolve.alias` for `@` and the pwa-register stub. Update the file's header comment to describe three projects.
- [ ] `src/client/App.test.tsx` — the four routing rows and both `UpdatePrompt` rows from the matrix, driving role through a mocked `./api` and sync state through a mocked `./field/useSync`.
- [ ] `src/client/field/SyncIndicator.test.tsx` — the session-expired and pending rows: which live region carries the strip, its message from `copy.ts`, and its action button.
- [ ] `src/client/admin/TopBar.test.tsx` — the theme toggle, the ⌘K palette and the sign-out anchor rows.
- [ ] `src/client/field/FieldTabs.test.tsx` — the three leave-guard rows, plus `aria-current` on the current tab and the admin-only third tab.
- [ ] `src/client/field/leave-guard.test.tsx` — `useRegisterDirty` through `LeaveGuardProvider`: a form that reports dirty makes the guard ask, and unmounting it clears the flag.
- [ ] `docs/architecture.md` — a short "Tests" note under §3 naming the three vitest projects and what each covers.
- [ ] Comment headers on each new test file: why it exists (the deferral it closes), in the repo's existing style.

**Acceptance Criteria:**
- Given a clean checkout, when `pnpm install && pnpm test` runs, then all three projects pass and the `dom` project reports the new files; `pnpm typecheck` and `pnpm lint` pass too.
- Given each of the five guarded behaviours in turn — the non-admin forbidden route, the `UpdatePrompt`/`SyncStrip` wiring, a top-bar control's handler, `useRegisterDirty` in a form, `FieldTabs`' `preventDefault` — when it is deleted from the source, then at least one new test fails. The PR names the test that catches each.
- Given `pnpm build`, then the Workbox precache line is unchanged from `main`'s, since nothing new reaches the bundle. The PR quotes it against the 1,000 KiB ceiling.

## Implementation Notes

## Spec Change Log

## Review Triage Log

### Pass 1 (thorough; blind-hunter, edge-case-hunter, verification-gap, intent-alignment)

Verdicts: high 0 · medium 6 · low 4 · false 2 · maybe-false 0.

| Verdict | Route | Finding and evidence |
|---|---|---|
| medium | patch | **`updatePrompt` prop to `AdminApp` uncovered.** Verified: the admin-route case runs with `stub.needRefresh` false and both banner cases run on `/tournee`, so `updatePrompt={null}` in `App.tsx:353` typechecks and passes all 22 dom tests. This is one of the five rows the Intent names. |
| medium | patch | **`SyncStrip`'s action never invoked.** Verified: the tests assert the button exists and sits in the assertive region but never click it; moving or deleting `onAction={runAction}` leaves an inert "Se reconnecter" with CI green. |
| medium | patch | **`FieldTabs` argument order to `shouldAsk` uncovered.** Verified: every dirty case renders at `/tournee/abc123` and taps a non-current tab, so swapping `to` and `current` passes. The row "a dirty form's own tab must stay silent" is only covered as a pure function. |
| medium | patch | **`App.test.tsx`'s module-level `stub` is never reset**, and `App`'s unawaited `setMeta` write is never cleared. Order-coupled today; `--shuffle` or an appended case changes what earlier cases test. |
| medium | patch | **Stale comments made false by this change.** `src/client/field/leave-guard.tsx:9` ("only reachable through JSX and so untested") and `src/client/field/tabs.ts:3` ("this repo has no DOM test harness") both read as current fact; `CONTRIBUTING.md`'s Tests table has no `dom` row. Code/doc drift caused by the change (CLAUDE.md DoD). |
| medium | patch | **`useRegisterDirty` call sites pinned by raw source text.** Verified brittle in both directions: a Prettier re-wrap or renaming the `form` variable breaks it, and the literal surviving in dead code passes it. #67 is about to rewrite exactly these lines. Fix is to make the assertion tolerant and honest about what it is, not to mount two Dexie-backed screens. |
| low | patch | **`test/stubs/pwa-register.ts` is not type-pinned** to `virtual:pwa-register/react`; drift is invisible to tsc. One-line `satisfies`. |
| low | patch | **`dom` include is `src/client/**/*.test.tsx`**, so a component test authored outside `src/client` would match no project and be silently skipped. |
| false | — | **"`pnpm-lock.yaml` is missing, CI will fail `--frozen-lockfile`."** Refuted: the lockfile is updated and staged (170 insertions), and `pnpm install --frozen-lockfile` reports "Already up to date". The lockfile was excluded from the diff *file* handed to the lenses, for size — it is not missing from the change. |
| false | — | **"`@testing-library/dom` is undeclared and may not resolve."** Refuted: it is in `pnpm-lock.yaml` at 10.4.2 as the resolved peer of both packages, and CI installs from that lockfile. |
| low | reject | **Pin the happy-dom URL against `forcedView()`'s `?sync=` override.** Real only for a URL nobody sets; the guard protects a state never demonstrated reachable. |
| low | reject | **Move the theme/`localStorage` reset into `test/setup-dom.ts`, add `restoreMocks`.** Cosmetic; `TopBar.test.tsx` already restores its own mocks and no other test touches theme. |
| low | defer | **Offline-admin branch and the identity-error screen uncovered** — deleting `&& !offline` from `isAdmin` passes. Not one of the five named rows; the fix needs a rejecting `apiFetch` plus a seeded Dexie identity, which is more than a direct correction. |
| low | defer | **Top-bar coverage beyond the one named handler** — `ThemeToggle`'s `matchMedia` change listener, both `SearchPalette` buttons' `onClick`, the `metaKey` half of the shortcut, and dismissing the leave dialog by Escape or overlay. |
| low | defer | **The geolocation shim in `test/setup-dom.ts` fixes `navigator.geolocation` as permanently denied**, so the positioned path of `useAgentPosition` is unreachable from the `dom` project. |
| — | reject | **Spec matrix says sync status `upgrade-required` where the code uses `upgrade`.** The fix would edit this build's spec; the code and tests agree with each other. |

## Design Notes

A third project rather than a per-file environment comment: vitest 4 dropped `environmentMatchGlobs`, and a project keeps the node tests' `include` untouched so nothing about the existing suite changes. `.test.tsx` versus `.test.ts` is the whole selector — no test moves between projects by accident.

Mock at the module boundary the component actually reads, not the network: `vi.mock("./api")` for the role and `vi.mock("./field/useSync")` for sync state. The alternative — a real `SyncProvider` over `fake-indexeddb` — would make every strip assertion wait on timers and the sync engine, testing that engine again instead of the wiring.

`VisitScreen` and `AddProspectScreen` are lazy, Dexie-backed and form-heavy; mounting them to prove one hook call would be slow and brittle. Test the contract instead — a minimal component that calls `useRegisterDirty(true)` inside `LeaveGuardProvider` makes a tab tap ask, and unmounting it stops that — and keep the real call sites honest with a cheap source assertion or by pointing the `FieldTabs` test at the same context. Say in the PR which of the two you did.

Assert what a user or screen reader can observe. `getByRole("link", { name: copy.nav.tabs.add })`, `aria-current="page"`, the `aria-live` region a message lands in, `href` on the sign-out anchor, `document.documentElement.dataset.theme`. Class strings are #67's to rewrite; a test that pins them would block the sweep it exists to protect.

## Verification

**Commands:**
- `pnpm install` — expected: lockfile updates with the three devDependencies only.
- `pnpm test` — expected: `unit`, `worker` and `dom` all pass; no test from the existing projects changes behaviour.
- `pnpm typecheck` — expected: clean, including the new `.test.tsx` files under `tsconfig.client.json`.
- `pnpm lint` — expected: clean (eslint + prettier).
- `pnpm build` — expected: the Workbox precache total matches `main`'s; quote it in the PR.
- Mutation check, one at a time, reverted after each: delete the `!isAdmin` forbidden route, the `!hideUpdatePrompt &&` guard, `ThemeToggle`'s `onClick`, `useRegisterDirty`'s effect body, and `FieldTabs`' `event.preventDefault()` — expected: a named test fails for each.
