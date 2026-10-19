---
title: 'The field avatar opens an account card (GH #561)'
type: 'feature'
created: '2026-10-18'
status: 'in-progress'
baseline_commit: 'd4e7b2f917c6be871398857514227246153d60a8'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/forge/agent-logout-and-settings/forged-idea.md'
  - '{project-root}/_bmad-output/forge/agent-logout-and-settings/mockups/account-menu-v4.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The field avatar is a static `role="img"` (2026-09-24 decision, spec-gh-65): an agent cannot choose a theme or see which build runs, and an admin reaches the dashboard through a fifth tab that crowds the bar.

**Approach:** The avatar becomes a button opening a native `popover` card (shadcn-menu look): email + role, « Tableau de bord » for an online admin, « Apparence » (Système/Clair/Sombre native radios), and « Version 0.1.0 · a605114 » stamped at build. The dashboard tab goes; the bar is four tabs for everyone. Mockup: `forge/agent-logout-and-settings/mockups/account-menu-v4.png`.

## Boundaries & Constraints

**Always:**
- Native `popover="auto"` + `popoverTarget` on the avatar button: light dismiss, Escape and re-tap close it for free. No Radix DropdownMenu, no new dependency.
- Card: `bg-popover`, border, `shadow-md`, rounded; `min-w-52` (208px), `max-w-[calc(100vw-24px)]`; fixed right 12px, top just under the band (`safe-top` + `band-height`). Email `text-xs` semibold, `break-words`, with a `<wbr>` before « @ »; role muted 12px; separators between sections; overline « Apparence »; 3 `FieldRadioOption` tiles 48×48 with 16px Lucide `Monitor`/`Sun`/`Moon` and `aria-label` Système/Clair/Sombre; version line muted `text-xs`.
- The dashboard button shows only when `adminOnline` (`adminAccess(...).entry`); it hides the popover, then `leave(() => navigate("/admin"))`.
- Système clears `localStorage` `cap-theme` and `<html data-theme>`; Clair/Sombre call `pinTheme`. Storage errors swallowed like `writePin`. The checked radio reads `<html data-theme>`, Système when no pin.
- Version: Vite `define` from `package.json` version + `GITHUB_SHA` first 7 chars, `dev` when unset; in its own commit, before the card's.
- All strings in `copy/field` or `copy/shared` (beside `nav.avatar`); avatar's accessible name says it opens the account menu.
- Same change: `docs/design.md` (Layout line 290, theme paragraph 158-166, Tab bar section, a short "Account card" subsection), comments at `App.tsx:237` and `copy/shared.ts:72`.

**Never:** an agent logout; any other card item; a Système option on the admin toggle; an ADR; a `CLIENT_VERSION` bump; CSS anchor positioning (not on iOS 17); a per-component CSS file or hardcoded colour.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No pin | `cap-theme` absent | Système checked; page follows the phone | — |
| Pick Sombre | Système checked | `cap-theme=dark`, `data-theme=dark`, no reload | storage blocked: attribute still set |
| Pick Système | pinned dark | key removed, `data-theme` removed, page follows OS | storage blocked: attribute still removed |
| Garbage pin | `cap-theme=blue` | Système checked (boot script ignores it) | — |
| Admin online, form clean | tap « Tableau de bord » | card closes, navigates to `/admin` | — |
| Admin online, form dirty | tap « Tableau de bord » | card closes, leave dialog asks; Annuler stays | — |
| Admin offline / agent | open card | no dashboard row | — |
| Long email | 60-char address at 390px | card widens to 366px, email wraps before « @ » | — |
| CI build | `GITHUB_SHA=a605114…` | « Version 0.1.0 · a605114 » | — |
| Local build/dev | no `GITHUB_SHA` | « Version 0.1.0 · dev » | — |

</frozen-after-approval>

## Code Map

- `src/client/App.tsx:236-245` -- the static avatar span in `FieldFrame`; becomes `<AccountMenu email role adminOnline />`. `FieldFrame` needs `role` (`me.role`, line 548).
- `src/client/field/tabs.ts` -- drop the `/admin` push and the `adminOnline` param; `FieldTabs.tsx:29,33` and the `truncate` comment (~line 103) follow.
- `src/client/theme.ts` -- pure pin helpers; add `ThemeChoice = Theme | "system"`, `themeChoice(pinned)`, `clearPin(root)` / `applyThemeChoice(choice, root)`. Boot script `index.html:31-40` already reads an absent key as "no pin": unchanged.
- `src/client/admin/ThemeToggle.tsx` -- reference only; keep its two-state behaviour.
- `src/client/ui/field-controls.tsx` -- `FieldRadioOption` (gold when checked, `min-h-touch`, `px-4`): reuse via `className` (`size-12 justify-center px-0`), do not fork.
- `src/client/field/leave-guard.tsx` -- `useLeaveGuard().leave`; provider sits above `GatedApp`.
- `src/client/copy/shared.ts:72` (`nav.avatar`), `src/client/copy/field.ts` -- new `account` section; `copy.nav.tabs.dashboard` stays (also used by `NoTourneeMessage`, `StartScreen`, `LocationDialog`).
- `vite.config.ts`, `vitest.config.ts` -- `define` for the build stamp (vitest projects do not inherit root config: unit + dom need it too).
- Tests to update: `field/tabs.test.ts`, `field/FieldTabs.test.tsx:94`, `App.test.tsx` (~9 assertions find the dashboard as a `link` in the tab bar: 423, 718-849) → find the card button instead. happy-dom 20 has no Popover API: content is always in the DOM in tests; open/close is verified in a real browser.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/version.ts` + `version.test.ts`, `vite.config.ts`, `vitest.config.ts` -- `versionLabel(version, commit)` pure + `BUILD_VERSION` from `__APP_VERSION__`/`__APP_COMMIT__` defines -- AC7, own commit.
- [ ] `src/client/theme.ts` + `theme.test.ts` -- choice helpers; Système clears key and attribute, storage-blocked safe -- AC4.
- [ ] `src/client/field/tabs.ts`, `FieldTabs.tsx`, `tabs.test.ts`, `FieldTabs.test.tsx` -- four tabs for every role -- AC6.
- [ ] `src/client/field/AccountMenu.tsx` + `AccountMenu.test.tsx` -- the card -- AC1-3, AC5.
- [ ] `src/client/App.tsx`, `App.test.tsx` -- mount it, pass role, retarget dashboard assertions -- AC1, AC5.
- [ ] `src/client/copy/field.ts`, `copy/shared.ts` -- strings, avatar name -- AC8.
- [ ] `docs/design.md` -- see Always.

**Acceptance Criteria:**
- Given an agent on `/tournee`, when they tap the avatar, then the card shows email, « Agent », Apparence, version, and no dashboard row.
- Given an online admin with a dirty visit form, when they tap « Tableau de bord », then the leave dialog asks before `/admin`.
- Given any role, when the tab bar renders, then it holds exactly Tournée, Carte, Carnet, Ajouter.
- Given a 390px screen in light and dark, when the card opens, then it matches `account-menu-v4.png` and stays on-screen.

## Design Notes

Positioning is `position: fixed` against the band rather than the avatar, because the avatar is always the band row's last item at the right edge, and CSS anchor positioning needs iOS 26. The popover UA style (`inset: 0; margin: auto`) must be reset (`inset-auto m-0`). The card is not `role="menu"` (no roving focus, holds radios): a labelled popover region (`aria-labelledby` the email).

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm run check:precache` -- all green; quote the precache total vs 1,000 KiB.

**Manual checks:**
- `pnpm dev` at 390px: card opens/closes (outside tap, re-tap, Escape), light and dark screenshots match the mockup; « Version 0.1.0 · dev ».
