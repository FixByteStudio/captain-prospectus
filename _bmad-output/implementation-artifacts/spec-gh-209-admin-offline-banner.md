---
title: 'Admin offline banner (GH #209, story 1 of 3)'
type: 'feature'
created: '2026-09-29'
status: 'done'
baseline_commit: 'b984d5cbba7fba6635bf1637b568775347ea04cb'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md'
  - '{project-root}/docs/adr/0013-frontend-conventions.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An admin whose network drops sees each panel flip to its own red « Impossible de charger… » Alert, or nothing at all, where EXPERIENCE.md § State Patterns (Offline · Admin) asks for one full-width banner in the update banner's slot and panels that keep their last-loaded values. Nothing renders it (GH #209; part of GH #85's untested offline-admin wiring).

**Approach:** An `OfflineBanner` in the admin chunk, shown in `AdminLayout`'s banner slot instead of the update prompt while the browser reports offline, and gone on the `online` event. While offline, the per-screen load-failed Alerts stand down and panels keep whatever data they hold.

## Boundaries & Constraints

**Always:** shadcn `Alert` from `src/client/ui/alert.tsx`, full width like `UpdatePrompt`, on `bg-secondary`, lucide `WifiOffIcon`, no button, `role="status"`. The string lives in `src/client/copy/admin.ts`. The offline signal is `useOnline()` (`src/client/hooks/use-online.ts`), the same browser events TanStack's `onlineManager` pauses queries on. DOM tests for: banner shown on `offline`, update prompt displaced, load-failed Alert suppressed with data kept, banner gone on `online`. Reset `onlineManager.setOnline(true)` after each test.

**Never:** a retry button on the banner; a change to the service worker or `vite.config.ts` (it must keep never caching `/api/*`, invariant 8); any change to the entry chunk (`App.tsx`, `Band.tsx`, `copy/field.ts`); the session-expired dialog or the offline-after-reload page (stories 2 and 3); the "admin chunk fails to load" variant (below).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Drop | Admin screen loaded, `offline` fires | Banner « Hors ligne. Les données affichées ne changent plus et se rafraîchiront au retour du réseau. » under the top bar; panels unchanged | none |
| Update waiting | `needRefresh` true and offline | Only the offline banner shows | none |
| Refetch fails offline | Query `isError` with kept data, offline | No load-failed Alert; data still rendered | none |
| Nothing loaded yet | Query pending, offline | Banner plus the existing skeleton | none |
| Back online | `online` fires | Banner gone; update prompt back if a build waits; TanStack resumes paused queries | a real failure after that shows the usual Alert |

</frozen-after-approval>

## Code Map

- `src/client/admin/AdminLayout.tsx` -- renders `{banner}` between header and `<main>`; the slot to swap.
- `src/client/admin/AdminApp.tsx` -- passes `updatePrompt` as `banner`; admin-chunk only, TanStack provider lives here.
- `src/client/Band.tsx` `UpdatePrompt` -- the look to match: `Alert role="status" className="rounded-none border-x-0 border-t-0"`. Do not edit.
- `src/client/hooks/use-online.ts` -- reuse; reads `navigator.onLine` once, then events only.
- `src/client/admin/ScreenState.tsx` -- shared load-failed gate (Prospects, Doublons, À rattacher, Scripts, Visites, Dernières visites, VisitsStrip); hide its Alert while offline.
- `src/client/admin/dashboard/DashboardScreen.tsx:62-92` -- its own Alert and `showPanels` gate; same treatment.
- `src/client/admin/query-client.ts` -- default `networkMode` 'online' already pauses queries offline; leave unchanged.
- `src/client/copy/admin.ts` -- add `offline.banner`.
- `src/client/admin/AdminApp.test.tsx` -- existing harness (stubbed `fetch`, `renderAdmin`); extend here.
- `src/client/admin/ScreenState.test.tsx` -- add the offline case.
- `docs/design.md` § Layout (~l.223-270) -- one paragraph on the banner.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/copy/admin.ts` -- add `offline: { banner: "Hors ligne. Les données affichées ne changent plus et se rafraîchiront au retour du réseau." }` -- EXPERIENCE.md wording verbatim.
- [ ] `src/client/admin/OfflineBanner.tsx` -- new component per Always list -- one home for the look.
- [ ] `src/client/admin/AdminLayout.tsx` -- `banner` slot renders `<OfflineBanner />` when `!useOnline()`, else the passed `banner` -- EXPERIENCE: they never both apply.
- [ ] `src/client/admin/ScreenState.tsx`, `src/client/admin/dashboard/DashboardScreen.tsx` -- render the load-failed Alert only when online; Dashboard's `showPanels` treats offline like not-errored -- panels keep values.
- [ ] `src/client/admin/AdminApp.test.tsx`, `src/client/admin/ScreenState.test.tsx` -- DOM tests for every matrix row; reference GH #85 in the describe comment.
- [ ] `docs/design.md` -- short paragraph in § Layout.

**Acceptance Criteria:**
- Given any `/admin/*` screen, when the browser goes offline, then exactly one element carries the banner sentence and no « Réessayer » button appears in it.
- Given a refetch that fails while offline, when the screen re-renders, then no `copy.*.loadFailed` text is shown and the last data stays on screen.
- Given the `precache` check, when `pnpm build` runs, then the entry chunk does not grow (`OfflineBanner` ships in the admin chunk).

## Design Notes

The chunk-load variant (« same sentence with Réessayer » when the lazy admin chunk fails to download) belongs in `App.tsx`'s entry chunk, so its copy would have to live in `copy/field`, not `copy/admin.ts`; it is deferred with story 3, which lives in the same place.

"The banner goes as soon as an answer comes back" is read as the `online` event: TanStack resumes paused queries on that same event, so the answer follows within one request.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: all pass; `check:precache` reports the entry chunk unchanged.
- `grep -n "api" vite.config.ts` -- expected: the `/api/` navigate/runtime exclusion unchanged by this diff.

## Implementation Notes

- The implementer added the banner, the ScreenState/Dashboard offline gates and tests. The orchestrator then moved the AdminApp "load-failed suppressed" case to `DashboardScreen.test.tsx`, where a real 500 produces `isError`. Mutation-checked: dropping either `&& online` guard fails its test.
- Review patches: the skeleton stands in for a failed first load while offline, `line-clamp-none`, an always-mounted polite region in `AdminLayout`, and « Connexion rétablie. » (the owner's wording) read out when the banner goes.
- Precache 926.24 KiB of 1,000. The +0.1 KiB is the shared CSS gaining `line-clamp-none`; the entry JS carries no admin copy.
- Baseline re-stamped at PR time: merge-base with origin/main is unchanged.

## Spec Change Log

## Review Triage Log

### Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment)

Verdicts: high 0 · medium 3 · low 6 · false 5 · maybe-false 0.

| Verdict | Route | Finding | Evidence / action |
|---|---|---|---|
| medium | patch | ScreenState renders nothing offline after a failed first load (EC, BH, VG) | `busy` false, Alert gated, `data == null` → empty. Patched: `busy` includes `data == null && !online`; test rewritten to that case. |
| medium | patch | Banner sentence truncated to one line (EC) | `AlertTitle` has `line-clamp-1` (`ui/alert.tsx:40`). Patched: `line-clamp-none`. |
| medium | patch | Live region mounted already filled, often not announced (EC, BH) | EXPERIENCE.md:216 asks for a polite region announced on appear. Patched: persistent `aria-live="polite"` wrapper in `AdminLayout`. |
| medium | intent_gap → asked | Nothing is announced when the banner goes (BH) | EXPERIENCE.md:216 says "and once when it goes" but gives no wording; needs a French string. Owner chose « Connexion rétablie. » (2026-09-29): sr-only line in the same live region, `useReconnected` in `AdminLayout`, tested in `AdminApp.test.tsx`. |
| low | patch | ScreenState offline test never asserts the Alert showed first (BH) | Patched: before/after assertions and the `online` round trip. |
| low | patch | Skeleton test doesn't reach the changed line (VG) | `isPending` makes `busy` true either way. Replaced by the failed-first-load test. |
| low | patch | `OfflineBanner` comment credits the 15 s poll for every screen (BH) | Poll is feeds only (`queries.ts` `FEED_POLL_MS`). Comment reworded. |
| low | patch | DashboardScreen comment on skeletons now wrong offline (EC) | Comment updated. |
| low | reject | sr-only "loading" read offline with no data (EC, BH) | Queries resume and load on reconnect; the banner already announces offline. Fix adds a branch; rare. |
| low | reject | Stale Alert flashes back on `online` before the refetch settles (EC) | Same Alert pre-change showed throughout; guarding needs reconnect timestamps. |
| low | reject | VisitsLedger / RecentVisits `!isError` empty-text branch hides "Aucune visite" offline (BH) | Needs empty feed + error + offline together; adds a hook to two components. |
| false | — | Banner should follow "an answer comes back", not `navigator.onLine` (IA, BH) | Frozen Approach says "gone on the `online` event"; Design Notes records the reading. |
| false | — | Chunk-load and after-reload rows not marked deferred (BH, IA) | Both in `deferred-work.md` and the PR description. |
| false | — | ScreenState test doesn't reset `onlineManager` (EC) | That file has no QueryClient; nothing reads `onlineManager`. |
| false | — | Formatting slip in AdminApp.test.tsx (BH) | Settled by `pnpm lint` on the patched tree. |
| false | — | `tsconfig.node.json`/`vite.config.ts` local edits (IA) | Those are in the main checkout, not this worktree's diff. |
