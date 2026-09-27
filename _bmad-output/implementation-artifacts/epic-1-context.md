# Epic 1 Context: Admin and field share the new shell and tokens

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give each side of the app its new frame, and give the whole app one token set for every later screen. The admin side gets a grouped navy sidebar and a white top bar inside the lazy admin chunk; the field side gets the navy band with its sync dot, the sync strip and the tabs. Today's screens keep rendering unchanged inside the new frames, so later epics only swap screen content inside a working frame.

## Stories

- Story 1.1: Owner accepts ADR-0026
- Story 1.2: Split the shell by side
- Story 1.3: DESIGN.md tokens and palette rules
- Story 1.4: Admin sidebar
- Story 1.5: Admin top bar
- Story 1.6: Field band and sync strip
- Story 1.7: Field tabs
- Story 1.8: Refactor sweep

## Requirements & Constraints

- Every existing route renders in its side's frame: `/admin/*` in sidebar + top bar, `/tournee/*` in band + tabs. The `/` redirect keeps working for admin and agent; existing tests pass.
- Nav items appear only with the epic that ships their screen; nothing links to a screen that does not exist. This epic: sidebar groups Prospects (Prospects, Import, Doublons) and Terrain (Visites, À rattacher, Scripts). Field tabs: Tournée and Ajouter, plus Tableau de bord for an online admin. Tableau de bord, Tournée du jour and Carte items arrive with later epics.
- Admin sidebar at 1280 / 820 / 390 px: full (≥ 1024), icon rail (768–1023), Sheet drawer behind a menu button (< 768). Current item gold. Doublons and À rattacher counts come from the existing queries and must equal what their screens list.
- Top bar: sidebar toggle, breadcrumb ("Captain Prospectus › {group} › {page}"), search button, notifications bell (disabled; no content), theme toggle (persists across reload), avatar menu with the email and "Se déconnecter" going to `/cdn-cgi/access/logout`. ⌘K / Ctrl+K opens a shadcn Command palette that makes no request; search has no back end.
- Field sync: 7 states (synced, waiting to send, syncing, offline, failed, session expired, update needed) match `key-f8-sync.html` in light and dark, and none of them is ever a toast. Only "Se reconnecter" (reloads the current page so Access re-authenticates; outbox untouched) and "Mettre à jour" carry a button. The strip is `aria-live="polite"`; session expired and update needed are `assertive`. The update banner and the not-found and offline sign-in states are restyled too.
- Tabs sit at the bottom on a phone and move into the band from 768 px.
- Every French string goes in `src/client/copy.ts`, using the approved shell strings in EXPERIENCE.md › Voice and Tone. Every icon-only button has an aria-label from `copy.ts`.
- `docs/design.md` Grounding, Colour, Type, Layout, shell and sync sections are rewritten to match what ships. Keep its sections the redesign does not cover: map import provider and circle rules, "Working with shadcn in this repo", Icons.

## Technical Decisions

- **Tokens:** `app.css` `@theme` must hold every DESIGN.md token in light and dark, including the new `band-accent` (8 % / 6 % white), `band-border` (12 % / 8 % white), `outcome-no-contact`, `outcome-interested`, `outcome-not-interested`, badge tints (≤ 12 % into card), the `overline` type role (uppercase through CSS, sentence case in `copy.ts`) and the named spacing tokens. DESIGN.md wins over `app.css` and over `docs/design.md`; no component hardcodes a colour or spacing.
- **Palette rules** that `palette.test.ts` asserts for both themes: (1) gold is never text on a light surface; (2) text on gold is navy, never white; (3) the focus ring is ink, never gold; (4) every gold fill carries `primary-edge`; (5) status and outcome badge text on its tint reaches 4.5:1. Gold text on the navy band is allowed.
- **Chunks:** the admin chunk stays online-only and out of the precache. The Workbox glob ignores `**/assets/AdminApp-*`, so shadcn Sidebar, Sheet, Tooltip and Command/`cmdk` must stay inside the admin chunk. Any other chunk, including one shared with the field, is precached.
- **Field budget:** the precache total on `pnpm build`'s Workbox line must stay at or under 1,000 KiB. The entry chunk has no cap but is still measured. Every field PR quotes both figures. The field keeps the native date input, radios, checkboxes and labels. Everything else is shadcn.
- **Dependencies:** `cmdk` (for shadcn Command) is allowed, in the admin chunk only. Its PR states the size and maintenance. No other new dependency. Icons are Lucide.
- **Theme (assumption):** stored in `localStorage` and applied to `<html data-theme>` before first paint. The field side follows the same pin.

## UX & Interaction Patterns

- Sidebar: navy `band` fill, overline group labels in `band-muted`, 36px items with icon and label, `band-accent` hover, current item as a gold fill with navy text. Count badges are `warn` pills with white numerals. Footer holds the signed-in email and a sync line.
- Top bar: 56px, `card` background, 1px bottom border. Admin content has no max-width.
- Field band: 56px plus safe-area-top. It holds the mark, the "Captain Prospectus" wordmark, a meta subtitle naming the tab, the sync dot and count, and the avatar. The dot is success when synced, warn with a count when items wait, pulsing `band-muted` while syncing, and destructive when the session has expired.
- Sync strip: 32px, meta type. Waiting and syncing use the band one step darker. Offline and failed use `secondary`. Session expired uses `destructive` with `on-destructive` text. Update needed uses `warn` with `on-destructive` text. Both button states use an outlined button in the text colour.
- Tab bar: 64px plus safe-area-bottom, `card` background with a top border. Each tab has a 24px Lucide icon over a meta label (`Route`, `Map`, `MapPinPlus`, `LayoutGrid`). The current tab has a gold pill behind the icon and a navy label. Ajouter is a normal tab, not a raised button.
- Mockups (in the UX run folder): `key-a1-dashboard.html` (admin shell at 3 widths), `key-f1-tournee.html` (field shell), `key-f8-sync.html` (sync states).

## Cross-Story Dependencies

- 1.2 (tracer) and 1.3 have no prerequisites. 1.4 and 1.6 need both of them. 1.5 needs 1.4. 1.7 needs 1.1 and 1.6. 1.8 closes the epic after all others.
- 1.1 is a human gate: PR #57 must be merged and ADR-0026 marked accepted before the field tabs add to the entry chunk.
- 1.5's open question is settled (2026-09-24): while search is inert, the open palette says "La recherche n'est pas encore disponible. Utilisez les filtres de la page Prospects." (in `copy.ts`).
