---
title: 'Remove the admin field side and its links (#592, story 2.4)'
type: 'refactor'
created: '2026-10-20'
status: 'done'
baseline_commit: '484727eb19eb93ab2e3230ad8024be3a259a9ab8'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context:
  - '{project-root}/docs/adr/0037-admins-leave-the-field-side.md'
  - '{project-root}/_bmad-output/initiative-admin-field-separated/epic-admins-leave-the-field/story-remove-the-admin-field-side-and-its-links.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Since #590 the Worker answers 403 to an admin on `/api/agent/*`, yet the client still gives an admin the field side: `/` sends an admin with no network to `/round`, the avatar card, the gate screens and the location dialog carry a « Tableau de bord » link gated by `adminAccess(...).entry`, and `SyncProvider` runs the sync loop for an admin (403 every heartbeat). ADR-0037 (R5) removes all of it.

**Approach:** Split the shell's routes by role. An admin identity gets only `/admin/*` (the admin frame when live, #591's Hors ligne screen when cache-sourced) and every other path, `/` and `/round/*` included, redirects to `/admin`. An agent keeps today's field routes unchanged. `adminAccess`, the `adminOnline` prop chain and every field-side dashboard link go, with their tests and backlog 010's pinned cases.

## Boundaries & Constraints

**Always:**
- Decided (ADR-0037, #591 design notes): a cache-sourced identity recording role `admin` sees the Hors ligne screen on any path, never the field side. The cached role only picks this static screen; it opens no route or data (invariant 10). Only a live `/api/me` opens the admin frame.
- An admin lands on `/admin` from `/`, `/login` and the installed PWA (`start_url` `/`), online or not.
- `SyncProvider` wraps the agent routes only. An admin's leftover outbox rows stay in Dexie untouched (invariant 5).
- The admin chunk stays out of the entry chunk and the precache (ADR-0019).
- `grep -rnE 'adminAccess|adminOnline|role !== "admin"' src/worker/routes/agent.ts src/client` returns nothing.

**Never:**
- No change for an agent, live or cached: same field routes, forbidden page on live `/admin/*`, `copy.adminRoute.offline` on cached `/admin/*`, not-found on unknown paths.
- No change to the Hors ligne screen, the admin frame, `LoginScreen`'s `landingFor`, the sync contract, or the Worker.
- Do not remove the account card's role line or `copy.nav.tabs.dashboard` if anything else still reads it.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Live admin on `/` | `/api/me` → admin, online | `/admin`, admin frame | — |
| Live admin, browser reports offline at mount | `/api/me` → admin, `navigator.onLine` false | `/admin`, admin frame (no `/round`) | — |
| Live admin deep link to the field | `/round` or `/round/abc` | Redirect to `/admin` | — |
| Cached admin on `/` or `/round` | `/api/me` unreachable, cached admin | `/admin`, Hors ligne screen, no field band | — |
| Cached admin, re-check confirms | Réessayer or `online` event | Admin frame at `/admin` | 401 → `/login` (existing) |
| Admin session | any path | No `/api/agent/sync` request is made | — |
| Agent on `/` | live or cached agent | `/round`, field frame, no « Tableau de bord » anywhere | — |
| Admin from `/login` | sign-in or live session skip | `/admin` | — |

</frozen-after-approval>

## Code Map

- `src/client/App.tsx` -- `GatedApp` render (~L520–616): `adminAccess` call, `adminOffline`, `<SyncProvider>` around all routes, `/` redirect on `entry`, `FieldFrame adminOnline={entry}`, three `/admin/*` routes. `FieldContext` (~L107) and `FieldRoutes` pass `adminOnline` to `NoTourneeMessage` and `StartScreen`. `online` state stays (the cached re-check effect uses it).
- `src/client/field/identity.ts` ~L41–68 -- `AdminAccess` type and `adminAccess`: delete. `identity.test.ts` ~L147–200 `describe("adminAccess …")`: delete.
- `src/client/field/AccountMenu.tsx` -- `adminOnline` prop, `openDashboard`, the « Tableau de bord » row, `LayoutGridIcon`; maybe `useNavigate`/`useLeaveGuard` become unused. Keep the `role` prop and line. `AccountMenu.test.tsx` cases L95, L145–160.
- `src/client/field/NoTourneeMessage.tsx`, `StartScreen.tsx` (~L35, L143, L166), `LocationDialog.tsx` (~L46, L54, L111) -- the `adminOnline` prop and `/admin` link. Update header comments that mention the admin. Tests: `StartScreen.test.tsx` L50, L119–126; `LocationDialog.test.tsx` L18, L33, L110, L130.
- `src/client/copy/field.ts` L26 `accountCard.dashboard`; `copy/shared.ts` L59 `nav.tabs.dashboard` and its "only renders for an admin who is online" comment. Delete each string once unused (`FieldTabs.test.tsx:94` reads `tabs.dashboard`; drop that assertion with it).
- `src/client/App.test.tsx` -- L248 (online admin `/`), L424 "gives an online admin the way back on a gate screen", and `describe("The admin tab and routes follow the network")` L718–1060 (tab/account-card cases and backlog 010's pins: cache-started admin sent to the round). Hors ligne cases from #591 (L927+) stay. Helpers: `renderApp`, `stub.identityUnreachable`, `mockOffline`, `fieldBand()`, `admin-frame` test id.
- `src/client/auth/LoginScreen.test.tsx` L95, L159 -- admin `/login` landing already covered; keep.
- `docs/backlog/010-offline-admin-dom-test.md` -- add a line: superseded by #592 (ADR-0037).
- Docs: `docs/domains/identity-access.md` ~L105–125; `docs/design.md` ~L1640–1646, ~L1736, ~L2605–2672 (account card ASCII and its « online admin only » row); `docs/adr/0019…` L35–42 names `adminAccess` (accepted ADR: leave the body, its status already points to ADR-0037); `docs/domains/field-operations.md` L78–79.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/App.tsx` -- for `me.role === "admin"` render routes with no `SyncProvider`: `/admin/*` → `AdminApp` (live) or `AdminOfflineScreen` (cache-sourced), `*` → `<Navigate to="/admin" replace />`. For an agent, keep `SyncProvider` + `/` → `/round` + `FieldFrame` routes as today minus `adminOnline`. Drop `adminAccess`, `entry`, `adminOnline` from `FieldContext`/`FieldRoutes`/`FieldFrame`; update the comments -- one role, one side (ADR-0037).
- [x] `src/client/field/identity.ts` + test -- delete `adminAccess` and `AdminAccess`.
- [x] `src/client/field/AccountMenu.tsx`, `NoTourneeMessage.tsx`, `StartScreen.tsx`, `LocationDialog.tsx` + their tests -- remove the prop, the link and now-unused imports.
- [x] `src/client/copy/field.ts`, `copy/shared.ts`, `FieldTabs.test.tsx` -- remove the dashboard strings no longer read.
- [x] `src/client/App.test.tsx` -- delete the admin-on-the-field cases; add cases for every I/O row: live admin `/` and `/round/abc` → admin frame; live admin offline at mount → `/admin`; cached admin `/` and `/round` → Hors ligne, no field band; admin makes no `/api/agent/sync` fetch; agent `/` shows no « Tableau de bord ».
- [x] Docs (listed in the Code Map) and backlog 010 -- describe what shipped, one home per rule.

**Acceptance Criteria:**
- Given the change, when the done-when grep runs, then it prints nothing.
- Given the change, when `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` run, then all pass and the PR quotes the precache total against 1,000 KiB.

## Implementation Notes

- A Sonnet `pwa-engineer` subagent did most of the code and tests, then hit the account's rate limit before it reported. The orchestrator finished: removed a duplicated block the subagent's edit left in `AccountMenu.tsx`, restored the `userEvent` import in its test, ran Prettier, wrote all the docs and the backlog 010 note.
- Two tests changed their expectation. "answers an unknown path with the not-found state" ran as an admin and now runs as an agent, since an admin is redirected. A cached admin whose re-check answers agent stays on `/admin`, so they get the agent's forbidden page there with « Retour à la tournée », not the round. That is the agent rule, unchanged.
- `App.test.tsx` counts `SyncProvider` renders (`stub.syncRenders`) to pin that an admin runs no sync, live or cached.
- Verification: the done-when grep prints nothing; typecheck, lint, 117 files / 3,071 tests pass; `pnpm build` precache is 25 entries, 943.28 KiB of 1,000 KiB.

## Spec Change Log

## Review Triage Log

Pass 1 (blind-hunter, edge-case-hunter, verification-gap, intent-alignment; all Sonnet per the owner): 0 high · 0 medium · 5 low (all rejected) · 7 false · 0 maybe-false. Verification-gap filed no gap. No patch, no loopback.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|------|---------|---------|-------|-------------------|
| 1 | edge | Live admin whose admin chunk fails to load hangs, now that `entry` no longer routes them to `/round` | low | reject | `/api/me` has just reached the Worker, so the chunk fetch can too. A live admin's direct `/admin` deep link already had this risk before the change (`screens` never read `online`). The fix is a new error boundary, which is more than a direct correction |
| 2 | edge, blind | A revoked live admin is no longer caught by the sync heartbeat | false | reject | The heartbeat re-asks `/api/me` only for an unconfirmed identity (`useSync.tsx` `if (!confirmed)`). A live admin's 401 already goes to `/login` through the admin query client (`AdminApp.tsx:35`, `queries.ts:403`) |
| 3 | edge, blind | `<Navigate to="/admin">` drops the deep link's path, query and hash | low | reject | Nothing links an admin into `/round/*`: the field side is agent-only. Landing on the dashboard root is the intent |
| 4 | edge, blind | A cached admin whose re-check answers agent stays on `/admin` with the forbidden page | low | reject | Roles are fixed at creation (#593), so this only happens when another person signs in on the same phone. They get the agent rule unchanged, with « Retour à la tournée ». Extra navigation logic for that is more complexity than the case warrants |
| 5 | edge, blind | An admin's leftover outbox rows are stranded with no UI | false | reject | ADR-0037 keeps them on the phone on purpose, and the release step syncs them first. `clearAgentCache` never touches the outbox (invariant 5) |
| 6 | edge, blind | Backlog 010 still names `copy.nav.tabs.dashboard` and has its old title | low | reject | It is a done task kept for the record. Its criteria were already marked superseded, and this change adds a "superseded again by #592" note |
| 7 | blind | The agent test's `copy.nav.dashboard` may assert nothing | false | reject | `copy.nav.dashboard` is « Tableau de bord » (`copy/shared.ts`), the same string the removed links used, so any rendered dashboard link would fail the test |
| 8 | blind | `AccountMenu`'s `role` prop and `accountCard.role.admin` are now unreachable for an admin | low | reject | Harmless. The spec keeps the role line. Narrowing the type is cleanup for the refactor sweep (story 7) |
| 9 | blind | Docs outside `src/` are not grepped | false | reject | Grepped `docs/` and the planning artifacts: the only hits left are accepted ADRs 0019 and 0037 and the done backlog files 010 and 013, all history |
| 10 | blind, intent | "No sync for an admin" is proven by a render counter, not a fetch spy | false | reject | `SyncProvider` is the only thing that calls `runSync`. `useTourneeGate` lives in `FieldFrame`, which an admin never mounts. Its absence is the claim |
| 11 | blind | Spec bookkeeping incomplete (unchecked boxes, empty sections) | false | reject | Spec-edit finding. The triage log is written in this step |
| 12 | intent | Diff implements reading A (shell route split). Expectations are checked at the `GatedApp` level with mocks | false | reject | Descriptive. It confirms the diff matches the approved approach. `LoginScreen`'s admin landing is covered by `LoginScreen.test.tsx:95,159` |

## Design Notes

A live admin with `navigator.onLine` false at mount now lands on `/admin`, not `/round`. `/api/me` just reached the Worker, so the admin chunk can too; the case that needed `entry` was the field fallback, which is gone.

Removing `SyncProvider` for an admin also drops its heartbeat re-check of `/api/me`. A cache-sourced admin still re-checks on the `online` transition and on Réessayer.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: all pass
- `pnpm build` -- expected: passes; precache total under 1,000 KiB
- `grep -rnE 'adminAccess|adminOnline|role !== "admin"' src/worker/routes/agent.ts src/client` -- expected: no output

**Manual checks:**
- Dev server, seeded admin: `/` and `/round` open `/admin`; offline reload shows the Hors ligne screen; the network panel shows no `/api/agent/sync`.
