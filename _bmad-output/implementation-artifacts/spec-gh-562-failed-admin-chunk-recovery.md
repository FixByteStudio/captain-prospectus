---
title: 'A failed admin chunk load shows the Hors ligne screen, with a retry that works'
type: 'feature'
created: '2026-10-26'
status: 'done'
baseline_commit: '89de44acbba7952e9e2b92167acd8e9a21af9a5e'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
context:
  - '{project-root}/docs/adr/0037-admins-leave-the-field-side.md'
  - '{project-root}/docs/adr/0019-admin-chunk-out-of-the-precache.md'
  - '{project-root}/docs/domains/identity-access.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A rejected `import()` of the admin chunk throws past the `/admin/*` `Suspense` (React's `lazy` caches the rejection), so an admin sees an error or a blank page. A failed « Réessayer » on the Hors ligne screen looks like nothing happened. An online browser with a failed `/api/me` reads « Vous êtes hors ligne ». The gate's `/api/me` has no timeout, so a hang leaves the blank band for good. Ticket: `_bmad-output/initiative-retro-follow-ups-2026-10/epic-retro-follow-ups/story-a-failed-admin-chunk-load-shows-a-recoverable-state-instead.md` (CAP-13, retro 579 C-2/C-3). Issue #562.

**Approach:** An error boundary around the admin `Suspense` renders `AdminOfflineScreen` when the chunk load fails; its « Réessayer » imports the chunk afresh and swaps in a new `lazy`. `AdminOfflineScreen` gets a still-offline line and an online-but-unreached variant. The gate's `/api/me` gets a 10 s timeout.

## Boundaries & Constraints

**Always:** All strings in `src/client/copy/field.ts`, none in components. The recovery state is the existing `AdminOfflineScreen` (ADR-0037): entry chunk only, no import from `src/client/admin/`, no link to the field side. A stale hash after a deploy and being offline get the same state, with no probe, no `navigator.onLine` check and no reload offer (owner, 2026-10-18). Only a chunk-load failure is caught; any other render error still throws.

**Never:** Add the admin chunk to the precache; cache any `/api/*` response; touch the admin offline banner, the field screens' loading and error states, or the field's own lazy screens (Carte, Carnet, Visit, AddProspect: found-in-passing issue instead); change the `recheckIdentity` flow beyond adding the still-offline line; widen the timeout to `apiFetch` globally.

**Owner decisions (2026-10-26):**
- Still-offline line, `adminOffline.stillOffline`: « Toujours hors ligne. Réessayez quand la connexion revient. »
- Online but unreached (cached identity, `useOnline()` true, `/api/me` failed): the Hors ligne screen shows a variant, title « Le serveur ne répond pas », body « Le tableau de bord n'a pas pu joindre le serveur. Réessayez dans un instant. ». Admin screen only; the cached agent's `adminRoute.offline` page is unchanged. This closes the `deferred-work.md` spec-gh-209 entry (and replaces dropped backlog #572).
- Still-unreached line, `adminOffline.unreached.stillUnreached`: « Le serveur ne répond toujours pas. Réessayez dans un instant. »
- Timeout: 10 s `AbortSignal`-style abort on the gate's `/api/me` only. A timeout is an ordinary non-401 failure, so it takes the existing cache path (Hors ligne for a cached admin) and can neither revoke nor confirm anyone.
- Scope: the `/admin/*` route only.
- Chunk failure always uses the offline wording, whatever `navigator.onLine` says (AC 4).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Chunk fails | live admin, `import()` rejects | Hors ligne screen: band, title, body, « Réessayer » | no throw past the page |
| Retry succeeds | recovery state, import resolves | admin screens render, same URL, no page reload, state gone | n/a |
| Retry fails | recovery state, import rejects again | screen stays, `stillOffline` line shown, button enabled again | no toast |
| Identity retry fails | cache-sourced admin presses « Réessayer », `/api/me` fails | same screen, still-offline line (or its unreached twin when online) | 401 still opens `/login` |
| Online, unreached | cached admin, `useOnline()` true, `/api/me` failed | variant title and body | n/a |
| `/api/me` hangs | no answer in 10 s | aborted, cached admin → Hors ligne; no cache → `offlineFirstRun` error | n/a |
| Other render error | `AdminApp` throws while rendering | not caught by the boundary | propagates as today |

</frozen-after-approval>

## Code Map

- `src/client/App.tsx:63-65` -- `AdminApp` lazy; `:512-531` admin route (`AdminOfflineScreen` for `identityFromCache`, else `Suspense`); `:384-461` identity effect (`apiFetch("/api/me")`, `settle`, `identityInFlight`, `checking`); `:350` `recheckIdentity`.
- `src/client/auth/AdminOfflineScreen.tsx` -- screen to reuse; props `checking`, `onRetry`. Add `stillOffline`, `variant`.
- `src/client/auth/AdminOfflineScreen.test.tsx` -- component test to extend.
- `src/client/copy/field.ts:295-300` -- `adminOffline` strings; add `stillOffline`, `unreached` (`title`, `body`, `stillUnreached`).
- `src/client/field/identity.ts` -- `resolveIdentity`; unchanged (non-ApiError and abort fall to the cache path).
- `src/client/api.ts:50` -- `apiFetch` spreads `init`, so `{ signal }` passes through.
- `src/client/hooks/use-online.ts` -- `useOnline`, already read in `GatedApp`.
- `src/client/App.test.tsx:61-95` -- `stub` + `vi.mock("./api")` (ignores args today; make it honour `init.signal`) and `vi.mock("./admin/AdminApp")` (`:130`); `mockOffline()` `:163`; Hors ligne cases `:760-1040`.
- `scripts/check-precache.mjs`, `package.json` `check:precache` -- run after `pnpm build`; quote the line.
- Docs: `docs/domains/identity-access.md:127-139`, `docs/design.md:297-302`, `docs/adr/0019-admin-chunk-out-of-the-precache.md` Consequences (known gap), `_bmad-output/implementation-artifacts/deferred-work.md` spec-gh-209 and spec-gh-115 entries (`closed_by:`). EXPERIENCE.md is entry 9's.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/copy/field.ts` -- add `adminOffline.stillOffline` and `adminOffline.unreached.{title,body,stillUnreached}` with the owner's wording -- strings render from the entry chunk
- [x] `src/client/auth/AdminOfflineScreen.tsx` -- props `variant: "offline" | "unreached"`, `stillOffline: boolean`; show the matching title and body, and the still line (`role="status"`) when set; stays link-free -- criteria 3, 6
- [x] `src/client/auth/AdminChunkBoundary.tsx` -- generic `<P>` component: `load`, `fallback`, render-prop child. Holds a `lazy` in state; `load` failure wrapped in a marker error class; a class boundary catches only that; recovery = `AdminOfflineScreen` (offline variant); retry calls `load()` afresh, on success swaps `lazy(async () => module)` and remounts the boundary, on failure sets `stillOffline` -- criteria 1, 2, 3
- [x] `src/client/auth/AdminChunkBoundary.test.tsx` -- reject then resolve (recovery renders from `copy`, retry loads admin, state gone); second reject shows still line and re-enabled button; non-load error rethrown -- the Verify tests
- [x] `src/client/App.tsx` -- admin route uses `AdminChunkBoundary` with `loadAdminApp`; identity effect: 10 s `AbortController` timeout (cleared in `finally`); `stillOffline` state set when a manual retry settles with a cached outcome, cleared when a retry starts; pass `variant={online ? "unreached" : "offline"}` -- criteria 3, 6, 7
- [x] `src/client/App.test.tsx` -- mock honours `init.signal`; cases: admin chunk fails → recovery, retry → frame, same URL; failed identity retry → still line; online + unreached → variant; hang → 10 s → Hors ligne; `navigator.onLine` true with chunk failure → offline wording -- criteria 1-4, 6, 7
- [x] `docs/domains/identity-access.md`, `docs/design.md`, `docs/adr/0019-…md`, `deferred-work.md` -- state the new behaviour, drop "Either page also shows when `/api/me` failed with the browser online", close the two entries with `closed_by: GH #562`
- [x] Open a `found-in-passing` issue for the field's lazy screens (no boundary there), after `gh issue list --search`

**Acceptance Criteria:**
- Given the ticket's seven criteria, when the tests above run, then they pass; `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` and `pnpm check:precache` are green.
- Given `pnpm build`, when `check:precache` runs, then the admin chunk is still outside the precache and the total stays under 1,000 KiB; the PR quotes the output line.

## Implementation Notes

- Screen prop is `stillFailing` (copy key stays `adminOffline.stillOffline`). The still line renders conditionally as `role="status"`.
- The timeout abort only fires when an identity is cached (review): a first run with no cache has nothing to fall back on and keeps waiting.
- Found in passing: the field's lazy screens have no boundary (#654).
- Two existing App tests moved to the unreached wording: with the browser online, a cached admin now reads the variant.
- Not testable in jsdom: whether a browser re-fetches a chunk whose first fetch failed, and a stale hash that 404s for good (the retry then keeps failing; the owner ruled out a reload offer on 2026-10-18).

## Spec Change Log

## Review Triage Log

Pass 1 (blind, edge-case, verification-gap, intent-alignment): 1 medium patched x3 reviewers, 1 medium patched, 1 low patched, 1 low patched, rest low/false/deferred.

- medium, patch: `manualRetry` credited to a press that started no check, and `retryFailed` never reset by other answers (3 lenses) — `recheckIdentity` returns whether it started; `setRetryFailed(manual && outcome.offline)`; test "no still-offline line when a re-check nobody pressed fails".
- medium, patch: the 10 s abort hits a first-run agent with no cache — abort only when an identity is cached; test added.
- low, patch: `empty:hidden` live region is `display:none` — render the `role="status"` line conditionally.
- low, patch: stale comment on the agent `/admin/*` route; ChunkLoadError comment says "while the admin side renders".
- maybe-false/accepted: same-URL re-import after a failed fetch (browser behaviour, manual check; reload offer ruled out by the owner); chunk evaluation errors worded offline (rare, same recovery fits); load() throwing synchronously (an `import()` arrow cannot); double press before re-render (button disabled on the next commit).
- false: "agent page unchanged untested" (no code path touched); EXPERIENCE.md wording (entry 9 owns it).

## Design Notes

`lazy` caches a rejected import for the component's lifetime, so the retry cannot re-render the same `lazy`: it calls `load()` itself (a fresh `import()`), then wraps the resolved module in a new `lazy` kept in state. Whether a browser re-fetches a chunk whose first fetch failed cannot be tested in jsdom; the retry is correct by construction and the manual check below covers it.

The boundary distinguishes chunk-load failures with a marker `ChunkLoadError` thrown from `load().catch(...)`, so a bug inside `AdminApp` is never reported as « Vous êtes hors ligne ».

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint` -- expected: green
- `pnpm build && pnpm check:precache` -- expected: pass; copy the output line into the PR
- `git diff origin/main -- vite.config.ts` -- expected: no change to the precache ignore

**Manual checks (if no CLI):**
- `pnpm dev`, sign in as admin, block `AdminApp-*` in devtools, open `/admin`: the Hors ligne screen shows; unblock and press « Réessayer »: the dashboard loads without a reload; block again and press: the still-offline line shows.
