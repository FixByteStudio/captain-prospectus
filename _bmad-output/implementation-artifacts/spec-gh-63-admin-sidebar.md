---
title: 'Admin sidebar (GH #63)'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: '0e73aa977e19aca0034072231446d6c7db080fb1'
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

**Problem:** The admin frame still borrows the field band's flat link row (story 1.2's tracer). CAP-1 needs a grouped navy sidebar that works at 1280, 820 and 390 px, marks the current item in gold, and shows how many Doublons and À rattacher are waiting.

**Approach:** Vendor shadcn Sidebar (with Sheet, Tooltip, Separator, Skeleton and `use-mobile`) into `src/client/ui/`, used only from the admin chunk. Rebuild `AdminLayout` as a navy sidebar with the Prospects and Terrain groups: full at ≥ 1024 px, an icon rail from 768 to 1023 px, and a Sheet drawer below 768 px, opened by a menu button in the top-bar slot. The counts come from `useDuplicates` and `useOrphans`, so they share a cache with their screens.

## Boundaries & Constraints

**Always:**
- Groups and order: **Prospects** (Prospects `Store`, Import `CloudUpload`, Doublons `Copy`) and **Terrain** (Visites `MapPin`, À rattacher `Link`, Scripts `FileText`). Group labels use `text-overline uppercase` in `band-muted`. Items are 36 px rows in `band-foreground`, with a `band-accent` hover wash. The current item is a `primary` fill with `primary-foreground` text and a 1 px `primary-edge` inset. The mark and wordmark sit in the sidebar header.
- From the #62 note: item text is `band-foreground` in every state. `band-muted` appears only on the group labels, which never take the hover wash, so the 4.26:1 pair never renders. `palette.test.ts` gains the AA pair `band-foreground` on `band-accent` composited over `band`, in each theme.
- Count badges are `warn` pills with white `tnum` numerals, shown only when the count is > 0. They are hidden while the query is loading or has failed. In the rail, the badge becomes a warn dot on the icon. In every mode, the item's accessible name carries the count.
- The width follows the viewport: ≥ 1024 full (`16rem`), 768–1023 rail (`3rem`) with a Tooltip naming each item, < 768 a Sheet. Choosing an item in the Sheet closes it. The toggle button and Ctrl/⌘+B work, but nothing is persisted: drop shadcn's cookie write.
- Every new French string lives in `copy.ts` (group names, "Ouvrir le menu" / "Réduire le menu", the badge aria text), including the English strings the vendored components ship with (Sheet close, "Toggle Sidebar").
- The shadcn Sidebar, Sheet and Tooltip code ends up only in `AdminApp-*`. The precache total stays ≤ 1,000 KiB, and the PR quotes it.
- `docs/design.md` Layout: replace "No left rail…" with the admin sidebar (groups, widths, gold current item, badges). Leave the field-band sentences as they are.
- Decision (2026-09-24, user): no sidebar footer in this story. The email arrives with the avatar menu (story 1.5), and the admin sync line waits until someone defines it.
- Decision (2026-09-24, user): the admin nav's link to `/tournee` is dropped. Tournée du jour arrives with epic-admin-round-view, and until then an admin opens `/tournee` by URL.

**Never:**
- None of the top bar beyond the menu button: no breadcrumb, search, bell, theme or avatar (story 1.5).
- No Pilotage group, Tableau de bord or Tournée du jour item. No new API route or query. No new npm dependency: `radix-ui` already ships dialog, tooltip, separator and slot.
- No change to the field frame, `Band.tsx`'s field use, or any screen's content.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Queue has items | 3 duplicate pairs, 2 orphans | Doublons shows 3, À rattacher shows 2, the same numbers their screens list | — |
| Healthy queues | 0 pairs, 0 orphans | No badges | — |
| Count loading or failed | query pending or error | No badge and no error in the sidebar; the screen reports its own failure | — |
| Merge on Doublons | a pair is merged | The badge drops by one after the invalidation | — |
| Deep link | open `/admin/a-rattacher` | À rattacher is the gold item | — |
| 820 px | viewport resized | Icon rail, a tooltip on hover or focus, and the current icon gold | — |
| 390 px | menu button, then an item | The drawer opens, navigates, and closes | — |

</frozen-after-approval>

## Code Map

- `src/client/admin/AdminLayout.tsx` -- Rewrite. Today it holds a band header with `BandLink`s, an empty top-bar `<div />`, then `{banner}` and `<main className="safe-bottom px-4 py-6">`. Keep the `banner` prop, and keep this file in the admin chunk (ADR-0019).
- `src/client/admin/queries.ts` -- Reuse `useDuplicates()` (`data.pairs`, staleTime 60 s) and `useOrphans()` (`data.visits`, refetches on focus). `DuplicatesScreen.tsx:41` and `OrphansScreen.tsx:36` count these same arrays.
- `src/client/admin/AdminApp.tsx` -- Routes stay as they are. `QueryClientProvider` already wraps the layout.
- `src/client/Band.tsx` -- `BandBrand` (mark + wordmark) is reusable in the sidebar header. `BandLink` stays for the field band. Update its doc comment, which says the admin nav uses it.
- `src/client/copy.ts:26` -- `copy.nav` already has every item label. Add the group names and the aria strings there.
- `src/client/ui/` -- Vendored shadcn, importing `radix-ui/<part>` and `@/copy` (see `dialog.tsx`). The `@/*` alias maps to `src/client/*`, and `components.json` puts hooks in `@/hooks`.
- `src/client/styles/app.css:92-99, 234-316` -- The band tokens exist in all three theme blocks. Map shadcn's `--color-sidebar*` onto them in `@theme inline` (sidebar = band, accent = band-accent, border = band-border, ring = ring), with no new hex values.
- `src/client/styles/palette.test.ts:245` -- AA pair table; add the composited band-accent pair.
- `vite.config.ts:56` -- `globIgnores: ["**/assets/AdminApp-*"]`. A new shared chunk would be precached, so check `dist/` after the build.
- `docs/design.md:201-209` -- The Layout intro to rewrite.
- `docs/free-tier-budget.md` watch-outs -- Every admin load now runs the duplicate sweep (≤ 5,000 rows read). At 3,000 prospects and about 20 loads a day that is roughly 60 k rows, 1.2 % of the daily limit. Record it there in one line.
- Mockup: `key-a1-dashboard.html` `<aside>` (light 1280 frame) is the visual reference.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/ui/{sidebar,sheet,tooltip,separator,skeleton}.tsx`, `src/client/hooks/use-mobile.ts` -- Vendor the new-york versions. Replace the English strings with `copy.ts` ones, remove the cookie write, set `SIDEBAR_WIDTH_ICON` to 3rem, and make the menu button 36 px.
- [ ] `src/client/admin/nav.ts` + `nav.test.ts` -- A pure list of groups and items (label key, path, icon, optional count source), plus a `badgeCount(n)` helper that returns null for undefined or 0. The test pins the group order and the paths against the six `AdminApp` routes, and covers the count rule.
- [ ] `src/client/admin/AdminSidebar.tsx` -- Render the groups from `nav.ts` with `NavLink` active state, badges and the rail dot. Close the Sheet on navigation when mobile.
- [ ] `src/client/admin/AdminLayout.tsx` -- `SidebarProvider` with `open` following `(min-width: 1024px)`, then the sidebar and `SidebarInset`. The inset holds a 56 px `card` top-bar slot with `SidebarTrigger`, then the banner, then `<main>`.
- [ ] `src/client/styles/app.css`, `palette.test.ts` -- The sidebar token mapping and the AA pair.
- [ ] `src/client/copy.ts`, `src/client/Band.tsx` -- The strings, and the comment.
- [ ] `docs/design.md`, `docs/free-tier-budget.md` -- The Layout rewrite and the watch-out line.

**Acceptance Criteria:**
- Given `pnpm build`, when `dist/assets` is grepped for `data-sidebar` and `SheetContent`, then the only matches are `AdminApp-*` files, and the precache line reads ≤ 1,000 KiB.
- Given `pnpm dev` as admin, at 1280, 820 and 390 px, every one of the six `/admin` routes is reachable from the sidebar, and the current item is gold in light and dark.

## Implementation Notes

- Implemented by a subagent from this spec. Mid-run, the story 6 session switched the shared checkout to its own branch and moved its work into `../captain-prospectus-65`. Story 4's files were checked byte for byte against a snapshot, and the diff holds only story 4.
- `sidebar.tsx` is a trimmed vendoring: no floating, inset or right variants, and `open` is always controlled. `skeleton.tsx` is vendored per the task list but has no caller yet.
- The matrix audit found the 390 and 820 rows failing in the browser, fixed before review. First, `useIsMobile` read `window.innerWidth`, which the table's overflow inflated to 1,004 px at 390, so the drawer never opened; it now reads the media query. Second, `SidebarInset` lacked `min-w-0`, so the page scrolled sideways at 820. Third, the rail header spilled the wordmark; it now clips to the mark. Also fixed: the rail dot now sits on the icon, and the trigger's label follows `openMobile` on a phone.
- The pure count and current-item rules (`queueCount`, `isCurrent`) moved into `nav.ts` so the matrix rows have unit tests. There is no DOM test tooling, and the spec forbids a new dependency, so the width, drawer and merge rows were checked in `pnpm dev`.
- Browser check. At 1280, À rattacher is gold. With a stubbed orphans response, the badge reads 2 and the accessible name "À rattacher (2)". At 820 in dark, the rail is 48 px with no overflow and the current item has a gold fill (#d9b43c) with navy text. At 390, the drawer opens on "Ouvrir le menu", lists the six items, and navigates to Scripts and closes. Both local queues are empty, so neither badge shows.
- Build: precache 14 entries, 617.11 KiB (main 612.81, ceiling 1,000). Entry chunk 145.59 kB gzip. `sidebar-wrapper` appears only in `AdminApp-*`. 582 tests pass.
- After the review patches (triage rows 1–10): typecheck, lint and test are green (583 tests). The build's precache is 14 entries, 617.39 KiB, and the entry chunk 145.61 kB gzip; `sidebar-wrapper` appears only in `AdminApp-*`. Browser checks:
  - At 390 in dark, the drawer shows the Prospects and Terrain overline labels with no hairline, and `aria-expanded` goes from false to true.
  - Back with the drawer open closes it.
  - At 1280, the sidebar stays at top 0 with the page scrolled 2,000 px.
  - The badge's colour class resolves to ink `#141c2e` on dark warn `#d98a3c`.

## Spec Change Log

## Review Triage Log

**Pass 1 (thorough, 4 lenses).** Counts: high 0, medium 4, low 11, false 1, maybe-false 0. Routes: patch 10 entries, defer 1, rejected 12. Intent alignment is descriptive; its divergences appear as rows 19–21.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | blind, edge, verif | `SidebarGroupLabel` shows the rail hairline in the phone drawer | medium | patch | `state` is always collapsed below 1024 and the label never checks `isMobile`. Now guarded with `!isMobile` |
| 2 | blind, verif | Badge `text-white` on dark `warn` is 2.74:1, and the colour is hardcoded | medium | patch | Computed 2.74:1 on `#d98a3c`. Now `text-destructive-foreground` (`on-destructive`): white in light as the frozen text says, ink in dark (6.19:1), per DESIGN.md's text-on-warn rule. Flagged to the user |
| 3 | blind, edge, verif | The desktop sidebar scrolls away on long pages | medium | patch | `h-svh` in a `min-h-svh` flex row with no sticky position. Now `sticky top-0` |
| 4 | edge | The drawer stays open after browser or Android Back | medium | patch | It closed only on the item's `onClick`. Now it closes on pathname change |
| 5 | blind, verif | The nav test claims to pin AdminApp's routes but compares against a hand copy | low | patch | Direct correction of the comment and test description |
| 6 | verif | The `--color-sidebar*` aliases are untested; drifting to `band-muted` would pass | low | patch | Alias assertions added to `palette.test.ts` |
| 7 | blind | The trigger has no `aria-expanded`; the drawer description reuses "Ouvrir le menu" | low | patch | Screen-reader users meet it on every visit. `aria-expanded` added, plus `copy.nav.drawerDescription` |
| 8 | edge | A fractional width between 767 and 768 matches neither the mobile query nor `md:` | low | patch | Direct correction: `(width < 768px)` |
| 9 | edge | Ctrl+B misses Caps Lock | low | patch | Direct correction: `toLowerCase()` |
| 10 | blind | The budget line ignores `useOrphans` refetching on focus from every admin page | low | patch | `refetchOnWindowFocus: true` with no staleTime, and it scans prospects when the queue is non-empty. Doc line extended |
| 11 | blind, verif, intent | No test covers the rendered sidebar (widths, drawer, tooltip, dot) | low | defer | Pre-existing: the unit project runs in `node` with no DOM harness, and the spec forbids a new dependency. The browser checks are recorded in the Implementation Notes. deferred-work entry |
| 12 | blind | `useDesktopOpen` has no `typeof window` guard | false | reject | `AdminLayout` renders only in the browser SPA, and nothing server-renders it |
| 13 | blind | The `/tournee` link is dropped without a note | low | reject | The user's decision (2026-09-24), recorded in the frozen block |
| 14 | blind, intent | `skeleton.tsx` is vendored with no caller | low | reject | The intent lists Skeleton explicitly |
| 15 | blind | `text-[11px]` is a hardcoded size | low | reject | Cosmetic, with no type token at 11px, and the badge size is DESIGN.md's "small pill" |
| 16 | blind | The sidebar header and Sheet lack `safe-top`; the design.md safe-area paragraph mentions only the band | low | reject | This only shows for an admin in an installed PWA held in landscape, and the fix is more than a direct correction |
| 17 | edge | Ctrl+B inside an input toggles the sidebar | low | reject | Upstream shadcn behaviour, with no demonstrated harm in plain inputs; a guard adds branches |
| 18 | edge | A drawer left open reopens after rotating past 768 and back | low | reject | It needs a rotation with the drawer open, and the fix adds an effect |
| 19 | edge, intent | The À rattacher badge ignores `remaining`, and Doublons ignores `truncated` | low | reject | The frozen matrix says the badge equals what the screen lists. The screens' own count lines use the same lengths |
| 20 | edge | Mixed-case paths get no gold item | low | reject | Unlikely, and nothing links to one |
| 21 | intent | A full-vs-rail toggle and shortcut at ≥ 768 go beyond the intent | low | reject | The spec's Always list asks for both, and neither conflicts with the intent |
| 22 | verif | The full/rail/drawer rule has no unit test | low | reject | Covered by rows 1 and 11. A mode helper would add public surface the fix does not need |

## Design Notes

Why `open` follows a media query, not a cookie: the three widths are a layout rule, not a preference. shadcn's `useIsMobile` (< 768) picks the Sheet, and `(min-width: 1024px)` sets `open` for full versus rail. A manual toggle overrides that until the query next changes. Story 1.5 can add persistence if the top bar wants it.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: green.
- `pnpm build` -- expected: success. Quote the precache line and the entry chunk, then `grep -l data-sidebar dist/assets/*` should list `AdminApp-*` only.

**Manual checks:**
- In `pnpm dev` (with the local seed), check each width in light and dark. Compare the badge numbers against the count lines on Doublons and À rattacher.
