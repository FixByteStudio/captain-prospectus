---
type: story
title: "The field avatar opens an account card: theme, version, and the dashboard for an admin"
risk: low
---

# The field avatar opens an account card: theme, version, and the dashboard for an admin

## Description

Tapping the band avatar on the field route opens a small card anchored under it. The card shows the signed-in email and role, an « Apparence » choice (Système / Clair / Sombre) and the running build's version. An online admin also gets a « Tableau de bord » button there, and the dashboard leaves the tab bar, which becomes the same four tabs for every role. This reverses the 2026-09-24 decision that the field avatar has no menu (`spec-gh-65:35`). It adds no agent logout: signing back in would need a fresh code from an admin, and the admin's « Révoquer » already ends a device's session.

Mockup: `_bmad-output/forge/agent-logout-and-settings/mockups/account-menu-v4.png` (agent in light on the left, admin in dark on the right).

## Acceptance Criteria

- AC1: Tapping the avatar (`App.tsx`, now a button) opens the card; tapping outside, tapping the avatar again or pressing Escape closes it. It is a native `popover` card styled like a shadcn menu (no Radix DropdownMenu), anchored under the avatar and growing left, never off-screen.
- AC2: The card shows, in order: the email (12px, never truncated; the card widens from 208px up to the screen width minus 24px, and a longer email wraps before the « @ »), the role (« Agent » / « Administrateur »), then for an online admin a « Tableau de bord » button, then « Apparence », then the version line. The initials disc is not repeated.
- AC3: « Apparence » is three native radios (the `FieldRadioOption` tile, gold when checked) shown as 16px icons inside 48px tiles (monitor / sun / moon), each with an accessible name Système / Clair / Sombre. With no stored choice, Système is checked.
- AC4: A choice applies at once with no reload. Clair or Sombre pins it the way the admin toggle does (`pinTheme`); Système clears the stored choice and `data-theme`, so the page follows the phone again. `index.html`'s boot script still reads the result correctly on the next load.
- AC5: « Tableau de bord » shows only when `adminAccess(...).entry` is true (the same check the tab used), and runs through `useLeaveGuard().leave`, so a dirty visit or prospect form asks before navigating.
- AC6: `fieldTabs()` returns Tournée, Carte, Carnet, Ajouter for every role; the dashboard tab is gone.
- AC7: The version line reads « Version 0.1.0 · a605114 »: `package.json`'s version plus the deploy commit's 7-character SHA, written in at build time (Vite `define`, `GITHUB_SHA` in CI). A build with no SHA (`pnpm dev`, a local build) reads « Version 0.1.0 · dev ». This lands in its own commit.
- AC8: Every new string lives in `copy/field` (or `copy/shared` beside `nav.avatar`); the avatar's accessible name says it opens the account menu.
- Verify: tests cover AC3, AC4 (`theme.test.ts`: Système clears the pin), AC5 (leave guard on a dirty form, hidden when offline or agent) and AC6 (`tabs.test.ts`); `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm run check:precache` are green, and the PR quotes the precache total against its 1,000 KiB ceiling.

## References

- Forge session — `_bmad-output/forge/agent-logout-and-settings/` (memlog, mockups)
- `docs/design.md:158-165` (theme pin), `docs/design.md` Layout (field band, tab bar)
- `docs/domains/identity-access.md` (why there is no agent logout: one-time codes, « Révoquer »)
- ADR-0015 (native radios on the field route), ADR-0026 (precache budget)
- `src/client/App.tsx:237`, `src/client/field/tabs.ts`, `src/client/theme.ts`, `src/client/field/leave-guard.tsx`, `src/client/ui/field-controls.tsx`

## Notes

- Docs in the same change: `docs/design.md` (the field avatar opens the card; the tab bar is four tabs; Système exists on the field side), and the comment at `App.tsx:237` and in `copy/shared.ts:72`, which both say the avatar has no menu.
- No data, sync or auth change: no ADR, no `CLIENT_VERSION` bump.
- Out of scope: an agent logout; any card item beyond these; a « Système » choice on the admin Sun/Moon toggle (the admin keeps its two-state toggle and reads the same `cap-theme` pin).
- The card holds only these items. A future one needs its own reason (Sally's rule).
- `popover` needs iOS 17+ or a recent Chrome. Check Léa's and François's iOS versions before release (Réglages › Général › Informations).
