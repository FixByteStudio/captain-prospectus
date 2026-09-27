---
title: 'Split the shell by side (GH #61)'
type: 'refactor'
created: '2026-09-24'
status: 'done'
baseline_commit: 'f43d57462e0e625bb2bb5215fcc7504a989ea006'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context:
  - '{project-root}/docs/adr/0019-admin-chunk-out-of-the-precache.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** One header in `App.tsx` frames both sides: the navy band carries the field's sync dot and every admin link. Epic 1 needs a separate admin frame (sidebar and top bar, stories 4–5) and a field-only band (stories 6–7). Neither can be built while the two share one header.

**Approach:** This is the tracer. The admin chunk owns an `AdminLayout` with a nav region holding today's links and an empty top-bar region. `App.tsx`'s header becomes the field-only band. Every existing screen renders unchanged inside its side's frame. Visuals stay as today: the admin nav reuses the band look until story 4 replaces it.

## Boundaries & Constraints

**Always:**
- `AdminLayout` is imported only from `AdminApp`, so it ships in the lazy `AdminApp-*` chunk (ADR-0019).
- `SyncProvider` stays at the root, so outbox sync keeps running while an admin is on an admin screen.
- The field band keeps the mark, the wordmark, the "Tournée du jour" link and `SyncDot`. For an admin online, it also keeps one link into the admin side: "Prospects" → `/admin/prospects`, using the existing copy. Story 7's Tableau de bord tab replaces it.
- The admin nav holds today's links in today's order: Tournée du jour (`/tournee`), Prospects, Import, Doublons, À rattacher, Visites, Scripts.
- `UpdatePrompt` shows in both frames, under the band or the nav.
- Every French string comes from `copy.ts`. No new strings are needed.
- Styling uses existing tokens only.

**Never:**
- No sidebar, top-bar content, tabs, new tokens or restyling. Those are stories 3–7.
- No change to any screen component, the `/` redirect, identity resolution, sync, or the service-worker registration.
- Nothing new in the entry chunk beyond moving code that is already there.
- Admin screens show no `SyncDot` or `SyncStrip`. Both are field chrome (EXPERIENCE.md › IA).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin on an admin route | admin, online, `/admin/prospects` | Admin frame: brand, the 7 admin-nav links, an empty top-bar region, then ProspectsScreen. No sync dot or strip | No error expected |
| Admin in the field | admin, online, `/tournee` | Field band: brand, Tournée du jour, Prospects and the sync dot; the strip below; then TodayScreen | No error expected |
| Agent | agent, `/tournee`, `/tournee/:id`, `/tournee/nouveau` | Field band: brand, Tournée du jour and the sync dot. Screens unchanged | No error expected |
| Admin offline | cached identity, role admin | Treated as an agent (`isAdmin` false), so the field frame shows no Prospects link | No error expected |
| Non-admin on `/admin/*` | agent, or admin offline | Field frame with `copy.errors.forbidden`. The admin chunk is not fetched | — |
| Unknown path | `/nope` | Field frame with `copy.errors.notFound` | — |
| Root | `/` | Redirects to `/admin/prospects` for an online admin, `/tournee` otherwise, as today | — |
| Update waiting | `needRefresh` true | The prompt appears in whichever frame is showing, and its buttons work | — |
| Identity loading or failed | `/api/me` pending or erroring | Unchanged: bare `main`, no frame | Unchanged |

</frozen-after-approval>

## Code Map

- `src/client/App.tsx` -- Today's shared header (lines 203–221), `BandLink` (50–66), `UpdatePrompt` (78–102), `FieldRoutes` (105–129), and the `Routes` in `App` (227–249). Identity effect and `isAdmin` (131–199): do not touch.
- `src/client/admin/AdminApp.tsx` -- Lazy admin root: `QueryClientProvider`, the six admin `Route`s, and the `Toaster`. Keep the ADR-0013 and ADR-0019 comment.
- `src/client/field/SyncIndicator.tsx` -- `SyncDot` and `SyncStrip`. Reuse them unchanged.
- `src/client/copy.ts:26-34` -- `copy.nav.*`, plus `copy.appName`, `copy.update.*` and `copy.errors.forbidden/notFound`. Reuse; add nothing.
- `src/client/pwa.ts` -- `usePwa` and `PwaState`. The hook stays in `App`, where it registers on mount (see the `UpdatePrompt` comment).
- `vite.config.ts` -- Workbox `globIgnores` for `AdminApp-*`. Don't change it; confirm the new layout lands in that chunk.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/Band.tsx` -- New. Move `BandLink` here, add `BandBrand` (mark plus wordmark, today's markup), and move `UpdatePrompt` here with its comment. -- Both frames use these. They stay in the entry chunk, so the admin chunk imports them and duplicates nothing.
- [ ] `src/client/admin/AdminLayout.tsx` -- New. `AdminLayout({ banner, children })`:
  - A `nav` band with `BandBrand` and the 7 `BandLink`s. Reuse the band classes, `safe-top`, and the horizontal scroll.
  - An empty top-bar `<header>` region. It renders nothing visible yet and gets a comment naming stories 4–5.
  - Then `banner` and a `main` with `safe-bottom px-4 py-6`.
  -- This is the admin frame that story 4 turns into the sidebar.
- [ ] `src/client/admin/AdminApp.tsx` -- Take an `updatePrompt: ReactNode` prop and wrap the `Routes` in `AdminLayout`, with `banner={updatePrompt}`. -- The prompt's hook lives in the entry chunk.
- [ ] `src/client/App.tsx` -- Add a `FieldFrame` layout route: the band (`BandBrand`, Tournée du jour, the admin's Prospects link, `SyncDot`), then `UpdatePrompt`, `SyncStrip`, and a `main` holding `<Outlet />`.
  - Route `/tournee/*`, `*`, and the non-admin `/admin/*` case through it.
  - Render the online admin's `/admin/*` as `<AdminApp updatePrompt={<UpdatePrompt pwa={pwa} />} />` inside `Suspense`, outside `FieldFrame`.
  - Update the band's nav comment.
  -- This is the field-only band.

**Acceptance Criteria:**
- Given an online admin, when they click every admin-nav link, then each screen renders its current content in the admin frame, and "Tournée du jour" opens the field frame.
- Given a production build, when the chunks are listed, then `AdminLayout` code appears only in `AdminApp-*.js`, and the precache stays within a few KiB of 609.58 KiB.
- Given `pnpm test`, when it runs, then every existing test passes unchanged.

## Implementation Notes

- Files: new `src/client/Band.tsx` (`BandLink`, `BandBrand`, `UpdatePrompt`) and `src/client/admin/AdminLayout.tsx`; `AdminApp.tsx` takes `updatePrompt`; `App.tsx` gains the `FieldFrame` layout route.
- Build: entry chunk 145.50 kB gzip (main 145.33), precache 14 entries 609.77 KiB (main 609.58), ceiling 1,000 KiB. `/admin/import` appears only in `AdminApp-*.js`.
- Matrix audit: the repo has no component-test harness (the unit project is `environment: node`, `*.test.ts` only, no DOM library). Adding one is a new dependency and out of scope, so the rows were verified in `pnpm dev` in the browser pane, per the Manual checks:
  - Admin (`DEV_USER_EMAIL` admin, port 5173): `/` → `/admin/prospects`; the six admin routes render in the admin frame with the 7 links and no sync dot; `/tournee`, `/tournee/:id` (a stop on the round), `/tournee/nouveau` and `/nope` render in the field band with Tournée du jour + Prospects and the dot.
  - Agent (a temporary `.dev.vars.agent` with the example's fake emails and `CLOUDFLARE_ENV=agent`, port 5174, deleted afterwards): `/` → `/tournee`; the field routes show only Tournée du jour and the dot; `/admin/prospects` and `/admin/visites` show `copy.errors.forbidden` in the field frame; `/nope` shows not-found; no `AdminApp` request in the resource timings.
  - Admin offline: not forced. It takes the same `isAdmin === false` branch as the agent rows.
  - Update waiting: not forced, because `needRefresh` never fires in dev. Both frames receive the same `<UpdatePrompt pwa={pwa} />` element.
- After review patches (triage #1–5): typecheck, lint and test are green (504 tests). The build's entry chunk is 145.53 kB gzip, the precache is 14 entries at 610.03 KiB, and `/admin/import` appears only in `AdminApp-*.js`. The admin route walk in `pnpm dev` was re-run and passes. The agent side's only change is `/` moving out of `FieldFrame` with the same `Navigate` target, so it was not re-walked.

## Spec Change Log

## Review Triage Log

**Pass 1 (thorough, 4 lenses).** Counts: high 0, medium 2, low 4, false 5, maybe-false 0. Routes: patch 5, defer 3, rejected 5.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | blind, edge, verif | The admin Suspense fallback has no frame, so the page is blank while the chunk loads | medium | patch | `App.tsx` fallback is a bare `<p>`. Before, the band stayed rendered around `main`. The chunk isn't precached (ADR-0019), so every cold visit shows it. Fallback now draws the band with `BandBrand` |
| 2 | blind | `docs/design.md` Layout says "one shell serves both the admin and the field side rather than two" | medium | patch | `docs/design.md:124-126` contradicts the split, and CLAUDE.md's definition of done asks for docs in the same change. That sentence is rewritten |
| 3 | blind, edge | An admin at `/` sees the field band for one commit before `Navigate` | low | patch | The `/` route sits inside the `FieldFrame` layout route, and `Navigate` fires in an effect. Moved outside |
| 4 | blind, verif | `AdminLayout` has the brand inside `<nav>` and an empty top-level `<header />` (an empty banner landmark) | low | patch | Confirmed at `AdminLayout.tsx`. Now `header > nav`, like the field band, and the slot is a plain `div` (a Tasks-level deviation from "`<header>` region", noted here) |
| 5 | blind | Comments give the wrong reason: "lazy chunk never loads under the field band (ADR-0019)", and props vs context "so the admin chunk never depends on field state" | low | patch | `lazy()` loads where the route renders, ADR-0019 covers the precache glob, and the admin chunk never imports `FieldFrame`. Comments rewritten and ticket references dropped |
| 6 | blind, edge | `/admin` and `/admin/unknown` show the admin frame with an empty `main` | low | defer | Pre-existing: before this change, `AdminApp`'s `Routes` also matched nothing and `main` was empty. The index route comes with epic 2 |
| 7 | verif, blind | No automated test covers which frame and redirect each route and role gets | medium (gap) | defer | Pre-verified by the lens. There's no DOM harness (vitest `environment: node`, `*.test.ts` only), and adding one is a new dependency. Walked by hand in `pnpm dev` (Implementation Notes) |
| 8 | verif | Nothing checks after the build that `AdminLayout` stays out of the entry chunk and the precache stays under the ceiling | medium (gap) | defer | Pre-verified by the lens. The gap predates this change: CI builds but asserts no chunk contents. ADR-0026 already names the CI check as follow-up work |
| 9 | blind, edge | The admin frame drops `SyncDot` and `SyncStrip`, so an admin on `/admin/*` loses sight of the outbox | false | reject | The intent excludes it: the frozen Never says "Admin screens show no `SyncDot` or `SyncStrip`". Flagged to the human in the summary |
| 10 | edge | Claim: "visuals stay as today", yet the admin chrome changed | false | reject | Same root as #9. The approved boundaries define what changes in the chrome, and the screens inside `main` are unchanged |
| 11 | blind | The `UpdatePrompt` docblock doesn't say the prompt renders in two frames | false | reject | The docblock ("`App` holds the hook; this only draws the prompt") is still accurate, and where it renders is visible at both call sites |
| 12 | intent | R1 (keep the pixels) diverges: the admin loses 5 field-band links and the sync dot | false | reject | The frozen Always and Never settle it for R2: the field band keeps Tournée du jour plus Prospects, and admin screens have no sync chrome |
| 13 | intent | R3: the nav and top-bar regions are stacked, not a sidebar layout | false | reject | The intent says "Visuals stay as today" until story 4. The regions exist for the sidebar and top-bar stories to fill |

## Design Notes

A layout route (`<Route element={<FieldFrame …/>}>` with nested routes) keeps one `Routes` tree. The admin branch sits beside it, not inside it, so the lazy chunk never loads under the field band.

`FieldFrame` needs `isAdmin` and `pwa`. Pass them as props from `App`. They must not become context, because the admin chunk would then depend on field state.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: all green.
- `pnpm build` -- expected: success. Record the field entry chunk (gzip) and the Workbox `precache N entries (X KiB)` line for the PR. The baseline on main is 145.33 kB and 609.58 KiB, and the ceiling is 1,000 KiB (ADR-0026). Then grep the build's `assets/*.js` for a string only `AdminLayout` carries: it matches only `AdminApp-*`.

**Manual checks:**
- In `pnpm dev`, with `DEV_USER_EMAIL` set to an admin, then to an agent, walk every row of the I/O matrix, including the update prompt, forced from the devtools or skipped with a note.
