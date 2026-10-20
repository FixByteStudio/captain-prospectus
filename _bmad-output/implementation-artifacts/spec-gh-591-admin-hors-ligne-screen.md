---
title: 'Admin Hors ligne screen (#591, story 2.3)'
type: 'feature'
created: '2026-10-20'
status: 'done'
baseline_commit: '5c68aae947056ca97f32299f716e78cf32e497b2'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context:
  - '{project-root}/docs/adr/0037-admins-leave-the-field-side.md'
  - '{project-root}/_bmad-output/initiative-admin-field-separated/epic-admins-leave-the-field/story-admin-hors-ligne-screen.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An admin whose identity comes from the cache (no network, or `/api/me` unreachable) and who opens `/admin/*` gets the field-frame fallback « Hors ligne. Cette page a besoin du réseau. Votre tournée reste accessible. » with a link to the round. ADR-0037 (R6) replaces it with a dedicated Hors ligne screen and no field side.

**Approach:** A new entry-chunk screen: the band with the brand only, the shared empty-state shape (64px `secondary` tile with `WifiOff`, title, muted sentence) and one primary touch-size « Réessayer » button that runs the shell's existing `recheckIdentity`. It renders on `/admin/*` for a cache-sourced identity whose cached role is `admin`, outside `FieldFrame`. The owner approved the mockup `mockup-admin-hors-ligne-screen.png` on 2026-10-20.

## Boundaries & Constraints

**Always:**
- Copy is « Vous êtes hors ligne » (title), « Le tableau de bord a besoin du réseau. Reconnectez-vous puis réessayez. » (body), « Réessayer » (button) and « Vérification… » (button while the re-check is in flight). All four live in `copy/field`.
- While a re-check is in flight, the button is disabled, `aria-busy`, and shows the `Spinner` before its label.
- The screen ships in the entry chunk. It imports nothing from `src/client/admin/` or `copy/admin`.
- Invariant 10 holds: the cached role only picks which *offline* screen renders. It never opens an admin route or any data. Only a live `/api/me` sets `screens`.
- A 401 on the re-check still goes to `/login` through the existing path, and the outbox is never touched (invariant 5).

**Never:**
- No link to the round on this screen.
- Do not remove `adminAccess`, `adminOnline`, the `/` redirect or the field side for an offline admin. Story 4 (#592) does that.
- No change for a live-confirmed admin who loses the network while on `/admin`: they keep the admin frame and its offline Alert.
- No change for a cached *agent* on `/admin/*`: they keep today's `copy.adminRoute.offline` page in the field frame.
- No new dependency, and no admin-chunk import.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Offline admin deep link | cached ADMIN, `/api/me` unreachable, `/admin/prospects` | Hors ligne screen in the brand-only band. No tab bar, no avatar, no admin frame, URL unchanged | — |
| `/api/me` fails, browser online | cached ADMIN, Worker 5xx | Same Hors ligne screen (the cache is the source, whatever the browser reports) | — |
| Réessayer, server confirms admin | click while reachable | « Vérification… » disabled, then the admin frame at the same URL | — |
| Réessayer, still unreachable | click, fetch fails | Back to an enabled « Réessayer », the same screen | No toast |
| Réessayer, 401 | click, Worker 401 | `/login`, identity cache cleared | Existing revoked path |
| Network event | `online` fires while on the screen | Re-checks on its own (existing effect) and opens the admin frame | — |
| Cached agent on `/admin/*` | cached AGENT | Unchanged: `copy.adminRoute.offline` in the field frame | — |

</frozen-after-approval>

## Code Map

- `src/client/App.tsx` -- `GatedApp` holds `identityFromCache`, `recheckIdentity` (ref-guarded) and the identity effect (its `.finally` clears `identityInFlight`). The `<Routes>` (~L537–592) renders `/admin/*` inside `FieldFrame` when `!screens`; `FieldEmptyState` ~L271; `AdminFrameFallback` ~L300 is the brand-only band pattern to copy.
- `src/client/field/identity.ts` -- `adminAccess`. Leave it unchanged; story 4 deletes it.
- `src/client/copy/field.ts` -- `adminRoute.offline` ~L290. Add the new strings beside it.
- `src/client/Band.tsx` -- `Band`, `BandBrand`, reused as they are.
- `src/client/ui/spinner.tsx`, `src/client/ui/button-variants.ts` -- `Spinner`; the `touch` size (48px) and the default (primary) variant.
- `src/client/App.test.tsx` ~L871–990 -- cached-admin `/admin` tests currently expect `copy.adminRoute.offline` and a `/round` link. Helpers in the file: `mockOffline`, `stub.identityUnreachable`, `stub.identityUnauthorized`, `renderApp`, `fieldBand()`, the `admin-frame` test id.
- `docs/domains/identity-access.md` ~L124 -- the paragraph "On a cached identity, an `/admin/*` route says it needs the network".
- `docs/design.md` -- the Layout section (~L237), next to the admin offline Alert paragraph (~L297).

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/copy/field.ts` -- add `adminOffline: { title, body, retry, checking }` with the four strings -- one home for the copy (invariant 15).
- [ ] `src/client/auth/AdminOfflineScreen.tsx` -- new named export `AdminOfflineScreen({ checking, onRetry })`. It renders `Band` + `BandBrand`, then `<main className="px-4 pt-6 pb-page">` holding the empty-state column (`max-w-md mx-auto`), the title in `text-heading`, the body in `text-muted-foreground`, and a native `<button>` with `buttonVariants({ size: "touch" })` -- the screen from the approved mockup.
- [ ] `src/client/App.tsx` -- add `checking` state, set true in `recheckIdentity` when it actually starts a check and false in the identity effect's `.finally`. Add a top-level `<Route path="/admin/*">` rendering `AdminOfflineScreen` when `identityFromCache && me.role === "admin"`. Narrow the field-frame `/admin/*` route so it renders only when neither this route nor `screens` applies. Keep the conditions mutually exclusive so React Router never sees two `/admin/*` routes -- outside `FieldFrame`, so no tabs or avatar.
- [ ] `src/client/auth/AdminOfflineScreen.test.tsx` -- component test: renders the title, the body and the « Réessayer » button; a click calls `onRetry`; `checking` shows « Vérification… », disabled.
- [ ] `src/client/App.test.tsx` -- update the cached-admin `/admin` tests to expect the new screen, with no tab navigation and no `/round` link. Add: Réessayer re-checks and opens the admin frame; still unreachable returns to « Réessayer ». Keep the cached-agent test unchanged.
- [ ] `docs/domains/identity-access.md`, `docs/design.md` -- describe the screen and its Réessayer behaviour; the cached-agent page stays as it is.

**Acceptance Criteria:**
- Given a cached admin and the dev server with the network off, when `/admin` opens, then the Hors ligne screen shows as in the mockup.
- Given the change, when `pnpm typecheck`, `pnpm test`, `pnpm lint` and `pnpm build` run, then all pass and the PR quotes the precache total against 1,000 KiB.

## Implementation Notes

- Implemented by a Sonnet `pwa-engineer` subagent. The orchestrator then added the Réessayer→401 test (an I/O matrix row had no covering test), replaced the stale "#97's offline-admin screen to design" comment in `App.tsx`, and fixed an ambiguous "The same page" sentence in identity-access.md.
- Verification: typecheck, lint and 117 files / 3,078 tests pass; `pnpm build` precache is 25 entries, 944.72 KiB of 1,000 KiB. Dev server (Playwright, 375px): admin identity cached live, then reload with `/api/*` aborted and the context offline → the Hors ligne screen at `/admin`, no tab bar; Réessayer while unreachable → enabled again; back online → Tableau de bord at `/admin`. The band's mark did not show in dev because it was requested offline with no service worker; `mark.svg` is in the built precache.
- Baseline re-stamped at PR time: merge-base with origin/main is still `5c68aae947056ca97f32299f716e78cf32e497b2`.
- Review lenses ran on Sonnet, not on this session's model, at the owner's instruction (never opus).

## Spec Change Log

## Review Triage Log

Pass 1 (blind-hunter, edge-case-hunter, verification-gap, intent-alignment): 0 high · 1 medium · 2 low kept · 9 rejected (false or out of intent) · 0 maybe-false.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|------|---------|---------|-------|-------------------|
| 1 | verification-gap, blind, edge | No App test observes the in-flight `checking` state | medium | patch | A dropped `setChecking(true)` passes every test. Added an App case with `/api/me` held pending |
| 2 | edge | Spinner's role=status label leaks into the button's accessible name | low | patch | `Spinner` spreads `aria-label={copy.spinner}`. Spinner set `aria-hidden`, test now uses the exact name |
| 3 | verification-gap, blind | Unwrapped long line in identity-access.md | low | patch | Rewrapped |
| 4 | blind | « Reconnectez-vous » reads as "sign in again" | false | reject | The owner fixed the copy verbatim in R6 / ADR-0037 |
| 5 | blind | « Vous êtes hors ligne » is loose for a Worker 5xx | false | reject | The intent covers "/api/me unreachable". The looseness predates this change and is already documented |
| 6 | blind | Hand-rolled native `<button>` instead of shadcn `Button` | false | reject | The entry-chunk convention is a native button with `buttonVariants`, the same as `LoginScreen.tsx:216` |
| 7 | blind | No toast or live announcement when a retry fails | false | reject | The approved mockup says no toast. The button label change is the feedback |
| 8 | blind | Dead end: no logout, no round link | false | reject | ADR-0037 asks for one Réessayer button and no field side |
| 9 | blind | Entry-chunk claim unverified | false | reject | Verified by the build's precache total, quoted in the PR. No admin import (diff) |
| 10 | edge | Background re-checks re-render GatedApp | low | reject | Two cheap renders per re-check, rare; a guard adds complexity |
| 11 | edge | Cancelled run's `.finally` clears `checking` for a newer run | false | reject | `identityInFlight` keeps runs from overlapping: a new run starts only after the previous `.finally` |
| 12 | edge | Cached admin still reaches the field side on `/` | false | reject | Out of intent; story 4 (#592) |
| 13 | edge | First paint can show « Vérification… » with no click | false | reject | That is the true state (the `online` effect is re-checking) and the spec's intent for shell-level `checking` |
| 14 | edge | Still-unreachable test can pass before the re-check starts | low | patch (with #1) | The new in-flight test pins that the click starts a check |

## Design Notes

The cached role picking the offline screen does not weaken invariant 10. Both branches render static copy and open nothing, and the Worker still decides every request. identity-access.md's "the cached role decides neither" is about access wording (forbidden vs offline), and that rule stays: a cached agent still never sees « accès refusé ».

`checking` is shell state rather than component state so the button also reflects a re-check started by the `online` effect, and so it resets when the fetch settles.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: all pass
- `pnpm build` -- expected: passes; read the precache total from the vite-plugin-pwa output

**Manual checks:**
- Dev server, sign in as the seeded admin, then go offline and reload `/admin`: the Hors ligne screen shows. Back online, Réessayer opens the dashboard.
