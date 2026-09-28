# Deferred work. Append-only: never edit or delete an entry, and never rewrite its summary.
# A `closed_by` line means the entry was fixed rather than filed — it names what closed it, so a
# reader can tell the live entries from the settled ones (added 2026-09-25, epic #59 retro F3).

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-61-split-the-shell-by-side.md`
  summary: `/admin` and unknown `/admin/*` paths render the admin frame with an empty main (no index redirect, no not-found route inside AdminApp).
  evidence: Pre-existing before GH #61 (AdminApp's Routes matched nothing then too); epic 2 adds the `/admin` index route for Tableau de bord, and a `*` not-found belongs with it.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-61-split-the-shell-by-side.md`
  summary: No automated test asserts which frame each route and role renders in, or the `/` redirect per role.
  evidence: The repo has no DOM test harness (vitest unit project is node-only, `*.test.ts`); deleting the forbidden route or the `updatePrompt` prop passes CI. Worth an issue before stories 4–7 rewrite the frames; a harness is a new dependency needing its own justification.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-61-split-the-shell-by-side.md`
  summary: No post-build check that admin-only modules stay in `AdminApp-*` and the precache stays under ADR-0026's 1,000 KiB ceiling.
  evidence: CI runs `pnpm build` but asserts nothing about chunk contents; a static import of an admin module from the entry would silently precache it. ADR-0026 already names the CI check as follow-up work.
  closed_by: PARTLY — the precache-ceiling half only, by `scripts/check-precache.mjs` + `ci.yml` in `8c2a1cd8a221a33e843f8a6151e0da9d78d95f2e` (PR #89). The chunk-contents half is STILL OPEN with no issue: `config.test.ts:87-95` asserts the Workbox `globIgnores` config, not the built output, and `check-precache.mjs` catches a stray admin import only once it pushes the total past 1,000 KiB — 323 KiB of headroom today. Epic #59 retro F3, caveat.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-62-design-md-tokens-and-palette-rules.md`
  summary: The outcome chart colours are hard to tell apart — interested vs not-interested is 1.00:1 (light) / 1.28:1 (dark), and no-contact is 1.3:1 / 1.6:1 against the card.
  evidence: DESIGN.md's own hex values, now in app.css; the stacked "Visites dans le temps" chart (epic-dashboard) puts them side by side, below WCAG 1.4.11's 3:1 for graphics. Needs a design decision before that chart ships.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-62-design-md-tokens-and-palette-rules.md`
  summary: Light `band-muted` text on the `band-accent` hover wash is 4.26:1, below 4.5:1.
  evidence: Measured by the GH #62 implementer. Matters to story 4 (sidebar) if an item keeps band-muted text on hover; use band-foreground there or nudge band-muted.
  closed_by: GH #63 (`cec13f8da8854321d3bc0dc656d3a0bbcbc19235`) took the other option — `band-muted` is now restricted to group labels, which never sit on the hover wash (`styles/app.css:117`, `ui/sidebar.tsx:236`, `field/FieldTabs.tsx:111-112`), pinned by `styles/palette.test.ts:295-301`. Epic #59 retro F3.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-62-design-md-tokens-and-palette-rules.md`
  summary: Admin `Input` still steps down to `md:text-sm`, while docs/design.md › Type now says every input on both sides is 16px (`text-body-field`).
  evidence: `src/client/ui/input.tsx:20`; deliberate under the old design (comment at lines 4–8). An admin on an iPad-width screen gets iOS zoom. Adopt with the admin screens epic.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-63-admin-sidebar.md`
  summary: No test covers the admin sidebar's rendered behaviour (the width modes, the drawer opening and closing, the rail tooltip and dot, badge visibility).
  evidence: The unit project runs in `node` with no DOM harness (no jsdom, happy-dom or testing-library). GH #63 was checked by hand in `pnpm dev` at 1280, 820 and 390 px. Adding a harness is a new dev dependency, which needs its own justification.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-65-field-band-and-sync-strip.md`
  summary: Tapping a sync-strip button in the middle of a form discards the unsaved visit or prospect draft (issue #74).
  evidence: Drafts live only in react-hook-form memory (`VisitScreen.tsx:117`); "Se reconnecter" navigates and "Mettre à jour" reloads. The owner chose to ship and follow up.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-65-field-band-and-sync-strip.md`
  summary: A 401 at startup leaves the agent on an error screen with no way back through Access (issue #75).
  evidence: The `App.tsx` identity error has no action, and a reload is served from precache and hits the same 401. Pre-existing.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-65-field-band-and-sync-strip.md`
  summary: The field loading state (`!me`) has no band, while the error state now has one.
  evidence: `App.tsx` `if (!me)` returns a bare `<main aria-busy>`. Pre-existing and outside the states named in the story.
  closed_by: `8c2a1cd8a221a33e843f8a6151e0da9d78d95f2e` (PR #89) gave the `!me` branch the band. Pinned by `App.test.tsx` — originally its loading case, and since `refactor/band-header` (retro F1 action 1) by `App band header` › "draws the band in the loading frame". Epic #59 retro F3.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-65-field-band-and-sync-strip.md`
  summary: The rendered wiring (FieldFrame hiding UpdatePrompt, class and icon mapping, live regions, marker cleanup effect) has no automated test.
  evidence: The repo has no DOM test harness (the unit project is node-only, `*.test.ts`). Adding one is a new dependency that needs its own justification; the decisions themselves are pinned in `sync-view.ts` and `reconnect-marker.ts`.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-64-admin-top-bar.md`
  summary: The admin top bar's components (TopBar, SearchPalette, ThemeToggle, AccountMenu) have no render test — e.g. "Se déconnecter" being a plain anchor rather than a router Link, or the breadcrumb's per-breakpoint classes.
  evidence: The unit project runs under node with no DOM harness (no jsdom/testing-library), and adding one is a new dependency; only the pure helpers (breadcrumbFor, isPaletteShortcut, LOGOUT_PATH, theme.ts, the index.html boot script) are tested. Same gap as the GH #63 sidebar deferral.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-66-field-tabs.md`
  summary: A dirty visit or add-prospect draft is still discarded silently by BackLink, the browser back button and the update prompt.
  evidence: Pre-existing — BackLink was a plain Link before #66 too. The frozen Decisions scope the guard to tab taps and leave #74 open for the rest; the inconsistency is now visible, since one exit asks and the neighbouring one does not.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-66-field-tabs.md`
  summary: Nothing fails when the precache total passes the 1,000 KiB ceiling; config.test.ts asserts every other build invariant but not this one.
  evidence: ADR-0026:88 scopes the CI check as follow-up work. Measured 672.81 KiB here, quoted in the PR by hand, which is all CLAUDE.md requires today.
  closed_by: `scripts/check-precache.mjs` + `ci.yml` in `8c2a1cd8a221a33e843f8a6151e0da9d78d95f2e` (PR #89) — the build now fails over the ceiling. Same fix as the `spec-gh-61` entry above. Epic #59 retro F3.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-66-field-tabs.md`
  summary: The leave guard's wiring is unpinned end to end — deleting useRegisterDirty from either field form, or preventDefault from the tab bar, leaves the whole suite green.
  evidence: Verified by deletion during review (441/441 still passed). Closing it needs a DOM harness (jsdom + testing-library), a dependency decision this repo has deliberately not made and which CLAUDE.md requires a PR-level justification for.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-66-field-tabs.md`
  summary: An admin whose network drops mid-session keeps the Tableau de bord tab, and the admin chunk is not precached, so tapping it fails.
  evidence: `offline` is computed once from /api/me at mount (App.tsx:204,262,297) with no online/offline listener. Pre-existing in kind — the old BandLink used the identical isAdmin condition — but a tab slot makes it prominent. A fix needs an online listener and new state.

- source_spec: none
  summary: The 401 identity error screen gets a « Se reconnecter » action so a stuck agent can reach Access again (issue #75).
  evidence: Split out of the #67 refactor sweep. Behavioural change to App.tsx's error branch and identity.ts's 401 path; it lands on the shell surfaces the #83 DOM harness is being built to pin, so it ships after #83 rather than being hand-verified and retro-fitted.
- source_spec: none
  summary: The remaining unguarded exits from a dirty field form — BackLink, the browser back button, and UpdatePrompt — reach the leave guard (issue #74's remaining paths).
  evidence: Split out of the #67 refactor sweep. #66 scoped the guard to tab taps only; extending it to three more exits is independently shippable wiring across BackLink.tsx, leave-guard.tsx and Band.tsx, and needs the #83 harness to stay pinned (deleting the wiring leaves the suite green today).

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-83-dom-test-harness-for-the-shell.md`
  summary: The offline-admin branch of `isAdmin` and the identity-error screen have no DOM test — deleting `&& !offline` from `App.tsx` passes CI.
  evidence: GH #83 covered the five rows its acceptance criteria named; this one needs a rejecting `apiFetch` plus a seeded Dexie identity, so it was left out rather than half-built. The pure half is covered in `identity.test.ts`.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-83-dom-test-harness-for-the-shell.md`
  summary: The admin top bar's secondary handlers are untested — `ThemeToggle`'s `matchMedia` change listener, both `SearchPalette` buttons' `onClick`, the `metaKey` half of the shortcut, and dismissing the leave dialog by Escape or overlay.
  evidence: GH #83's acceptance criteria asked for "a top-bar control's handler"; the theme toggle, the Ctrl+K shortcut and the sign-out anchor are covered, these neighbours are not.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-83-dom-test-harness-for-the-shell.md`
  summary: `test/setup-dom.ts` fixes `navigator.geolocation` as permanently denied, so the positioned path of `useAgentPosition` cannot be exercised from the `dom` project.
  evidence: happy-dom declares the property as `null`, which makes `"geolocation" in navigator` pass and the next call throw; the shim gives it the refused shape the round already handles. A per-test override would be needed to test the success path.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-30-chunk-sync-inarray-lookups.md`
  summary: Sync derives prospect status one statement pair per prospect; the worst case (200 distinct prospects, ~400 sequential D1 statements) has never been measured against the Workers Free budget.
  evidence: `src/worker/routes/agent.ts:265-269` awaits `deriveProspectStatus` per touched prospect and each call issues two statements (`src/worker/routes/status.ts:34-58`). Pre-existing, not caused by this change, though chunking the lookups doubled the reachable ceiling from 100 to 200 prospects. The worker tests run on a real D1 but enforce neither the CPU nor the subrequest budget, so the green suite does not settle it. Filed as GH #102; measuring a full 200-prospect sync would prove it either way.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-107-tableau-de-bord-at-admin.md`
  summary: An admin who opens `/` is still redirected to `/admin/prospects`, not to Tableau de bord at `/admin`.
  evidence: `src/client/App.tsx:318` (`Navigate to={isAdmin ? "/admin/prospects" : "/tournee"}`), pinned by `src/client/App.test.tsx:153`; predates #107, whose intent names `/admin` only. EXPERIENCE.md calls Tableau de bord "the admin's home". Filed as GH #135.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-107-tableau-de-bord-at-admin.md`
  summary: `cn()` in `src/client/lib/utils.ts` uses plain `twMerge`, which reads the custom `text-meta`/`text-overline`/`text-display`/`text-title` size tokens as colours and drops a text colour passed before them.
  evidence: Found building the KPI delta chip (#107): `cn("text-success", "text-meta")` loses `text-success`; worked around in `KpiCard.tsx`. Fix is `extendTailwindMerge` with the theme's font-size tokens. Filed as GH #136.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-107-tableau-de-bord-at-admin.md`
  summary: No test pins that `AdminApp`'s provider is `createAdminQueryClient()`, so reverting it to a plain `QueryClient` silently drops the dashboard invalidation.
  evidence: Verification-gap lens reverted `AdminApp.tsx:28` to the pre-#107 `new QueryClient(...)` and all 875 client tests passed; the factory itself is pinned by `query-client.test.ts`.
- source_spec: `/home/m0/PROJECTs/captain-prospectus/_bmad-output/implementation-artifacts/spec-gh-108-seed-dashboard-data.md`
  summary: No test exercises the request bodies `scripts/seed.mjs` builds: the specials must share a batch with their `mergeInto` target, and `ROWS_PER_REQUEST` is a hand copy of `IMPORT_ROWS_PER_REQUEST`.
  evidence: grep finds `seed.mjs` only in package.json; the route tests use their own `fullBody()`. Reordering `all`, renaming `NAMES[2]` or lowering the shared cap would turn the seed into a 400 with `pnpm test` still green. The fix is to extract the body builder into an importable module.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-115-admin-tab-offline.md`
  summary: A 401 on the new identity re-check swaps the whole shell for the error frame, discarding a dirty visit or add-prospect draft with no confirm.
  evidence: The error path itself is #115's frozen AC3 (a revoked identity follows identity-access.md). What is new is that it can now fire mid-session, from a returning network, rather than only at app start — one more unguarded exit in the #74/#75 class, whose other paths are already filed.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-115-admin-tab-offline.md`
  summary: A re-check that answers a different email clears the cached round and visit history under a live, already-rendered screen, and swaps SyncProvider's identity; neither effect is asserted.
  evidence: `resolveIdentity`'s `identitySwitched` branch and `clearAgentCache` are unchanged, but before #115 the identity effect ran once, so a cached round could only be wiped at app start. `App.test.tsx`'s "re-check answers agent" case asserts the tab's absence and the pathname only. Backlog 013 (`needs-decision`) owns identity switching under a cached identity and should settle this with it.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-115-admin-tab-offline.md`
  summary: With `navigator.onLine` stuck true on a dead uplink the Tableau de bord tab stays, and tapping it fetches the un-precached admin chunk; a rejected lazy import then throws past `Suspense` rather than hanging as ADR-0019 describes.
  evidence: ADR-0019's Consequences already accept the failed-chunk case but describe it as a blank `aria-busy` hang; there is no error boundary around the admin `Suspense` (`App.tsx`). #115's gate reads the browser's signal, which a captive portal or an associated-but-dead AP does not flip. #97 owns the offline-admin screen, and the error boundary is named in ADR-0019 as its own change.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-115-admin-tab-offline.md`
  summary: The client now carries four distinct notions of "offline" — sync reachability, identity cache-sourcing, `useOnline`'s window events, and a raw `navigator.onLine` read.
  evidence: `field/sync.ts:141` (`status: "offline"`), `field/identity.ts`'s `offline` outcome, `hooks/use-online.ts`, and `field/SyncIndicator.tsx:132`. Three predate #115, which adds the fourth. Collapsing the event-based one onto the sync engine's reachability status would remove a signal rather than add one, but it changes what the tab follows and needs its own decision.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-115-admin-tab-offline.md`
  summary: `docs/vision.md`'s recorded bundle figures are stale — 782 KiB precache and 164.71 kB entry, against a 686.44 KiB precache measured at `acfb094`.
  evidence: ADR-0019's Consequences name vision.md as "the file that carries both numbers", and CLAUDE.md asks every field-route PR to quote the precache total. The drift predates #115 (several PRs quoted the figure in their description without updating vision.md); #115 quotes 687.03 KiB / 505.88 KiB in its own PR.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-124-visite-step-2-questions.md`
  summary: Assert the real script answers on the outbox row once #142 makes save pass the pinned script to toVisit.
  evidence: VisitScreen.test.tsx "queues the visit after every control is answered" pins today's `answers: {}`; flip it to `{ delivery: true, cash_register: "Papier", satisfaction: 4, seats: 46 }` with the #142 fix.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-121-carte-lazy-map-and-tab.md`
  summary: The field's lazy routes (Carte, Visite, Ajouter) have no error boundary, so a failed chunk import renders nothing.
  evidence: Unverified. It would matter only if a precached chunk is evicted or missing (no service worker yet, a stale hash after a deploy). Settle it by loading /tournee/carte offline with no service worker registered.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-110-visites-dans-le-temps.md`
  summary: Visites dans le temps' tooltip header, legend order and tick format have no automated test.
  evidence: Recharts renders nothing at happy-dom's 0 width, so only pure helpers and the sr-only table are tested; checked by hand in the seeded browser (GH #110 review pass 1).
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-110-visites-dans-le-temps.md`
  summary: src/worker/dashboard.test.ts computes brusselsPeriod(Date.now()) apart from the server's own Date.now(), so a run across Brussels midnight could flake.
  evidence: Pattern since #107; pin the clock with vi.setSystemTime in beforeEach to settle it.

- source_spec: `spec-gh-111-kpi-sparklines.md`
  summary: No client test observes which `byDay` series each KPI sparkline draws; Recharts renders no SVG at happy-dom's 0 width.
  evidence: Swapping `data.visits.byDay` and `data.converted.byDay` in DashboardScreen.tsx passes every test; the server series are pinned in dashboard.test.ts and the seeded screenshots show each card's own shape.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-127-ajouter-un-prospect.md`
  summary: Ajouter tapped while the position reading on open is still outstanding saves the place with null coordinates, so it lands at the end of the round instead of as the nearest stop.
  evidence: AddProspectScreen `save` reads `point` at tap time; useAgentPosition's reading can take up to 10 s (OPTIONS.timeout). Pre-existing write path; fixing it (await the reading, or disable Ajouter while locating) is a behaviour decision. Medium, verified by code reading.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-127-ajouter-un-prospect.md`
  summary: The CSV import preview shows coordinates with toFixed(4) (a decimal point) instead of fr-FR; tracked as issue #154.
  evidence: src/client/admin/import/PreviewStep.tsx:100; pre-existing, admin only, cosmetic.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-120-swipe-actions-on-stop-rows.md`
  summary: On a real phone, confirm a vertical scroll over the Tournée list never swipes a stop row (story #120 acceptance, device half).
  evidence: Only happy-dom pointer simulation ran; iOS Safari's pan-y / pointercancel behaviour needs a device. Owned by story 117.12's device run.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-113-a-traiter-and-cpu-budget.md`
  summary: The sidebar's À rattacher badge counts only the first page of the repair queue, so it disagrees with À traiter past 200 orphans (GH #159).
  evidence: `AdminSidebar.tsx:32` uses `queueCount(orphans, d => d.visits)`; À traiter uses `visits.length + remaining` per the schema's definition of `remaining`.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-113-a-traiter-and-cpu-budget.md`
  summary: The live feed's polite status is not re-announced when consecutive polls bring the same count (GH #160).
  evidence: Same text twice leaves the DOM unchanged in both `VisitsScreen` and `RecentVisits`.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-113-a-traiter-and-cpu-budget.md`
  summary: No automated check keeps the dashboard within 10 ms CPU; it relies on re-running `scripts/measure-dashboard-cpu.mjs`.
  evidence: The measurement needs the seeded local D1 and hardware-dependent timing; the cold first request is 7.9–8.2 ms, so a future figure could cross 10 ms unnoticed.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-128-refactor-sweep.md`
  summary: Outbox stamping and claiming (`queueVisit`'s and AddProspectScreen's inline `writtenBy`, sync.ts's two claim-unstamped loops and `unstamped()`) could move into `field/outbox-stamp.ts` beside `sendableBy`.
  evidence: Duplication map on #128 — sites `db.ts:177`, `AddProspectScreen.tsx:92`, `sync.ts:101-105`, `sync.ts:180-189`. Touches the sync write path, so it belongs in its own change with the sync tests, not a no-behaviour sweep.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-116-refactor-sweep.md`
  summary: The import screens write out the status leading-edge class strings (MapStep ×3, PreviewStep ×1) instead of using `STATUS_EDGE` (GH #167).
  evidence: Found by the duplication-map lens. The sites are `src/client/admin/import/MapStep.tsx:357-360` and `PreviewStep.tsx:91`, both outside epic #104's surface. MapStep's comment says it wants the ledger's edge.
  closed_by: GH #180 (`96cfe6456f7e0ceede5cc077657441db21c280a5`, PreviewStep) and GH #181 (`8dc5801c273319818e755ecae7264c4128d3524c`, MapStep) — both read `STATUS_EDGE` from `admin/status.ts`; GH #167 is closed. Recorded by the epic #174 sweep (GH #186).

- source_spec: none
  summary: The admin `Input` still steps down to `md:text-sm` while `docs/design.md` › Type says every input on both sides is 16px `text-body-field` (GH #92).
  evidence: Split out of GH #175 at its multi-goal gate on 2026-09-27. #175 builds the admin PageHeader/Panel primitives and the shared admin states; nothing in that work needs the Input size, so bundling it would put an unrelated, separately revertable fix in the same diff (CLAUDE.md, one concern per change). The epic still owes it — the original deferral says "Adopt with the admin screens epic" — so it belongs to whichever screen story touches admin inputs first, or to the epic's refactor sweep (GH #186).
  closed_by: GH #186 (epic #174 sweep) — `md:text-sm` dropped from the vendored `ui/input.tsx` default, and Prospects' per-site `md:text-base` override removed. Every field `Input` passes `touch`, whose classes are unchanged, so the field route renders the same.
- source_spec: none
  summary: The vendored `Progress` never forwards `value` to the Radix root, so every bar renders indeterminate (GH #147).
  evidence: Split out of GH #175 at its multi-goal gate on 2026-09-27 for the same reason. Its real consumer is the Import CSV path's "Import en cours : {n} / {total}" progress, which is GH #180; that story cannot meet its own verify without it, so #147 should be fixed there rather than speculatively here.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-175-admin-primitives-and-states.md`
  summary: The eleven hand-spelled panel-chrome sites in the admin screens still do not use the shared `Surface` primitive.
  evidence: Split at #175's token/scope gate on 2026-09-27. Every one of those files is rebuilt later in this same epic (#178-#184), so adopting the chrome now is markup those rebuilds discard. Each screen story adopts `Surface` as it is rebuilt. `ProspectsScreen.tsx:188,291` additionally needs a split-panel variant (`rounded-t-md border-b-0` plus `rounded-b-md`) that a single-element Surface cannot express — that belongs to #179.
  closed_by: the screen rebuilds GH #178–#184 (`9a9a3d1559375321af3bfb957a554b360dc25d9c` … `5e014de5af1ccbdeb6eab884590b7f61428c5cb8`) — every admin panel now composes `Surface`; the one `rounded-md border` left, `import/MapCanvas.tsx:175`, is the map's frame, not panel chrome. Recorded by GH #186.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-175-admin-primitives-and-states.md`
  summary: The six admin screens still each render their own loading and load-failure treatment instead of the shared `ScreenState`.
  evidence: Split at the same gate for the same reason. The current treatments are not symmetric — Prospects, Doublons and Scripts early-return and replace the screen, Orphans and Visites render inline merged with the empty state, and the import steps have no load state at all — so each rebuild converges its own screen onto `ScreenState`, whose first consumer is #178 (Visites).
  closed_by: PARTLY — Prospects, Doublons, À rattacher, Scripts and the Visites strip converged on `ScreenState` in GH #178–#184. The Visites ledger still has its own loading line and bare failure line, filed as #207 and #208 by GH #185. Recorded by GH #186.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-175-admin-primitives-and-states.md`
  summary: The manual by-eye list of `cn()` sites whose rendering changes under the GH #136 fix was incomplete — `field/FieldTabs.tsx:119-126` and `admin/dashboard/RecentVisits.tsx:117,123` also pair a `--text-*` token with a colour through `cn()`.
  evidence: Found by the edge-case lens on the #175 review. The spec named six sites; these two make eight. Both now apply a size token that was previously merged away, so their line-height and letter-spacing shift. Added to the check list in that spec's Implementation Notes; recorded here because the visual confirmation belongs to GH #185, the epic's human pass at three widths in both themes.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-175-admin-primitives-and-states.md`
  summary: `ScreenState` has no equivalent of the dashboard's `isPlaceholderData` dimming for stale data.
  evidence: `DashboardScreen.tsx:70` feeds `{busy, dimmed}` to its panel rows; `ScreenState` carries neither. Not a defect in a component with no consumers, but #178 is its first adopter and will want it — decide there whether dimming belongs in the shared component or stays per-screen.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-175-admin-primitives-and-states.md`
  summary: "Réessayer" now has five keys in `copy.ts` (`:208`, `:349`, `:404`, `:631`, and the new `errors.retry` at `:758`), and `copy.errors` now mixes error messages with a button label.
  evidence: The new generic key is needed by `ScreenState`; `dashboard.retry` only becomes redundant once the dashboard adopts it. Consolidate when that happens rather than churning a shared key now. The naming point is the same entry: every other `copy.errors` member is a message shown to the user, so the next generic affordance label has a tempting but wrong home there.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-175-admin-primitives-and-states.md`
  summary: The screen count `<span className="text-muted-foreground tnum">` is spelled three times as a `ScreenHeader` `actions` prop.
  evidence: `DuplicatesScreen.tsx:49-54`, `OrphansScreen.tsx:55-60`, `VisitsScreen.tsx:31-34`, all created by #175's heading swap. `copy.duplicates.count`, `copy.orphans.count` and `copy.visits.count` share a `(n: number) => string` signature, so a `count?: number` prop on `ScreenHeader` would fold all three — a design decision better made in the screens' own rebuilds (#178, #182, #183).
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-175-admin-primitives-and-states.md`
  summary: `DashboardScreen.tsx:74-89` still hand-rolls the exact markup `ScreenHeader` encodes, and is the one admin screen not migrated to it.
  evidence: Same three parts in the same order — `flex flex-wrap items-end justify-between gap-4`, an `h2.text-title` with a muted subtitle, and a right-aligned action. `ScreenHeader`'s `subtitle`/`actions` props exist because of this screen, and its `subtitle && "items-end"` branch was written for it. #175 scoped itself to the six screens that hand-spell the heading, which the dashboard does not; nothing prevents the two drifting until it adopts the component.
  closed_by: GH #186 (epic #174 sweep) — DashboardScreen renders `ScreenHeader` with its subtitle and `PeriodToggle` as `actions`.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-175-admin-primitives-and-states.md`
  summary: The KPI delta Badge is now the only badge in the app carrying `--text-meta`'s tracking (GH #136 follow-on).
  evidence: `badge.tsx:6` hardcodes `text-xs`, which the fixed `cn()` now merges away at `KpiCard.tsx:91` in favour of `text-meta`. The sizes match but the token adds letter-spacing and line-height, so this one chip differs from every other badge. Moving `text-meta` into the badge variant touches vendored `ui/` shared with the field route, so it belongs with a story that owns that surface.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-175-admin-primitives-and-states.md`
  summary: `field/NumberStepper.tsx:53-55` carries a comment that is stale as of GH #136, and its `!` is now load-bearing for a different reason.
  evidence: The comment reads "`text-display` is a theme token tailwind-merge does not know, so Input's own `text-base` survives the merge and wins in CSS order". After #175 the token *is* known and wins the merge on its own; the `!` now only beats Input's `md:text-base`. The twin workaround in `KpiCard.tsx` was removed by #175; this one was not, because the spec's Boundaries forbid touching field files while epic-field-screens may be rebuilding them.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-176-search-range-and-export-filters.md`
  summary: Prospect name search folds ASCII only, so `?q=cafe` does not match "Café" and `?q=CAFÉ` does not match "café" (GH #188).
  evidence: Owner's decision at #176's planning gate on 2026-09-27. SQLite's `LIKE` and `lower()` both ignore non-ASCII case, and `prospects` has no folded column and no index on `name` (`src/worker/db/schema.ts:68-75`); a `%needle%` could not use one anyway. The proper fix is a stored folded column with its own index, which needs a d1-migration, a new server-gaps row and probably an ADR — all excluded by epic #174's non-goals. Matching against `dedupe_key` was rejected: it is a composite of name, coordinates and address, so a needle would match address text, and it inherits GH #50, where a non-Latin name normalises to an empty string and matches every row. #179 builds the search box against whatever `q` does, so nothing in the epic is blocked.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-176-search-range-and-export-filters.md`
  summary: The admin visits feed caps at `ADMIN_VISITS_PAGE_SIZE` (500) and, unlike both CSV exports, sets no `x-truncated` header — so a `from`/`to` range holding more than 500 visits returns the newest 500 and looks complete.
  evidence: Found by the edge-case lens on #176's review. With `since` paging the cap was invisible because the client kept advancing a cursor; once GH #176 gives the feed an explicit window, an admin reading "30 derniers jours" can believe they see all of it. GH #178 builds Visites with its 25-row pagination and its 7/30/90 selector, so it owns the fix — either surface truncation the way the exports do, or page within the range.
  closed_by: GH #178 (`9a9a3d1559375321af3bfb957a554b360dc25d9c`) — `useVisitsFeed` sets `capped` when a range answers a full page (`admin/queries.ts:340-413`), and Visites' count reads `copy.visits.countCapped`. Recorded by GH #186.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-176-search-range-and-export-filters.md`
  summary: The feed's new `from` is inclusive (`gte`) while its existing `since` is exclusive (`gt`), so a client paging with `from = lastSeenReceivedAt` re-reads that visit.
  evidence: Deliberate — `from`/`to` mirror the visits CSV export's inclusive window, which is the behaviour the range is meant to match — but the asymmetry is easy to trip over. Documented in docs/api.md rather than changed, since `since` is a deployed cursor and altering it would not be additive.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-176-search-range-and-export-filters.md`
  summary: "The feed reads `received_at`, not `visited_at`" is now stated in five places: two docs/api.md sections, the visits export route comment, the feed's schema comment, and CLAUDE.md's INVARIANT 12.
  evidence: #176 added one of them. CLAUDE.md's own convention is the rule against it — "Link the ADR or domain doc instead of restating it; a rule has one home (ADR-0024)". Consolidating means choosing the home and making the other four point at it.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-176-search-range-and-export-filters.md`
  summary: The worker test harness is copied per file — `call()` in eight test files plus four inlined copies, `ADMIN`/`AGENT` in eight, `post()` in two, and the FK-order `beforeEach` delete block in several.
  evidence: Found by the duplication lens. Pre-existing and untouched by #176, which added tests to two of those files. Unlike the other duplication findings this one has no home to move into: there is no `src/worker/test-utils.ts` and no vitest setup module under `src/` for the worker project, so the fix has to create one.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-176-search-range-and-export-filters.md`
  summary: `seedVisit` and `seedProspect` each name several unrelated contracts across the worker test files, and `sync.test.ts:19` binds `AGENT` to the admin's address.
  evidence: `seedVisit(name, receivedAt, outcome)` creates a prospect and a visit in `admin.test.ts`; `seedVisit(prospectId, over)` inserts only a visit in `export.test.ts`; `retention.test.ts` has a third. `seedProspect` has five signatures. Both of #176's new test blocks call a `seedVisit` — different ones. Pre-existing; belongs with the test-harness home above.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-176-search-range-and-export-filters.md`
  summary: `POST /api/admin/visits/orphaned/:id/discard` validates its param with `prospectIdParamSchema` although `visitIdParamSchema` exists for that subject, and the sibling repair route uses it.
  evidence: Found by the duplication lens' inverse pass. The two schemas are byte-identical, which is exactly what hides the mistake — the comment on them says "Same shape, different subject". No wrong behaviour today; it is a correctness-of-naming fix that would stop a future change to one subject's id rule silently applying to the other.
  closed_by: GH #186 (epic #174 sweep) — the route validates with `visitIdParamSchema`.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-176-search-range-and-export-filters.md`
  summary: The CSV truncate-and-slice tail and the `Response` construction are written twice, once per export route, with the slice shape appearing a third time in the duplicates sweep.
  evidence: Pre-existing; #176 edited one of the two routes. `src/shared/csv.ts` already owns the serialiser and could own the cap, but not the `Response` — its header declares it a pure module with no Worker APIs (CLAUDE.md), so the response half needs a worker-side home. docs/api.md already claims "Two endpoints, one serialiser", which is true of the serialiser and not of the tail.
  closed_by: GH #186 (epic #174 sweep) — `capExport` and `csvResponse` in `src/worker/routes/admin.ts` serve both exports, and docs/api.md › CSV exports names them. The duplicates scan's slice stays apart: it caps at `DUPLICATES_SCAN_LIMIT` and answers JSON.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-180-import-csv-rebuilt.md`
  summary: The map path's failure Alert still shows the generic `copy.import.failed` rather than naming how many rows went in, unlike the CSV path since #180.
  evidence: `MapStep.tsx:306-309` renders `copy.import.failed` regardless of `progress.done`; MapStep is #181's surface.
  closed_by: GH #181 (`8dc5801c273319818e755ecae7264c4128d3524c`) — MapStep's failure Alert reads `copy.map.failedAfter(progress.done)`. Recorded by GH #186.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-180-import-csv-rebuilt.md`
  summary: A retry after a mid-way import failure reports the first run's created rows as « mis à jour » in the result dialog, and a non-transient server error (400/403/426) is shown as the same retryable failure.
  evidence: `useImportBatches.start` resets its totals and re-sends every row, which the batch upsert counts as updates; `PreviewStep` never shows `importer.error`. Both pre-date #180.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-180-import-csv-rebuilt.md`
  summary: An in-app navigation (sidebar) during a running import unmounts Import and drops the `beforeunload` guard while batches keep sending; the spine says the page can't be left without a confirmation.
  evidence: `main.tsx` uses `BrowserRouter`; React Router's `useBlocker` needs a data router, a router change outside this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-181-import-map-rebuilt.md`
  summary: After a failed map import, switching provider or running a new search leaves the stale failure Alert and « Réessayer » against a different result set.
  evidence: `importer` lives in ImportScreen and `chooseProvider`/`runSearch` in MapStep never call `importer.reset()`; same state flow before #181.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-183-a-rattacher-rebuilt.md`
  summary: The repair toast names the chosen prospect even when the response says `repaired:false` or a different `prospectId` (merge followed).
  evidence: `OrphansScreen.attach` ignores the result, as it did before #183; filed as #199.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-183-a-rattacher-rebuilt.md`
  summary: À rattacher's no-position message is inferred from empty `candidates`, which the server also returns when no live prospect has coordinates.
  evidence: `admin.ts:1576` builds candidates only from prospects with lat/lng; filed as #197.
- source_spec: `_bmad-output/implementation-artifacts/spec-gh-183-a-rattacher-rebuilt.md`
  summary: `OUTCOME_BADGE` lives in `dashboard/outcome-series.ts` but OrphansScreen now reads it too; move it beside `STATUS_BADGE` in `admin/status.ts`.
  evidence: cross-folder import in `OrphansScreen.tsx`; a refactor-sweep item (174.12).
  closed_by: GH #186 (epic #174 sweep) — moved to `admin/outcome-badge.ts`, not `status.ts` as suggested: the field's StopRow imports `status.ts`, so it would have added 0.42 KiB to the precached entry chunk (measured). RecentVisits also dropped its copy of `BADGE_SHAPE`.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-186-refactor-sweep.md`
  summary: The vendored `Textarea` keeps shadcn's `md:text-sm`, which both field callers patch back with `text-base md:text-base` (GH #213).
  evidence: Found by the duplication-map lens on #186. `ui/textarea.tsx:9`, patched at `field/ScriptQuestions.tsx:107` and `field/VisitScreen.tsx:249`. Pre-existing, and every consumer is on the field route, which #186 excludes. No admin screen renders a Textarea.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-20-split-copy-by-audience.md`
  summary: CLAUDE.md invariant 15, ADR-0013 and the glossary say "field-reachable modules import `copy/field`" while `copy/field.ts` and the GH #20 intent say "every module outside `src/client/admin/`"; pick one wording.
  evidence: blind-hunter on GH #20. The fix edits CLAUDE.md, an agent-context file, so it is left to the owner.

- source_spec: `_bmad-output/implementation-artifacts/spec-gh-20-split-copy-by-audience.md`
  summary: `.claude/agents/pwa-engineer.md:22` and `.claude/skills/night-shift/SKILL.md:66` still send field authors to `src/client/copy.ts`; they should name `copy/field` for modules outside `admin/`.
  evidence: blind-hunter on GH #20. Agent-context files; a wrong import is still caught by `check:precache` in CI.
