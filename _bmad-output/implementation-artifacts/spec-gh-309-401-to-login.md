---
title: 'A 401 sends both clients to /login without losing work'
type: 'feature'
created: '2026-10-09'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '3bda8ba8e3a407f7cd8b889e4ab38f31a16a0d27'
context:
  - '{project-root}/docs/design.md'
  - '{project-root}/docs/domains/identity-access.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A revoked or expired own-login session leaves both apps on an error frame, a strip or an admin toast that points at Access, so a user with no Access cookie cannot get back in (GH #309, CAP-12, CAP-5).

**Approach:** `apiFetch` tells a Worker 401 from an Access redirect; a Worker 401 opens `/login` by router navigation in both apps (the field strip through the leave guard), an Access redirect keeps today's `?reconnect=1` path, "Se déconnecter" ends the session via `POST /api/auth/logout`, and `/login` skips the form for a live identity.

## Boundaries & Constraints

**Always:**
- Worker 401 = `response.status === 401`; Access redirect = `response.type === "opaqueredirect"`. `ApiError` keeps `status` 401 for both and gains distinct `code`s (`unauthorized` / `access_redirect`) plus one exported predicate for the Worker case. `sync.ts` classifies the same way: a Worker 401 gets its own `SyncStatus`; the opaque redirect and 403 keep `auth` and its reconnect button unchanged.
- No 401 path deletes an outbox row (INVARIANT 5). A launch-time Worker 401 still runs `releaseUnconfirmed` then `clearAgentCache`, then `navigate("/login", { replace: true })`. A sync-time Worker 401 still clears the cached round and shows the session-expired strip, with the same French message and the label `copy.sync.reconnect`; its button runs `leave(() => navigate("/login"))`, online or not.
- Admin: a Worker 401 from any query, mutation or `downloadCsv` call opens `/login`. `createAdminQueryClient` takes an `onUnauthorized` callback wired to the router, and `AdminApp` builds the client per mount so a later sign-in never sees the previous cache. An Access redirect keeps the existing session-expired error.
- "Se déconnecter" (admin `AccountMenu` only; the field avatar stays static): `POST /api/auth/logout`, then one `GET /api/me`. If it answers, set `window.location` to `LOGOUT_PATH` as today; otherwise navigate to `/login`. If the POST never reaches the server, stay put and toast the existing generic failure.
- `/login` asks `/api/me` once on mount. An answer navigates to that role's landing (`/admin` or `/tournee`, `replace`); a 401, an Access redirect or a network error leaves the form, with no retry and no loop.
- Strings stay in the `copy/` modules; no wire, schema or `clientVersion` change.
- Docs in the same PR: `docs/design.md` (avatar menu logout sentence, session-expired strip row and "Se reconnecter" bullet), `docs/domains/identity-access.md` (the 401 / session-expiry paragraphs and the top-bar logout paragraph).
- Decision (2026-10-09, story): the `?reconnect=1` marker, the `/cdn-cgi/` denylist entry and the Access logout link stay until phase 3.

**Never:** no change to the sync payload; no `/login` outbox line or 426 prompt (entry 19); no removal of `reconnect-marker.ts`, `access-logout.ts` or the `vite.config.ts` denylist; no redirect parameter back to the interrupted page; no new dependency; no Worker change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Launch, Worker 401 | `/api/me` → 401, 2 visits in outbox | cache dropped, `/login`, 2 rows still there | — |
| Launch, Access redirect | `/api/me` opaque redirect | today's error frame with "Se reconnecter" marker navigation | — |
| Sync, Worker 401, form dirty | strip button tapped | leave dialog first; "Quitter" opens `/login`, "Annuler" keeps the draft | — |
| Sync, Access redirect | opaque redirect | strip button goes to `?reconnect=1` | offline: stays put |
| Admin Worker 401 | any admin request → 401 | `/login` | — |
| Logout, session only | POST ok, `/api/me` → 401 | `/login` | — |
| Logout under Access | POST ok, `/api/me` → 200 | `window.location` = `LOGOUT_PATH` | — |
| Logout, no network | POST rejects | stays, generic failure toast | no navigation |
| `/login`, live identity | `/api/me` → 200 | landing by role | — |
| `/login`, no identity | 401 / redirect / offline | form stays | — |

</frozen-after-approval>

## Code Map

- `src/client/api.ts` L33-37 -- `apiFetch` throws one `ApiError(401, "auth")` for both cases; split the code, add the predicate. `queries.ts` L583 `downloadCsv` does the same and gets the same split.
- `src/client/field/identity.ts` L99 -- `resolveIdentity` returns `revoked: true` for any 401; add which kind so `App.tsx` can navigate or keep the error frame.
- `src/client/App.tsx` `GatedApp` L245-285 -- the `settle` branch for `outcome.revoked`, and the error frame L336-360 (keep for Access). Use `useNavigate` already in scope.
- `src/client/field/sync.ts` L159-167, `SyncStatus` L31-46 -- classify; `sync-view.ts` `AUTH_STRIP`, `syncView`, `stripEffect`, `SyncAction`; `SyncIndicator.tsx` L125-140 `runAction` and L211 label, `forcedView` table. `sync-schedule.ts` is status-generic: no change expected.
- `src/client/field/leave-guard.tsx` `useLeaveGuard` -- reuse; do not change.
- `src/client/admin/query-client.ts`, `AdminApp.tsx` L28 module-level client; `VisitsScreen.tsx` L135 and `ProspectsScreen.tsx` L266 catch blocks that call `downloadCsv`.
- `src/client/admin/AccountMenu.tsx`, `TopBar.tsx` L73 -- anchor becomes a `DropdownMenuItem` `onSelect`; `access-logout.ts` stays (`LOGOUT_PATH`).
- `src/client/auth/LoginScreen.tsx` -- header comment says it never asks `/api/me`; add the one-shot check without blocking the form.
- Tests to extend: `identity.test.ts`, `sync.test.ts`, `sync-view.test.ts`, `SyncIndicator.test.tsx`, `App.test.tsx` (L709 identity-error block), `TopBar.test.tsx` L165-171, `LoginScreen.test.tsx`; new `api.test.ts`.
- Do not touch: `reconnect-marker.ts`, `vite.config.ts`, `src/worker/**`, `src/shared/**`.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/api.ts`, `admin/queries.ts` + `api.test.ts` -- distinct codes, predicate, `downloadCsv` split.
- [x] `field/identity.ts`, `App.tsx` + tests -- launch-time Worker 401 opens `/login`; Access keeps the frame.
- [x] `field/sync.ts`, `sync-view.ts`, `SyncIndicator.tsx` + tests -- new status, strip action through the leave guard.
- [x] `admin/query-client.ts`, `AdminApp.tsx`, `VisitsScreen.tsx`, `ProspectsScreen.tsx` + tests -- admin 401 to `/login`.
- [x] `admin/AccountMenu.tsx` + `TopBar.test.tsx` -- logout flow.
- [x] `auth/LoginScreen.tsx` + test -- live-identity redirect.
- [x] `docs/design.md`, `docs/domains/identity-access.md`.

**Acceptance Criteria:**
- Given the outbox holds a row, when any 401 path runs (launch, sync, admin, logout), then no outbox row is deleted.
- Given `pnpm build`, when `pnpm check:precache` runs, then it passes and the PR quotes the total against 1,000 KiB.
- Given the existing suites, when they run, then only tests whose expectations this story changes are edited.

## Implementation Notes

- Implemented by a general-purpose subagent, which also applied the pass-1 patches.
- Worker 401 is `ApiError(401, "unauthorized")`, Access redirect `ApiError(401, "access_redirect")`; the shared `authError()` helper serves `apiFetch` and `downloadCsv`. `sync.ts` gains `SyncStatus` `"unauthorized"` (strip action `"login"`); `"auth"` now means an Access redirect or a 403.
- `useImportBatches` is outside the query client, so it navigates to `/login` itself (pass-1 patch).
- Verification after the patches: `pnpm typecheck`, `lint`, `test` (97 files, 2,536 tests), `build` green; precache 941.78 KiB of 1,000 KiB. The manual `pnpm dev` checks were not run here.
- Baseline `3bda8ba8e3a407f7cd8b889e4ab38f31a16a0d27` is the merge-base with `origin/main` at branch time; re-stamp it at PR time.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough; blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: high 0, medium 1, low 8, false 0, maybe-false 0.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | vgap | `useImportBatches` calls `apiFetch` directly, outside the MutationCache, so a Worker 401 shows the in-screen error instead of `/login` | medium | patch: navigate to `/login` in its catch, plus a test |
| 2 | vgap | Logout POST answering 401 is untested | low | patch: TopBar test |
| 3 | vgap | `sync-schedule.test` FAILURES list lacks `unauthorized` | low | patch |
| 4 | blind | Spliced doc text in design.md / identity-access.md is long and awkward | low | patch: rewrap |
| 5 | edge | Identity re-check 401 on a cache-started session skips the leave guard | low | defer: pre-existing (the old error frame dropped the form too); deferred-work.md |
| 6 | blind, edge | A `/api/me` 5xx or network failure after a good logout POST goes to `/login` | low | reject: the frozen text says "otherwise opens `/login`"; Access logout is a best-effort continuation |
| 7 | blind, edge | No in-flight guard on "Se déconnecter" | low | reject: both calls are idempotent and the menu closes |
| 8 | blind | Admin 401 navigates with no leave guard | low | reject: admin has no outbox or offline draft and its next write would 401 anyway; spec decision |
| 9 | blind | `signedOut` latch never resets; three `navigate` patterns | low | reject: `AdminApp` is rebuilt on the next mount; patterns differ for lint reasons |
| 10 | vgap | Launch test seeds no unconfirmed row | low | reject: `releaseUnconfirmed` runs unconditionally before the `toLogin` branch, covered by the existing revoked tests |
| 11 | blind, edge | `/login` redirects away in dev with `DEV_USER_EMAIL` set; dev logout goes to a 404 | low | reject: the spec's manual check unsets it; the logout 404 was the same anchor before |
| 12 | edge | Late `/api/me` 200 can pull a user off the form | low | reject: that is the intended "live identity" behaviour; cancelled on unmount |
| 13 | blind | "seven states" in design.md; stale `sessionExpired` comment; `"auth"` code removal undocumented | low | reject: the strip table gains no row; comment still true for the redirect; `"auth"` was never in api.md |
| 14 | intent | Tests are component-level; no service-worker or end-to-end run | — | manual `pnpm dev` checks are in the PR |

## Design Notes

The two cases can only be told apart by the fetch itself: Access answers a cross-origin-style redirect that `redirect: "manual"` turns opaque, while the Worker's 401 is a plain status. Keeping `status` 401 on both means `LoginScreen`'s refusal handling is untouched.

A failed logout POST does not navigate: the cookie would survive, and `/login` would then send the user straight back to their landing.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:precache` -- all green; precache under 1,000 KiB.

**Manual checks:**
- The issue's Verify list on `pnpm dev` with `DEV_USER_EMAIL` unset (two visits queued offline, revoke the device, reconnect → `/login` with both rows kept; dirty form + strip button; admin revoked; logout row gone; signed-in device on `/login`).
