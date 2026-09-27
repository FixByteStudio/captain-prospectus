---
title: 'Field band and sync strip (GH #65)'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: '0e73aa977e19aca0034072231446d6c7db080fb1'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-f8-sync.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The field band is today's 48px bar with a bare dot, and the strip has two looks (secondary for pending, warn wash for every failure) with no action. The 7 sync states in `key-f8-sync.html` are not distinguishable, a session-expired or 426 agent has nothing to tap, and the update banner and the not-found and offline sign-in states predate DESIGN.md.

**Approach:** Derive one view per sync state in a pure, tested function, and draw the band dot/count and the strip from it. Restyle the band, the update banner (Alert) and the fallback states on the DESIGN.md tokens, then rewrite `docs/design.md`'s sync section.

## Boundaries & Constraints

**Always:**
- The 7 states and their looks, strings and icons follow `key-f8-sync.html` and EXPERIENCE.md › State Patterns: synced (success dot, no count, no strip); waiting (warn dot + count, strip `CloudUpload` on the band one step darker); syncing (pulsing `band-muted` dot with a halo, no strip unless items also wait, which shows the waiting strip); offline (`CloudUpload`) and failed (`Clock`) on `secondary`; session expired (destructive dot, `X`, `destructive` strip, `on-destructive` text, "Se reconnecter"); update needed (warn dot, `CloudUpload`, `warn` strip, `on-destructive` text, "Mettre à jour"). The count pill (28px, `band-accent`, full radius) shows whenever pending > 0.
- Decision (2026-09-24, user, after review): the SW serves every navigation from precache (`navigateFallback`), so a plain reload never reaches Access. "Se reconnecter" instead navigates to the current URL plus `?reconnect=1`, a marker the SW's `navigateFallbackDenylist` excludes. That one navigation goes to the network and through Access, and the app then removes the marker from the URL. The outbox is untouched. "Mettre à jour" calls `pwa.update()` when a build is waiting, otherwise reloads, so the next sync's 426 runs `applyUpdateNow` again on a fresh page load.
- Session expired and update needed keep their strip and button while a retry is in flight; `running` only makes the dot pulse. Every dot state has an accessible name, synced included.
- The strip sits in always-mounted live regions: `aria-live="polite"`, and `assertive` for session expired and update needed. Colour never carries meaning alone.
- The band is 56px (`band-height`) plus safe-area-top: mark, wordmark in heading type, a meta subtitle naming the current tab ("Tournée", or "Ajouter" on `/tournee/nouveau`), today's nav links (kept until story 7), the dot, then the avatar.
- The one strip colour DESIGN.md names only as "band, one step darker" becomes an `app.css` token `band-strip` (light `#142038`, dark `#070b15`, from the mockup) in all three theme blocks, with a palette AA pair.
- Decision (2026-09-24, user): the band ends with a static 32px avatar, initials from the email on a gold fill with navy text and a `primary-edge` ring (`key-f1-tournee.html`), no menu. It names the email to assistive tech.
- Decision (2026-09-24, user): the spec is kept whole at ~2,100 tokens.
- Lucide icons are allowed in the entry chunk (ADR-0026); the PR quotes the precache total and the entry chunk.
- Every new string lives in `copy.ts`; the existing `copy.sync.*` strings are reused unchanged.

**Never:**
- No change to `useSync.tsx` scheduling, `sync.ts`, the outbox or the wire contract. The SW config changes only by the one denylist entry. No toast for any state.
- No tabs, no removal of the band nav links (story 7), no admin-side change beyond the shared `UpdatePrompt` look.
- No new dependency, no hardcoded colour or spacing.
- No change to `docs/design.md` beyond the "Sync is ambient, never a toast" section and one `band-strip` row in the Colour table.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Synced | ok, idle, 0 pending | Success dot, no count, no strip | — |
| Waiting | ok, idle, 3 pending | Warn dot + "3", band-strip strip "3 éléments en attente d'envoi" | — |
| Syncing, nothing waiting | running, 0 pending | Pulsing dot, no strip | — |
| Syncing with a backlog | running, 3 pending | Pulsing dot + "3", waiting strip | — |
| Offline / failed | offline or error, any pending | Warn dot (+ count), secondary strip, no button, polite | Retries on its own |
| Session expired | auth | Destructive dot (+ count), destructive strip, "Se reconnecter", assertive; unchanged while a retry runs | Navigate with `?reconnect=1` through Access; outbox kept |
| Update needed | upgrade | Warn dot (+ count), warn strip, "Mettre à jour", assertive, unchanged while a retry runs; the update banner is hidden in favour of the strip | Update or reload; outbox kept |

</frozen-after-approval>

## Code Map

- `src/client/field/SyncIndicator.tsx` -- `SyncDot`, `SyncStrip` and the `MESSAGES` map: rewrite onto the new view. Keep the "Sync is a standing fact" header comment.
- `src/client/field/useSync.tsx` -- `useSyncState()` gives `status`, `running`, `pending`. Read only.
- `src/client/field/sync.ts:25` -- `SyncStatus` = ok | offline | auth | upgrade | error.
- `src/client/App.tsx` -- `FieldFrame` (band markup, `UpdatePrompt`, `SyncStrip`), `AdminFrameFallback`, the `error` early return (offline sign-in and other identity errors, rendered before any frame) and the not-found / forbidden `<p>`s.
- `src/client/Band.tsx` -- `BandBrand`, `BandLink`, `UpdatePrompt` (shared with the admin via `AdminApp updatePrompt`).
- `src/client/pwa.ts` -- `PwaState.update`/`needRefresh`; `applyUpdateNow` runs once per page load, which is why the button reloads when nothing is waiting.
- `src/client/ui/alert.tsx` -- vendored Alert (`role="alert"` by default; the banner overrides it with `status`). `src/client/ui/button-variants.ts` -- use `buttonVariants` (not `button.tsx`, which pulls Radix Slot into the entry chunk).
- `src/client/styles/app.css` -- `@theme inline` band colours (95–99), `--spacing-band-height` (192), band values in `:root` (234), media dark (282), `[data-theme="dark"]` (312). `.safe-top` is padding, so a fixed `h-band-height` on the same element would shrink the band: put the height on an inner row.
- `src/client/styles/palette.test.ts` -- token list (191–195) and AA pairs (245–246).
- `src/client/copy.ts` -- `sync` (488), `update` (501), `errors` (507), `visit.back` ("Retour à la tournée", 435).
- `docs/design.md:831-849` -- "Sync is ambient, never a toast". The Colour token table is higher up.
- `vite.config.ts:59-64` -- `navigateFallback: "index.html"`, `navigateFallbackDenylist: [/^\/api\//]`. Workbox matches the denylist against pathname plus search, so a `[?&]reconnect=1` pattern exempts the marker URL. `config.test.ts:52-55` asserts the denylist exists: extend it to assert the marker entry.
- `docs/domains/identity-access.md:22` -- "Offline and session expiry" owns the re-auth rule: one line there on how the button reaches Access.
- `src/client/field/sync-schedule.ts:52` -- `nextDelayMs` retries auth/upgrade on backoff, so `running` flips on during those states.
- Work only in the checkout `/home/m0/PROJECTs/captain-prospectus-65` (branch `feat/65-field-band-and-sync-strip`), never in `/home/m0/PROJECTs/captain-prospectus`, which holds story 4. The first attempt's diff against the baseline, `/tmp/claude-1000/-home-m0-PROJECTs-captain-prospectus/53a9c631-cb42-4a10-8e2c-02e56ba28f34/scratchpad/gh65-pass1-keep.diff`, is the starting point (`git apply` it there); the Spec Change Log says what to keep and what to change.
- Empty-state pattern (DESIGN.md › Components): 64px `secondary` icon tile, title, one sentence, one button. Update banner: a full-width Alert on `card`, "Plus tard" secondary, "Mettre à jour" primary.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/field/sync-view.ts` + `sync-view.test.ts` -- pure `syncView({status, running, pending})` returning the dot (tone, pulse, accessible label), the count, and the strip (tone, message, icon key, action, politeness) or none; `hidesUpdateBanner(view)`; `stripEffect(action, needRefresh)` giving `"reconnect"` (marker navigation), `"apply-update"` or `"reload"`; `reconnectUrl(href)` adding the marker and `withoutReconnectMarker(href)` removing it. Test every I/O row, auth/upgrade while running, and each helper -- the one place these decisions live.
- [ ] `vite.config.ts`, `config.test.ts` -- add the marker to `navigateFallbackDenylist` and assert it.
- [ ] `src/client/styles/app.css`, `palette.test.ts` -- add `band-strip` to `@theme inline` and the three blocks; add it to the token list and the AA pair "band text on band strip".
- [ ] `src/client/field/SyncIndicator.tsx` -- draw the dot/pill and strip from `syncView`; the dot carries `role="img"` and the label from `syncView`; strip buttons use `buttonVariants({ variant: "ghost", size: "sm" })` plus a `currentColor` border, transparent fill and a focus ring in `currentColor`, never the outline variant, whose `bg-background` and `dark:border-input` survive overrides. Live regions carry `aria-live` only. In dev only, `?sync=<state>` forces a state; the table is built inside the `DEV` branch and looked up with `Object.hasOwn`.
- [ ] `src/client/Band.tsx` -- band row sizing and brand type; `UpdatePrompt` becomes the Alert banner.
- [ ] `src/client/App.tsx` -- new band layout with the subtitle (from `useMatch("/tournee/nouveau/*")`) and the avatar; on load, remove the reconnect marker from the URL with `history.replaceState`; hide `UpdatePrompt` while the strip shows update needed; not-found and forbidden become an empty state with "Retour à la tournée"; the identity error renders the brand band over an empty state with no button.
- [ ] `src/client/format.ts` + test -- `initials(email)`: letters only. Take the first letters of the first two non-empty parts of the local part (split on `.`, `_`, `-`, `+`), else the first two letters of the one part, uppercase, else "?".
- [ ] `src/client/copy.ts` -- `sync.reconnect` ("Se reconnecter"), `sync.synced` ("Synchronisé"), the tab names for the subtitle, the avatar label.
- [ ] `docs/design.md`, `docs/domains/identity-access.md` -- rewrite the design.md sync section (the 7-state table, the two buttons and why only those, the reconnect marker, live-region politeness, why never a toast) and add the `band-strip` Colour-table row; one line in identity-access on the reconnect navigation.

**Acceptance Criteria:**
- Given `pnpm dev` with `?sync=<state>` for each of the 7 states, in light and dark, when the field band renders, then it matches `key-f8-sync.html` and no toast appears.
- Given a session-expired strip, when "Se reconnecter" is tapped, then the browser navigates to the current URL with `?reconnect=1`, the SW does not answer that navigation (Network panel: not served from the service worker), the marker is gone from the URL after load, and the outbox count is unchanged.
- Given `pnpm build`, then the precache total is at or under 1,000 KiB, and the PR quotes it and the entry chunk.

## Implementation Notes

- Work lives in the worktree `../captain-prospectus-65` (branch `feat/65-field-band-and-sync-strip`). The main checkout belongs to the concurrent story 4 session (`feat/63-admin-sidebar`). This session's branch switch had carried that session's uncommitted work along; it was separated hunk by hunk (backup in the session scratchpad) and the story 4 session was told.
- Story 4 (#63) is committed on `feat/63-admin-sidebar` (cec13f8). Whichever merges second will hit small textual conflicts in `copy.ts` (story 4 adds `nav.groups`, `openMenu`, `collapseMenu`, `withCount`, `drawerDescription`), `app.css` (`--color-sidebar*`), `palette.test.ts`, the `Band.tsx` comments and design.md Layout.
- Implemented by a subagent. Files: `sync-view.ts` (+ test), `SyncIndicator.tsx`, `App.tsx`, `Band.tsx`, `format.ts` (+ test), `copy.ts`, `app.css`, `palette.test.ts`, `docs/design.md`.
- Matrix audit: every row has a test in `sync-view.test.ts`. The "banner hidden" part of the update-needed row got its own tested helper, `hidesUpdateBanner`.
- Final `pnpm build` (loop 1, after the pass-2 patches): precache 624.85 KiB, 14 entries; entry chunk 149.33 kB gzip (145.53 kB before). 612 tests pass.
- Found in passing: #75 (a 401 at startup has no way back through Access), #76 (`/cdn-cgi/` is missing from the denylist, which #64's logout needs). Follow-up: #74 (draft loss).

## Spec Change Log

- **Loop 1 (review pass 1).** Triggered by triage #1 (intent_gap: a reload never reaches Access under `navigateFallback`) and #2–#9 (bad_spec). Amended:
  - Frozen block, human-approved: the reconnect is a marker navigation; auth/upgrade keep their strip while running; every dot state has a name; one `band-strip` Colour-table row is allowed.
  - Tasks: the helpers move into `sync-view.ts`; the variant for the strip buttons is named; the denylist and config test; `initials` edge cases; the subtitle uses `useMatch`; the DEV-only table.

  Known-bad states avoided:
  - An expired session whose button never re-authenticates.
  - White-on-off-white strip buttons in light theme.
  - The assertive strip blinking and being re-announced on every backoff retry.
  - A synced dot with no accessible name.
  - Untested handler wiring.

  KEEP from pass 1:
  - `syncView`'s shape and its one-test-per-matrix-row suite.
  - The two always-mounted live regions.
  - The `band-strip` token with its palette pair.
  - The band as `.safe-top` header over an inner `h-band-height` row.
  - `UpdatePrompt` as an `Alert` with `role="status"`.
  - `FieldEmptyState` with the Lucide `MapPinOff`, `Lock` and `TriangleAlert` icons.
  - The static avatar, from gold with `primary-edge`.
  - The design.md sync-section text, extended rather than rewritten.

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: high 2, medium 3, low 6, false 0, maybe-false 0, plus 4 rejected as low or not a defect. Routes: intent_gap 1 (it triggers the loopback, which makes the lower routes moot for this pass), bad_spec 5, defer 2, reject 5.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | edge (claim, high) | "Se reconnecter" reloads, but the SW's `navigateFallback: "index.html"` (`vite.config.ts:62`, denylist only `/api/`) serves the navigation from precache, so it never reaches Access and the session stays expired | high | intent_gap | Confirmed in `vite.config.ts:59-64`. The frozen "reloads the current page (epic decision)" cannot re-authenticate. Human decides the mechanism |
| 2 | verif | Strip buttons use the outline variant, whose `bg-background` survives the overrides, so light theme shows white text on off-white. Dark: `dark:border-input` beats `border-current` | high | bad_spec | Verifier ran `twMerge`. The spec said "outline in currentColor" without naming the variant trap |
| 3 | blind, edge, verif, intent | `running` overrides auth/upgrade, but `nextDelayMs` (`sync-schedule.ts:52`) keeps retrying those states. Each retry drops the button, empties and refills the assertive region (re-announced), and flashes `UpdatePrompt` | medium | bad_spec | The matrix's syncing rows give no status, so the spec allowed this precedence. Amend: auth/upgrade keep their strip while running; only the dot pulses |
| 4 | blind, edge, verif | Synced dot has no accessible name (label `undefined`), and `aria-label` sits on a generic span that assistive tech ignores; the old dot always had a label | medium | bad_spec | `SyncIndicator.tsx` SyncDot. Amend: the dot's name comes from `syncView` for every state, on an element with `role="img"` |
| 5 | verif | The reconnect/update handler choice and the dot label are decided in the component, untested; flipping the ternary passes every test | medium | bad_spec | No `.test.tsx`/DOM harness exists. Amend: the effect (`reload` / `apply-update`) and the label live in `sync-view.ts` and are tested |
| 6 | blind | `band-strip` has no row in the design.md colour table; the spec forbade touching Colour | low | bad_spec | A token with no documented home. Amend: allow one Colour-table row |
| 7 | blind, edge, verif | Subtitle uses exact `pathname === "/tournee/nouveau"`; `/tournee/nouveau/` shows "Tournée" | low | bad_spec | Direct correction (`useMatch`); folded into the amended spec |
| 8 | edge, verif | `initials("_admin@…")` gives "_A"; an empty local part gives an empty avatar | low | bad_spec | `format.ts` falls back to raw `local.slice(0,2)`. Amend: letters only, "?" fallback |
| 9 | blind, edge | `FORCED_STATES` is built at module load in prod, and `?sync=constructor` returns a prototype function in dev | low | bad_spec | Direct correction: build it inside the `DEV` branch with `Object.hasOwn`; folded in |
| 10 | blind | Assertive region keeps `role="status"` (implicit polite) | low | reject | Explicit `aria-live` overrides the role's implicit value per ARIA; folded into #4's amendment anyway (no role on regions) |
| 11 | blind | Loading state (`!me`) has no band while the error state does | low | defer | Pre-existing and outside the named states |
| 12 | verif, intent | Rendered wiring (`FieldFrame` hides `UpdatePrompt`, subtitle per route, live regions) has no test | medium | defer | The repo has no DOM test harness, and adding one is a new dependency. #5 moves the decisions into pure code |
| 13 | blind | Fallback screens reuse `copy.visit.back` | low | reject | The spec directed the reuse; same string, same meaning |
| 14 | blind | Avatar comment dates the decision instead of linking it | low | reject | Cosmetic |
| 15 | edge | "Mettre à jour" after the agent dismissed the banner reloads once more before the waiting build activates | low | reject | Harmless: the reload leads to the next 426, and `applyUpdateNow` then takes the build |
| 16 | blind | Strip button hover removed; focus ring on coloured fills | low | reject | Superseded by #2's re-derivation |

Pass 2 (loop 1; lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: medium 6, low 9, false 1; carried 4. Routes: patch 11, intent_gap 1 (asked, not looped: the other findings are independent of it), defer 3, reject 5.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 17 | edge | Tapping "Se reconnecter" or "Mettre à jour" mid-visit discards the in-memory draft (react-hook-form only, `VisitScreen.tsx:117`) | medium | defer | The spec does not say what happens to unsaved input on navigation. Human chose: ship, follow up in #74 |
| 18 | blind, edge, intent | Offline/failed retries swap their strip for the waiting strip (or none) on every backoff tick and re-announce | medium | patch | Same cause as #3, fixed there only for auth/upgrade. Fix: `running` only pulses the dot for every non-ok status |
| 19 | verif, blind, edge | Denylist pattern and `reconnectUrl` are defined separately; `config.test.ts` only greps for the text `reconnect=1` | medium | patch | Verifier anchored the regex and every test still passed. Fix: one pure `reconnect-marker.ts` owns the pattern, imported by `vite.config.ts`, with matches tested against `reconnectUrl` output |
| 20 | verif | `stripEffect` pins only the effect's name; the navigation target is untested | medium | patch | Replacing the body with `reload()` passes. Fix: the effect carries `to: reconnectUrl(href)`, asserted |
| 21 | blind, edge, verif | Marker cleanup calls `replaceState(null)`, wiping router state (`idx`, `usr`), and rewrites non-canonical queries on every load | medium | patch | Fix: run only when the marker is present, via `useNavigate(..., { replace: true })` |
| 22 | blind, edge, verif | "Se reconnecter" while offline leaves the app for the browser's error page (the denylisted navigation has no fallback) | medium | patch | Fix: no-op when `navigator.onLine` is false |
| 23 | blind | Strip button is 32px, below the 48px field target | low | patch | Fix: extend the hit area with a pseudo-element; the drawn size stays as in the mockup |
| 24 | edge | Ghost's `hover:text-accent-foreground` and `dark:hover:bg-accent/50` survive the overrides (sticky hover after a tap) | low | patch | Direct correction: override both |
| 25 | edge, verif | `initials` drops accented letters (`élodie` gives "LD"); `1.john` gives "J" | low | patch | Direct correction: `\p{L}`, map letters before filtering |
| 26 | edge | Subtitle says "Tournée" on the 404 and forbidden screens | low | patch | Direct correction |
| 27 | edge | At 320px, brand, pill and avatar overflow the row | low | patch | Direct correction: the wordmark may truncate |
| 28 | blind | `AdminFrameFallback` keeps the 48px band | low | patch | Direct correction |
| 29 | blind | identity-access.md still says the app shows "Sign in again to sync", just above the new paragraph | low | patch | Direct correction of the owning doc |
| 30 | blind | Startup 401 screen offers no way back to Access, and a precache reload hits 401 again | medium | defer | Pre-existing: the old screen had no button either. Issue #75 |
| 31 | verif | Marker cleanup effect untested | low | defer | No DOM harness (as #12) |
| 32 | edge | A polite strip with an action gets no handler | false | reject | No polite state carries an action (`syncView`) |
| 33 | blind | Alert and six icons in the entry chunk, cost unquoted | low | reject | The PR quotes precache 624.04 KiB and entry chunk 149.22 kB |
| 34 | blind | carried #15: "Mettre à jour" after "Plus tard" reloads once more | low | reject | carried |
| 35 | blind | carried #13: fallback screens reuse `copy.visit.back` | low | reject | carried |
| 36 | blind | carried #11: loading state has no band | low | defer | carried |
| 37 | verif, intent | carried #12: rendered wiring untested | medium | defer | carried |

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: green, including `sync-view.test.ts` and the palette AA pair.
- `pnpm build` -- expected: success; quote the precache line and the entry chunk.

**Manual checks:**
- In `pnpm dev` at 390px, each `?sync=` state in light and dark against the mockup; `/nope` shows the not-found state; the update banner renders as an Alert.
