---
title: 'Field tabs (GH #66)'
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
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-f1-tournee.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The field shell has a band and a sync strip but no tabs: `/tournee/nouveau` is reachable only from a button on the round, and an admin reaches their own side through a text link squeezed into the band. The redesign's field navigation (DESIGN.md › Tab bar) is missing.

**Approach:** Add the tab bar the mockup draws — Tournée and Ajouter, plus Tableau de bord for an admin who is online — at the bottom on a phone and in the band from 768 px, with Lucide icons and the gold current-tab pill. Because a tab tap unmounts an open visit or add-prospect form, the tabs must not silently discard what the agent typed (#74). Rewrite the field layout part of `docs/design.md` to match.

## Boundaries & Constraints

**Always:**
- Tab list, current-tab and visibility decisions live in a pure module with a test, like `src/client/admin/nav.ts` + `nav.test.ts`. This repo has no DOM test harness, so anything only reachable through JSX is untested.
- "Admin and online" reuses the existing `isAdmin` in `App.tsx` (`me.role === "admin" && !offline`); do not add a second online signal.
- Every French string goes in `src/client/copy.ts`; every icon-only target carries an aria-label from `copy.ts`. Tab targets are at least `{spacing.touch}` (48 px).
- Tokens only, from `app.css` — `--spacing-tab-bar-height` (already declared, unused), `.safe-bottom`, `card`, `border`, `primary`, `primary-edge`, `muted-foreground`, and the `band-*` set at ≥ 768 px.
- The precache total stays at or under 1,000 KiB. The PR quotes it and the entry chunk against the 629.34 KiB / 149.43 kB gzip baseline.

**Decisions (owner, 2026-09-24):**
- The admin tab is labelled "Tableau de bord" and targets `/admin/prospects`. DESIGN.md and the mockup name it, and epic-dashboard retargets it when that screen ships; nothing links to a screen that does not exist.
- A tab tapped while a field form has unsaved input opens a shadcn AlertDialog — "Quitter sans enregistrer ?" — and leaves only on confirmation. This vendors `alert-dialog` into `src/client/ui/` and puts `radix-ui/alert-dialog` in the precached entry chunk for the first time; the PR quotes that cost. #74 stays open for the two sync-strip buttons.

**Never:**
- No Carte tab (epic-field-screens ships that screen) and no fourth tab for a non-admin.
- Do not migrate to `createBrowserRouter`. `useBlocker` needs a data router and `main.tsx` uses `<BrowserRouter>`; the guard is built on the tab's own click.
- Do not change sync, the outbox, the band's dot or strip, or any screen's content.
- Do not fix #58, #75 or #76 here.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Agent, round | `isAdmin: false`, `/tournee` | Two tabs; Tournée current | No error expected |
| Agent, add | `isAdmin: false`, `/tournee/nouveau` | Ajouter current, Tournée not | No error expected |
| Visit open | `/tournee/abc123` | Two tabs, neither current | No error expected |
| Nested add route | `/tournee/nouveau/` or deeper | Ajouter still current | No error expected |
| Admin online | `isAdmin: true`, `/tournee` | Three tabs; Tableau de bord last, not current | No error expected |
| Admin offline (cached identity) | `isAdmin: false`, `/tournee` | Two tabs — the admin tab is hidden, not disabled | No error expected |
| Tab tapped, form untouched | dirty `false` | Navigates straight away | No error expected |
| Tab tapped, form dirty, confirmed | dirty `true`, "Quitter" | Navigates; the draft is gone, knowingly | No error expected |
| Tab tapped, form dirty, cancelled | dirty `true`, "Annuler" | Stays on the form, every value intact, focus back on the form | No error expected |
| Form saved, then redirected | `navigate("/tournee")` after save | No dialog — the form is no longer dirty | Never block a save |
| Tab tapped, already current | `/tournee` → Tournée | No navigation, no guard | No error expected |

</frozen-after-approval>

## Code Map

- Work only in the checkout `/home/m0/PROJECTs/captain-prospectus-66` (branch `feat/66-field-tabs`, dependencies installed, baseline build measured). Never touch `/home/m0/PROJECTs/captain-prospectus` or the other `captain-prospectus-*` worktrees — concurrent story sessions own them. Every `src/`, `docs/` and config path below is relative to that checkout; this spec and its `context:` files live under `/home/m0/PROJECTs/captain-prospectus/_bmad-output/` and are read-only.
- `src/client/App.tsx:98-148` -- `FieldFrame({ isAdmin, pwa, email })`. The band `<header className="safe-top …">` (115) holds `BandBrand` plus a `<nav>` (123-126) whose two `BandLink`s (`/tournee`, admin-only `/admin/prospects`) the tabs replace. `<main className="safe-bottom px-4 py-6">` (143-145): `safe-bottom` moves to the bar, and `main` needs bottom padding so the bar never covers content. Subtitle: `useMatch` (101-107).
- `src/client/App.tsx:297` -- `isAdmin = me.role === "admin" && !offline`, the one admin-and-online signal. `FieldRoutes` 64-88 (`index`, `nouveau`, `:id`). Forbidden (313-324) and not-found (325-334) render inside `FieldFrame` and so get tabs; the identity-error screen (279-292) and `AdminFrameFallback` (185-198) are separate and get none.
- `src/client/admin/nav.ts` -- the pattern to mirror: `NavItem` with a Lucide `ComponentType`, `isCurrent(pathname, path)` (:65), tested in `nav.test.ts` against a hand-copied route list.
- `src/client/Band.tsx:12` -- `BandLink({ to, children: string })`: `children` is a `string`, so an icon tab cannot reuse it, and it goes dead once the band nav is replaced.
- `src/client/field/VisitScreen.tsx:117` and `src/client/field/AddProspectScreen.tsx:59` -- `useForm(...)`; `formState.isDirty` is the dirty signal. Both navigate to `/tournee` on save (250 / 97), which must not trigger the guard.
- `src/client/copy.ts:26-39` -- `nav` group and `nav.subtitle.{today,add}` ("Tournée", "Ajouter"). No "Tableau de bord" string exists yet.
- `src/client/styles/app.css:211` -- `--spacing-tab-bar-height: 4rem`, declared for this story and still unused. `.safe-bottom` :362.
- `src/client/styles/palette.test.ts` -- `DESIGN_COLOURS` :176-208 (token names, no `--`); AA pairs :247-260, row shape `["label", "--fg", "--bg"]`; 3:1 control pairs :265-272.
- `docs/design.md:202-221` (Layout) and `:662-675` (The field side) -- where the bar and the ≥ 768 px move belong. Keep "Working with shadcn in this repo" (:606) and "Native controls here" (:928).
- Mockup `key-f1-tournee.html` -- tab bar: 64 px + safe area, `card` fill, 1 px top border, four equal slots, 24 px icon in a 52×30 pill (`primary` fill, `primary-edge` inset, `primary-foreground` icon) over a meta label (`foreground`, weight 600 when current; `muted-foreground` otherwise). Icons: `Route`, `MapPinPlus`, `LayoutGrid`.
- `vite.config.ts` -- no `manualChunks`; anything `App.tsx` imports statically lands in the precached entry chunk. `radix-ui` reaches the bundle today only through admin screens.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/field/tabs.ts` + `tabs.test.ts` -- pure `fieldTabs({ isAdmin })` returning the ordered tabs (path, label key, icon, aria-label) and `isCurrentTab(pathname, path)` with `/tournee` matching only itself while `/tournee/nouveau` matches its subtree. Cover every matrix row.
- [ ] `src/client/field/FieldTabs.tsx` -- draw the bar from `fieldTabs`: `<nav>` with the tab-bar tokens, fixed at the bottom below 768 px with `.safe-bottom`, and inline in the band from 768 px on the band palette. Each tab is a `NavLink` at least 48 px tall; the current one carries the gold pill and `aria-current="page"`.
- [ ] `src/client/field/leave-guard.ts(x)` + test -- a context the open form registers its dirty state with, and a pure `shouldAsk({ dirty, to, current })` covering the three dirty-form rows. Saving navigates after the form is no longer dirty, so a save never asks.
- [ ] `src/client/ui/alert-dialog.tsx` -- vendor shadcn AlertDialog; translate the strings it ships with into `copy.ts` French (ADR-0014). Used only by the leave guard.
- [ ] `src/client/field/VisitScreen.tsx`, `src/client/field/AddProspectScreen.tsx` -- register `formState.isDirty` with the guard; no other change.
- [ ] `src/client/App.tsx` -- render `FieldTabs` in `FieldFrame`, drop the band's two `BandLink`s, move `safe-bottom` to the bar and give `main` bottom padding for it.
- [ ] `src/client/Band.tsx` -- remove `BandLink` if nothing imports it any more.
- [ ] `src/client/copy.ts` -- the tab labels and aria-labels, plus any string the guard needs.
- [ ] `src/client/styles/app.css`, `palette.test.ts` -- only if a token is missing; add the AA pair for the tab label on `card` and the 3:1 pair for the current pill.
- [ ] `docs/design.md` -- rewrite the field layout part: the tab bar, its four possible slots and which two or three ship now, the ≥ 768 px move into the band, and what happens to an unsaved draft.

**Acceptance Criteria:**
- Given `pnpm dev` at 390 px and at 820 px, when the field shell renders, then the tabs match `key-f1-tournee.html` in light and dark — at the bottom below 768 px, in the band above — and tapping them reaches `/tournee` and `/tournee/nouveau`.
- Given an admin who is online, then Tableau de bord is the last tab; given the same admin offline (cached identity), then it is absent.
- Given `pnpm build`, then the precache total is at or under 1,000 KiB, and the PR quotes it and the entry chunk against 629.34 KiB / 149.43 kB gzip.

## Implementation Notes

- Spec kept at full length by the owner's choice (~2,430 tokens against the 900–1,600 guideline): the Code Map and matrix are what stop the implementation agent re-searching.

- Implemented by a subagent in `/home/m0/PROJECTs/captain-prospectus-66`. Files: `field/tabs.ts` (+ test), `field/leave-guard.tsx` (+ test), `field/FieldTabs.tsx`, `ui/alert-dialog.tsx`, `App.tsx`, `Band.tsx` (`BandLink` deleted, nothing imported it), `copy.ts`, `styles/app.css`, `field/VisitScreen.tsx`, `field/AddProspectScreen.tsx`, `docs/design.md`.
- No new palette token or `palette.test.ts` row was needed: the tab label on `card` and the pill's edge are already covered by "muted text on card", "ink on card" and "button edge against a card".
- Caught reading the diff, fixed before review: the bar carried `z-40` while both field screens' own action bars (`VisitScreen.tsx`, `AddProspectScreen.tsx`) are `fixed inset-x-0 bottom-0` with no z-index, so below 768 px the tab bar covered "Enregistrer la visite" — an agent could not save a visit. Both bars also sat at the same `bottom: 0`, so no z-index could have separated them. Fixed by DESIGN.md › Layout's own rule ("Sticky action buttons sit directly above the tab bar"): three `calc()` utilities in `app.css` — `.above-tab-bar`, `.pb-action-bar`, `.pb-tab-bar` — off `--spacing-tab-bar-height` and the safe-area inset, with the 768 px case dropping the offset.
- Found in passing, not fixed here: `.safe-bottom` sits in `@layer base`, so a `py-*` utility on the same element overrides it and the safe-area inset is dead. Three spots outside this story: `App.tsx:196`, `App.tsx:290`, `admin/AdminLayout.tsx:47`. Issue #80.
- Build: baseline (pre-tabs) precache 629.34 KiB / entry chunk 466.30 kB raw, 149.43 kB gzip. After: precache 672.81 KiB, entry chunk 511.32 kB raw, 163.70 kB gzip. The +43.47 KiB is `radix-ui/alert-dialog` entering the precached entry chunk, as the Decisions section anticipated. 640 tests pass.
- Not verified by any agent here: the visual pass at 390 and 820 px in both themes. No browser automation in this environment; it stays on the manual list.

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: high 1, medium 4, low 9, false 2, maybe-false 0. Routes: patch 9, defer 4, reject 9. No intent_gap and no bad_spec, so no loopback.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | blind, edge, verif | `safe-bottom` and `h-tab-bar-height` on the same `<nav>` under `box-sizing: border-box` make the bar 64px *including* the inset, so the 48px targets spill into the home-indicator strip; `.above-tab-bar` and `.pb-tab-bar` then over-clear by the inset | high | patch | Verified in the built CSS: `.h-tab-bar-height{height:4rem}`, `.safe-bottom{padding-bottom:env(...)}`, preflight `box-sizing:border-box`. Contradicts app.css:207-209's own contract and the band's header/inner-row pattern. Split the two |
| 2 | blind, verif, intent | `aria-current` on two tabs at once: NavLink destructures `"aria-current": ariaCurrentProp = "page"` and emits `isActive ? ariaCurrentProp : undefined`, `end` defaulting to false | medium | patch | Verified in `react-router/dist/development/lib/dom/lib.js:372,395,405` — the default fires on an explicit `undefined` and the computed value is set after `...rest`. Tournée announces current on `/tournee/nouveau` and `/tournee/:id`. Pass `end` per tab, asserted in `tabs.test.ts` |
| 3 | blind, edge, verif, intent | `shouldAsk` uses exact string equality while the highlight uses `isCurrentTab`'s subtree rule, so `/tournee/nouveau/` draws Ajouter as current yet asks on tap | low | patch | Real, latent (no nested add route today). Contradicts the matrix's "already current → no guard". Direct correction: one rule, shared |
| 4 | blind, edge, verif | `.pb-action-bar` re-adds the tab-bar height that `<main>`'s `.pb-tab-bar` already supplies — ~64px + inset of dead space under both forms | low | patch | Verified: `App.tsx` `<main className="px-4 pt-6 pb-tab-bar">` wraps every field route. Cosmetic. Direct correction: drop the duplicate terms |
| 5 | blind, edge, intent | The band's `ml-auto` became `md:ml-auto` on a `fixed` (out-of-flow) element, so below 768px the sync pill and avatar pack left against the wordmark instead of the right edge | medium | patch | Verified: `BandBrand` is `min-w-0 flex-col`, not `flex-1`; the avatar is `shrink-0`; nothing else grows. `key-f1-tournee.html` puts a `flex:1` spacer there |
| 6 | blind | Pill uses hardcoded `h-[30px] w-[52px]` against CLAUDE.md's tokens-only styling rule | low | patch | Every other dimension in the change is a token; the next pill would pick another arbitrary value. Direct correction: the spacing scale |
| 7 | edge | At 320px with three tabs, "Tableau de bord" wraps out of the fixed-height bar | low | patch | ~106px per slot at 320px. Direct correction: truncate |
| 8 | blind | `tabsLabel`'s comment describes "the band's other nav", which this change deletes | low | patch | Direct correction of a comment the diff itself falsified |
| 9 | intent, edge | `docs/design.md` drift: the field shell sketch still draws no tab bar; the visit sketch calls the save bar "sticky above the safe-area inset"; the new section claims an admin who goes offline loses the tab outright | medium | patch | Verified: `offline` is computed once at mount (`App.tsx:204,262,297`), no online/offline listener. The story owns this doc, so the drift is in scope |
| 10 | blind, edge, verif, intent | A dirty draft is still discarded silently by `BackLink`, the browser back button and the update prompt | medium | defer | Pre-existing: `BackLink` was a plain `Link` before this change too. #74 stays open for the non-tab exits, as the frozen Decisions say |
| 11 | verif | No automated check of the precache total against the 1,000 KiB ceiling; `config.test.ts` asserts every other build invariant | medium | defer | ADR-0026:88 scopes the CI check as follow-up work. The PR quotes the measured figure, which is what CLAUDE.md requires today |
| 12 | verif, intent | The guard's wiring is unpinned end to end: deleting `useRegisterDirty` from either screen, or `preventDefault` from the bar, leaves the suite green | medium | defer | Verified by the lens by deletion — 441/441 still passed. Closing it means a DOM harness (jsdom + testing-library), a dependency decision CLAUDE.md requires its own PR justification for |
| 13 | edge | An admin who goes offline mid-session keeps the Tableau de bord tab, and the admin chunk is not precached, so tapping it fails | medium | defer | Pre-existing in kind — the old `BandLink` had the identical `isAdmin` condition — but a tab makes it prominent. A fix needs an online listener and new state; the doc claim is corrected under #9 |
| 14 | blind, intent | "Tableau de bord" labels `/admin/prospects`, which the admin sidebar calls "Prospects" | low | reject | The owner's frozen decision of 2026-09-24, made with this exact trade-off stated. Its fix would edit the frozen block |
| 15 | blind | `nav.tabs.today/add` duplicate `nav.subtitle.today/add`, and from 768px the band shows "Tournée" as both subtitle and current tab | low | reject | Cosmetic and only at ≥768px; dropping the subtitle is a design change, not a direct correction, and no mockup covers the tablet band |
| 16 | blind | `tabsLabel: "Navigation"` makes a screen reader announce "navigation navigation"; per-link `aria-label` duplicates the visible label | low | reject | Harmless; renaming is preference, not a defect. The stale comment half is patched under #8 |
| 17 | blind, edge | The deleted nav's `min-w-0 overflow-x-auto` guard is gone, so the band could overflow at 768px | low | reject | Measured at 768px with three tabs for an admin: ~674px of 736px available. Does not overflow in everyday use, and the fix adds classes guarding a state not demonstrated |
| 18 | edge, verif, intent | "Annuler" returns focus to the tapped tab, not the form control, so the matrix's "focus back on the form" is met only as "the screen stays and values are intact" | low | reject | Radix restores focus to the element focused before open. On a touch device the agent taps the field to resume. A fix means tracking the last-focused control — more than a direct correction. **Disclosed to the owner** rather than silently dropped |
| 19 | edge | `useRegisterDirty` outside `LeaveGuardProvider` silently no-ops on the default context value | low | reject | Both forms render inside `FieldFrame`, which is the provider; the situation was never shown reachable, and a throw guards state not demonstrated |
| 20 | edge | `.pb-tab-bar` at ≥768px drops the safe-area inset `<main>` had via `.safe-bottom` | false | reject | `.safe-bottom` sits in `@layer base` and `py-6` beat it there (issue #80), so the inset never applied. Behaviour is unchanged |
| 21 | blind | `handleClick` calls `preventDefault` on ctrl/cmd/middle-click, swallowing open-in-new-tab | low | reject | Only on a dirty form, only on the desktop layout. The fix adds a modifier-key branch for a case the field route does not have |
| 22 | blind | The diff quotes no precache figure, which ADR-0026 requires of every field PR | low | reject | The requirement is on the PR, not the diff; the measured figures are in Implementation Notes and go in the PR description |
| 23 | blind | `FieldTabs` imports the dialog eagerly; it could be lazy | low | reject | The cost was the owner's explicit decision, quoted and under budget. Lazy-loading a confirmation an offline agent may need is a worse trade |
| 24 | intent | The Implementation Note cites a rule ("Sticky action buttons sit directly above the tab bar") that grep does not find in the baseline `docs/design.md` | false | reject | The rule is in the UX spine, `ux-.../DESIGN.md:313` (§ Layout), which the epic says wins on conflict — not in `docs/design.md` |
| 25 | blind | `BackLink.tsx:4-7` still justifies a hand-rolled SVG by keeping lucide out of the field entry chunk, which `App.tsx:12` already contradicts on main | low | defer | Pre-existing comment drift, unrelated to tabs. Filed as a found-in-passing issue |

## Design Notes

One component, two layouts, not two components: below 768 px a `fixed bottom-0` bar on `card` with a top border and `.safe-bottom`; from 768 px a flex row inside the band on the band palette, where the gold pill reads like the admin sidebar's current item. Two components would duplicate the tab list and drift.

`/tournee` is an index route, so the admin `isCurrent` rule (path, or anything under it) would light Tournée up on `/tournee/nouveau` and on a visit. The field rule differs per tab, so it lives in `tabs.ts` with a test per matrix row.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: clean.
- `pnpm test` -- expected: all pass, including the new `tabs.test.ts` and `leave-guard` test.
- `pnpm lint` -- expected: clean.
- `pnpm build` -- expected: the Workbox precache line at or under 1,000 KiB; record it and the entry chunk's gzip size for the PR.

**Manual checks:**
- `pnpm dev` at 390 and 820 px, light and dark: tab position, the gold pill, 48 px targets, and that the bar never covers the last row of content.
- As an admin, online then with the network off: the third tab appears, then goes.
- Type into a visit and into Ajouter, then tap another tab: the guard behaves and the outbox count does not change.
