---
title: 'Admin top bar (GH #64)'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: '2320495cebbf9a0d67c5748f5e7b6b1e6e871bd2'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The admin top bar (GH #63) holds only the sidebar toggle. CAP-1 also needs the breadcrumb, ⌘K search, the notifications bell, a theme toggle that persists, and an avatar menu with "Se déconnecter". Separately, the service worker answers every navigation with the precached `index.html`, so a link to `/cdn-cgi/access/logout` would never reach Access (issue #76).

**Approach:** Fill `AdminLayout`'s header with shadcn Breadcrumb, a search button and a CommandDialog (`cmdk`, in the admin chunk only), a disabled bell, a Sun/Moon theme button, and a DropdownMenu avatar. The theme is pinned in `localStorage` and applied to `<html data-theme>` by an inline script in `index.html` before first paint. `/^\/cdn-cgi\//` joins `navigateFallbackDenylist`, and the PR closes #76.

## Boundaries & Constraints

**Always:**
- Layout matches `key-a1-dashboard.html`, left to right: toggle, breadcrumb, gap, search, bell, theme, avatar. The bar is 56 px, `card`, with a bottom border. At ≥ 1024 the breadcrumb reads "Captain Prospectus › {group} › {page}", from 768 to 1023 it reads "{group} › {page}", and below 768 it shows only the page name in semibold. The group and page come from `NAV_GROUPS` and `isCurrent`, and an unmatched path shows only what it can.
- Search from 768 px is a 240 px outlined button, "Rechercher un prospect…", with a shortcut hint. Below 768 px it is an icon button with that aria-label. The button, ⌘K and Ctrl+K (any case) all toggle a CommandDialog. The dialog's only content is its input and the empty text "La recherche n'est pas encore disponible. Utilisez les filtres de la page Prospects." It makes no request. The hint reads "⌘K" on Apple platforms and "Ctrl K" elsewhere.
- The bell is a disabled icon button with the aria-label "Notifications" and no unread dot.
- Theme: a two-state button. Its icon and aria-label name the action: Moon with "Thème sombre" while light, Sun with "Thème clair" while dark. With no stored pin, the button follows the system, and it updates live when the system theme changes. A click pins the other theme in `localStorage` and on `<html data-theme>`. There is no route back to "system" (agent default). Every `localStorage` access is wrapped in try/catch. The field side gets the same pin through the boot script.
- Avatar: initials on `primary` with a `primary-edge` inset ring, as a DropdownMenu trigger. The menu shows the email, a separator, then "Se déconnecter" (`LogOut`), which is a real `<a href="/cdn-cgi/access/logout">`, not a router link.
- Every new French string goes in `copy.ts`, including the English that vendored Breadcrumb and Command ship with. Every icon-only button has an aria-label.
- The shadcn Command and `cmdk` code ends up only in `AdminApp-*`. The precache total stays at or under 1,000 KiB. The PR quotes it, along with `cmdk`'s size and maintenance.
- `docs/design.md`: add a paragraph on the top bar, and state in the Colour theme paragraph that the admin toggle pins `data-theme`. `docs/domains/identity-access.md`: one line on "Se déconnecter" and the `/cdn-cgi/` exemption.

**Never:**
- No search back end, query, result items or navigation from the palette. No notifications content or menu.
- No persistence of the sidebar state. No change to the field band's avatar, or to any screen's content.
- No new dependency except `cmdk`. No `next-themes`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Deep link | `/admin/a-rattacher` at 1280 | "Captain Prospectus › Terrain › À rattacher" | — |
| Unknown admin path | `/admin/xyz` | "Captain Prospectus" only | — |
| Theme pin survives | click to dark, then reload | the first paint is already dark, and the button reads "Thème clair" | — |
| Storage blocked | `localStorage` throws | the toggle still switches for this page, and the next load follows the system | Swallowed |
| Garbage stored | the key holds "blue" | treated as no pin | — |
| System flips | no pin, OS goes dark | the page and the button follow | — |
| Shortcut | ⌘K, then ⌘K again | the palette opens, then closes; Esc also closes it; the network panel shows no request | — |
| Logout | "Se déconnecter" with an active SW | the navigation goes to the network at `/cdn-cgi/access/logout` | — |

</frozen-after-approval>

## Code Map

- `src/client/admin/AdminLayout.tsx` -- The header is at L45-47: `safe-top border-border bg-card flex h-14 … px-3` holding `<SidebarTrigger />`. Add `email` to the props. The file stays in the admin chunk.
- `src/client/admin/nav.ts` -- `NAV_GROUPS` and `isCurrent(pathname, path)` feed the breadcrumb. Add a pure `breadcrumbFor(pathname)` here, and test it in `nav.test.ts`.
- `src/client/admin/AdminApp.tsx` / `src/client/App.tsx:343` -- `AdminApp` takes only `updatePrompt`. Pass `email={me.email}` through to `AdminLayout`.
- `src/client/format.ts` `initials(email)` -- Reuse it for the avatar. The field band's static avatar is at `App.tsx:127-136`; copy its classes and leave the field band alone.
- `src/client/ui/dropdown-menu.tsx`, `dialog.tsx` -- Already vendored (`radix-ui/<part>`, `@/copy`). Vendor `breadcrumb.tsx` and `command.tsx` (new-york) alongside them.
- `src/client/ui/sonner.tsx:18-35` -- Its `useTheme` already follows `data-theme` through a MutationObserver, so toasts need no change. Use the same pattern for the toggle's resolved theme.
- `src/client/copy.ts:26-56` -- `copy.nav`. `avatar(email)` exists. Add the breadcrumb, search, palette, bell, theme and logout strings.
- `index.html` -- No inline script today, and there is no CSP (no `_headers`, no header set in the Worker). Add a tiny classic `<script>` in `<head>` that reads the key and sets `data-theme` only for "light" or "dark".
- `src/client/styles/app.css:43-50, 285-344` -- Theme values already swap on `data-theme` and the system query. No CSS changes are expected.
- `vite.config.ts:57-71` + `config.test.ts:58-71` -- The denylist is `[/^\/api\//, RECONNECT_MARKER_PATTERN]`. Extend its comment for `/cdn-cgi/`, and add a test in the style of the reconnect-marker one.
- `docs/design.md:134-137` (theme) and `:204-218` (admin Layout); `docs/domains/identity-access.md:25` (the reconnect paragraph, which the logout line goes next to).

## Tasks & Acceptance

**Execution:**
- [ ] `vite.config.ts`, `config.test.ts` -- Add `/^\/cdn-cgi\//` to the denylist with a why-comment (#76). The test asserts that the entry is present.
- [ ] `src/client/theme.ts` + `theme.test.ts` -- Pure code: `THEME_STORAGE_KEY`, `parseTheme(raw)` (only "light" or "dark", otherwise null), `otherTheme()`, and safe `readPin`/`writePin`. `theme.test.ts` covers the parse rules and asserts that `index.html` contains the same key literal (in the style of `config.test.ts`).
- [ ] `index.html` -- The pre-paint boot script, in try/catch.
- [ ] `src/client/ui/breadcrumb.tsx`, `src/client/ui/command.tsx`, `package.json` -- Vendor both, `pnpm add cmdk`, and replace the shipped English with `copy.ts` strings.
- [ ] `src/client/admin/nav.ts`, `nav.test.ts` -- `breadcrumbFor` and `shortcutHint(platform)`, tested against the matrix rows.
- [ ] `src/client/admin/TopBar.tsx` -- The breadcrumb, `SearchPalette` (button plus a global keydown listener with `preventDefault`), the bell, `ThemeToggle` and `AccountMenu`. Split out a file only if one grows past about 80 lines.
- [ ] `src/client/admin/AdminLayout.tsx`, `AdminApp.tsx`, `App.tsx` -- Thread `email` through, and render `TopBar` beside `SidebarTrigger`.
- [ ] `src/client/copy.ts` -- The strings.
- [ ] `docs/design.md`, `docs/domains/identity-access.md` -- As listed in Always.

**Acceptance Criteria:**
- Given `pnpm build`, when `dist/assets` is grepped for `cmdk-input`, then only `AdminApp-*` matches, and the precache line reads ≤ 1,000 KiB.
- Given `pnpm dev` as admin at 1280, 820 and 390 px in light and dark, then the bar matches the mockup at each width, and Tab reaches every control in reading order.

## Implementation Notes

- Implemented by a subagent from this spec, in the `../captain-prospectus-64` worktree. `npx shadcn add` also pulled in a bogus `cn` npm package, which the subagent removed; `cmdk@1.1.1` is the only new dependency.
- The breadcrumb separator is the vendored chevron, as the mockup draws it, rather than a literal "›". The bell has no dot, as Always says, although the mockup shows one.
- The matrix audit, done in the parent session, found that four rows lived only inside components or the inline script. That logic now sits in pure helpers with tests:
  - `resolvedTheme` reads `<html data-theme>` rather than storage. With storage blocked, the button therefore still agrees with the page after a click.
  - `isPaletteShortcut` and `LOGOUT_PATH` live in `nav.ts`.
  - `theme.test.ts` runs the `index.html` boot script itself, covering the stored-pin, garbage and blocked-storage cases.
- The audit also fixed a leftover English string: the vendored breadcrumb's `aria-label="breadcrumb"` is now `copy.breadcrumb`.
- Typecheck, lint and test are green (658). Build, from the subagent: the precache is 633.13 KiB, the entry chunk 149.61 kB gzip (was 149.43), and `AdminApp-*` 150.54 kB gzip (+6.39). `cmdk-input` appears only in `AdminApp-*`.
- After the review patches (triage rows 1–6), typecheck, lint and test are green (662). Build: the precache is 14 entries, 633.15 KiB; the entry chunk is 149.63 kB gzip and `AdminApp-*` 150.63 kB gzip. In the JS, `cmdk-input` appears only in `AdminApp-*`. The shared CSS also holds it, but only as Tailwind selector text from `command.tsx`.
- Not checked in a browser: the 1280/820/390 walkthrough, and the network-tab check that logout leaves the service worker. Both are for the PR reviewer.

## Spec Change Log

## Review Triage Log

**Pass 1 (thorough, 4 lenses).** Rate-limited on the first launch; the blind, edge and verification lenses were relaunched on the same diff. Verdicts: high 0, medium 2, low 13, false 3, maybe-false 0. Routes: 6 patch entries (rows 1–6), 1 defer (row 7), the rest rejected. Intent alignment is descriptive; its divergences are rows 20–23.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | verif, blind | The `/cdn-cgi/` denylist entry and `LOGOUT_PATH` are tied only by source-text regexes and a copied literal | medium | patch | If either one is narrowed, all tests stay green while logout falls back to precache. Fix: one `ACCESS_PATH_PATTERN` imported by `vite.config.ts`, with an import-wiring test, as the reconnect marker does |
| 2 | verif | No test proves that a click stores what the boot script reads, and `readPin` has no production caller | low | patch | Deleting `writePin` would pass every test. Fix: a pure `pinTheme`, round-tripped through the real boot script, and `readPin` deleted |
| 3 | edge | `isPaletteShortcut` throws when `key` is undefined (Chrome autofill keydown) | medium | patch | This is a known Chrome autofill behaviour, and the listener is global to the admin frame. Fix: guard with `typeof` |
| 4 | edge, blind | Shift, Alt and `repeat` are not checked: Ctrl+Shift+K (Firefox console) gets swallowed, and holding the keys flickers the dialog | low | patch | Direct guards in the pure helper, with negative tests |
| 5 | edge, blind | `CommandDialog`'s sr-only header sits outside `DialogContent`, so the h2 lives in the top bar even while the dialog is closed | low | patch | The Radix Dialog root renders no DOM. Moved inside the content |
| 6 | blind | The search button's accessible name includes "Ctrl K" | low | patch | `<kbd aria-hidden>`, plus `aria-keyshortcuts` on both buttons. The test title "once each" also overclaimed and was renamed |
| 7 | blind, intent | `TopBar`, `SearchPalette`, `ThemeToggle` and `AccountMenu` have no render test (anchor vs `Link`, breakpoint classes) | low | defer | Pre-existing: there is no DOM harness, and the spec forbids a new dependency. The same deferral as #63 row 11 |
| 8 | blind | `pnpm-lock.yaml` is missing from the diff | false | reject | The staged diff excluded the lockfile on purpose. The worktree has the `cmdk` lock change |
| 9 | edge, blind | No cross-tab `storage` sync | low | reject | Needs two admin tabs plus a toggle in one of them, and the fix adds a listener |
| 10 | edge | `MediaQueryList.addEventListener` is missing before Safari 14 | false | reject | `AdminLayout` (GH #63) already relies on it, and Safari 14 shipped in 2020 |
| 11 | edge, blind | "Se déconnecter" while offline shows the browser's error page | low | reject | The admin side is online-only (ADR-0019, `isAdmin` requires the network). The fix adds a branch and copy |
| 12 | edge | "Tab reaches every control": the disabled bell is skipped | low | reject | The bell is disabled by design, as the Always list says |
| 13 | edge | `shortcutHint` takes the user agent, not a "platform" | false | reject | The behaviour matches the rule. Only the Tasks wording differs |
| 14 | blind | The description duplicates the empty text | low | reject | Read twice on open. Cosmetic |
| 15 | blind | The hint says "Ctrl K" while design.md says "Ctrl+K" | low | reject | The hint follows the mockup's "⌘K" style |
| 16 | blind | The avatar classes are copied from the field band | low | reject | The spec says to copy them, and a shared helper adds entry-chunk surface |
| 17 | blind | The palette should offer an item that goes to Prospects | low | reject | The Never list forbids navigation from the palette |
| 18 | blind | The PR must state `cmdk`'s size and maintenance | low | reject | This belongs in the PR description, not the code. It is covered there |
| 19 | blind | The `config.test` regex breaks on a `]` inside an earlier entry | low | reject | Superseded by row 1's import-wiring test |
| 20 | intent | The pin also themes the field side | low | reject | Intended: the epic's assumption says the field follows the same pin |
| 21 | intent | There is no way back to "system" | low | reject | An agent default, shown at the checkpoint and approved |
| 22 | intent | `cmdk` sits in the shared `ui/` folder, and no test guards its chunk | low | reject | All vendored parts live in `ui/` (ADR-0014). The build grep is in Verification, as for the Sidebar in #63 |
| 23 | intent | Installed PWAs get the denylist only after their SW updates, and logout stops at D1 (the navigation reaches Access) | low | reject | Inherent to SW updates, which the existing update prompt handles. End-to-end sign-out is Access's job |

## Design Notes

Why an inline script rather than `main.tsx`: module scripts are deferred, so the browser can paint the system theme before React loads, and a pinned-dark user would see a white flash on every load. The script is the one place that cannot import the key, so a test ties the two literals together, the same way `config.test.ts` ties the reconnect marker to the config.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: green.
- `pnpm build` -- expected: success. Quote the precache line, the entry chunk's gzip size and the `AdminApp-*` gzip delta from `cmdk`.

**Manual checks:**
- In `pnpm dev`, go through each matrix row. Locally, `/cdn-cgi/access/logout` is not served by Access, so check that the click makes a full network navigation to that URL (DevTools › Network, "Doc") rather than the SPA's "Page introuvable.".
